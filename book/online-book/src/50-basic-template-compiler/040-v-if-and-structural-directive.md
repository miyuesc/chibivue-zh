# v-if 和结构型指令

现在让我们继续实现指令功能！

终于到了实现 v-if 的时候了。

## v-if 指令与之前指令的区别

我们已经实现了 v-bind 和 v-on 等指令。

现在我们将实现 v-if，但 v-if 与这些指令的结构有所不同。

以下是 Vue.js 官方文档中关于编译时优化的一段描述：

> In this case, the entire template has a single block because it does not contain any structural directives like v-if and v-for.

https://vuejs.org/guide/extras/rendering-mechanism.html#tree-flattening

从中可以看出，v-if 和 v-for 被称为 `structural directives`（结构型指令）。

Angular 的文档中也明确将其作为一个类别。

https://angular.jp/guide/structural-directives

v-if 和 v-for 不仅仅是改变元素的属性（和事件行为），它们还会切换元素的存在、根据列表数量生成或删除元素，从而改变元素的结构。

## 目标开发者接口

让我们考虑一个可以结合 v-if / v-else-if / v-else 实现 FizzBuzz 的示例。

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const n = ref(1)
    const inc = () => {
      n.value++
    }

    return { n, inc }
  },

  template: `
    <button @click="inc">inc</button>
    <p v-if="n % 5 === 0 && n % 3 === 0">FizzBuzz</p>
    <p v-else-if="n % 5 === 0">Buzz</p>
    <p v-else-if="n % 3 === 0">Fizz</p>
    <p v-else>{{ n }}</p>
  `,
})

const app = createApp(App)

app.mount('#app')
```

首先，让我们思考一下我们想要生成什么样的代码。

结论是，v-if 和 v-else 会被转换为以下条件表达式：

```ts
function render(_ctx) {
  with (_ctx) {
    const {
      toHandlerKey: _toHandlerKey,
      normalizeProps: _normalizeProps,
      createVNode: _createVNode,
      createCommentVNode: _createCommentVNode,
      Fragment: _Fragment,
    } = ChibiVue

    return _createVNode(_Fragment, null, [
      _createVNode(
        'button',
        _normalizeProps({ [_toHandlerKey('click')]: inc }),
        'inc',
      ),
      n % 5 === 0 && n % 3 === 0
        ? _createVNode('p', null, 'FizzBuzz')
        : n % 5 === 0
          ? _createVNode('p', null, 'Buzz')
          : n % 3 === 0
            ? _createVNode('p', null, 'Fizz')
            : _createVNode('p', null, n),
    ])
  }
}
```

从中可以看出，我们需要在已有的实现基础上添加条件结构。

要实现将 AST 转换为这样的代码，需要一些巧妙的设计。

::: warning

在当前实现中，由于我们还没有处理空白字符的跳过，实际上可能会在节点之间插入额外的文字节点。

但这对 v-if 的实现不会造成问题（后面会解释），所以本章暂时忽略这个问题。

:::

## 结构型指令的实现

### 实现结构相关的方法

在实现 v-if 之前，需要做一些准备工作。

正如开始所说，v-if 和 v-for 这类结构型指令会改变 AST 节点的结构。

为了实现这些功能，我们需要在基础 transformer 中添加一些实现。

具体来说，我们要在 TransformContext 中添加以下三个方法：

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  // .
  // .
  replaceNode(node: TemplateChildNode): void // 新增
  removeNode(node?: TemplateChildNode): void // 新增
  onNodeRemoved(): void // 新增
}
```

我们将使用 traverseChildren 中保存的当前 parent 和 children 索引来实现这些方法。

<!-- NOTE: 这一章可能不需要实现 -->

::: details 补充说明

这部分代码应该已经实现了，但在之前的章节中没有详细解释，所以在这里补充说明。

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent // 这个
    context.childIndex = i // 这个
    traverseNode(child, context)
  }
}
```

:::

```ts
export function createTransformContext(
  root: RootNode,
  { nodeTransforms = [], directiveTransforms = {} }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    // .
    // .
    // .

    // 接收一个 Node，替换 currentNode 和 parent 的 children 中对应的节点
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    },

    // 接收一个 Node，从 parent 的 children 中删除该节点
    removeNode(node) {
      const list = context.parent!.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1
      if (!node || node === context.currentNode) {
        // 当前节点被删除
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        // 兄弟节点被删除
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent!.children.splice(removalIndex, 1)
    },

    // 这个将在使用 replaceNode 等方法时注册
    onNodeRemoved: () => {},
  }

  return context
}
```

我们还需要修改一些现有实现。为了处理 transform 过程中 removeNode 的情况，我们需要调整 traverseChildren 方法。

当节点被删除时，索引会发生变化，所以我们需要在节点被删除时减少 for 循环的索引。

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  let i = 0 // 修改
  const nodeRemoved = () => {
    i-- // 新增
  }
  for (; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved // 新增
    traverseNode(child, context)
  }
}
```

### 实现 createStructuralDirectiveTransform

为了实现 v-if 和 v-for 这类指令，我们将创建一个 createStructuralDirectiveTransform 辅助函数。

这些 transformer 只作用于 NodeTypes.ELEMENT，并对该节点所持有的 DirectiveNode 应用各自的 transformer 实现。

实现本身并不复杂，看代码会更好理解：

```ts
// 每个 transformer (v-if/v-for 等) 都会按照这个接口实现
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void)

export function createStructuralDirectiveTransform(
  // name 也支持正则表达式
  // 例如 v-if 的 transformer 可以接收 `/^(if|else|else-if)$/` 这样的参数
  name: string | RegExp,
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      // 只作用于 NodeTypes.ELEMENT
      const { props } = node
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // 对类型为 NodeTypes.DIRECTIVE 且名称匹配的属性执行 transformer
          props.splice(i, 1)
          i--
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
      return exitFns
    }
  }
}
```

## 实现 v-if

### AST 实现

前面的准备工作已经完成，现在开始实现 v-if。

通常我们会从 AST 定义开始，然后实现解析器。

但在这个情况下，我们不需要特别的解析器。

我们更关心的是：要将 AST 转换成什么样的形式，以及如何实现这个转换的 transformer。

让我们再次看看前面设想的编译后代码：

```ts
function render(_ctx) {
  with (_ctx) {
    const {
      toHandlerKey: _toHandlerKey,
      normalizeProps: _normalizeProps,
      createVNode: _createVNode,
      createCommentVNode: _createCommentVNode,
      Fragment: _Fragment,
    } = ChibiVue

    return _createVNode(_Fragment, null, [
      _createVNode(
        'button',
        _normalizeProps({ [_toHandlerKey('click')]: inc }),
        'inc',
      ),
      n % 5 === 0 && n % 3 === 0
        ? _createVNode('p', null, 'FizzBuzz')
        : n % 5 === 0
          ? _createVNode('p', null, 'Buzz')
          : n % 3 === 0
            ? _createVNode('p', null, 'Fizz')
            : _createVNode('p', null, n),
    ])
  }
}
```

最终会转换为条件表达式（三元运算符）。

由于我们以前没有处理过条件表达式，需要在 AST 中添加相关定义。
基本上我们需要考虑三个信息（因为是"三元"运算符）：

- **条件**  
  A ? B : C 中的 A 部分。  
  表示为 condition。
- **条件匹配时的节点**  
  A ? B : C 中的 B 部分。  
  表示为 consequent。
- **条件不匹配时的节点**  
  A ? B : C 中的 C 部分。  
  表示为 alternate。

```ts
export const enum NodeTypes {
  // .
  // .
  // .
  JS_CONDITIONAL_EXPRESSION,
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION
  test: JSChildNode
  consequent: JSChildNode
  alternate: JSChildNode
  newline: boolean // 这个是用于 codegen 格式化的，不用太在意
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ConditionalExpression // 新增
  | ExpressionNode

export function createConditionalExpression(
  test: ConditionalExpression['test'],
  consequent: ConditionalExpression['consequent'],
  alternate: ConditionalExpression['alternate'],
  newline = true,
): ConditionalExpression {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub,
  }
}
```

接下来，我们用这些来实现表示 VIf 的 AST 节点：

```ts
export const enum NodeTypes {
  // .
  // .
  // .
  IF,
  IF_BRANCH,
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  codegenNode?: IfConditionalExpression
}

export interface IfConditionalExpression extends ConditionalExpression {
  consequent: VNodeCall
  alternate: VNodeCall | IfConditionalExpression
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: TemplateChildNode[]
  userKey?: AttributeNode | DirectiveNode
}

export type ParentNode =
  | RootNode
  | ElementNode
  // 新增
  | IfBranchNode
```

### 实现 transformer

有了 AST 定义，我们现在可以实现生成这些 AST 的 transformer。

大致思路是根据几个 `ElementNode` 生成一个 `IfNode`。

之所以说"几个"，是因为这里我们不是将一个节点转换为另一个节点，而是处理多个节点的情况。例如：

```html
<p v-if="n % 5 === 0 && n % 3 === 0">FizzBuzz</p>
<p v-else-if="n % 5 === 0">Buzz</p>
<p v-else-if="n % 3 === 0">Fizz</p>
<p v-else>{{ n }}</p>
```

当有多个 ElementNode 时，我们需要将从 v-if 到 v-else 的所有节点生成为一个 IfNode。

当匹配到第一个 v-if 时，我们会检查后续节点是否为 v-else-if 或 v-else，同时生成 IfNode。

我们将具体处理放在 processIf 函数中，先实现大体框架，利用前面的 `createStructuralDirectiveTransform` 函数：

```ts
export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            context,
          ) as IfConditionalExpression
        } else {
          const parentCondition = getParentCondition(ifNode.codegenNode!)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            context,
          )
        }
      }
    })
  },
)

export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  // TODO:
}
```

```ts
/// 用于生成 codegenNode 的函数

// 生成分支的 codegenNode
function createCodegenNodeForBranch(
  branch: IfBranchNode,
  context: TransformContext,
): IfConditionalExpression | VNodeCall {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, context),
      // alternate 暂时生成为注释节点
      // 当有 v-else-if 或 v-else 时，会将 alternate 替换为对应节点
      // 即 `parentCondition.alternate = createCodegenNodeForBranch(branch, context);` 部分
      // 如果没有 v-else-if 或 v-else，则保持为 CREATE_COMMENT 节点
      createCallExpression(context.helper(CREATE_COMMENT), ['""', 'true']),
    ) as IfConditionalExpression
  } else {
    return createChildrenCodegenNode(branch, context)
  }
}

function createChildrenCodegenNode(
  branch: IfBranchNode,
  context: TransformContext,
): VNodeCall {
  // 从分支中提取 vnode call
  const { children } = branch
  const firstChild = children[0]
  const vnodeCall = (firstChild as ElementNode).codegenNode as VNodeCall
  return vnodeCall
}

function getParentCondition(
  node: IfConditionalExpression,
): IfConditionalExpression {
  // 从节点开始遍历，获取末端节点
  while (true) {
    if (node.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
      if (node.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
        node = node.alternate
      } else {
        return node
      }
    }
  }
}
```

现在我们在 `processIf` 中实现更具体的 AST 节点转换逻辑。

首先考虑 `if` 的情况，这是比较简单的情况。我们只需要生成 IfNode，并执行 codegenNode 的生成。
在这个过程中，我们将当前节点作为 IfBranch 生成，将其添加到 IfNode 中，并用 IfNode 替换当前节点。

结构变化如下：
```
- parent
  - currentNode

↓

- parent
  - IfNode
    - IfBranch (currentNode)
```

```ts
export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  // 预先对 exp 执行 processExpression
  if (!context.isBrowser && dir.exp) {
    dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
  }

  if (dir.name === 'if') {
    const branch = createIfBranch(node, dir)
    const ifNode: IfNode = {
      type: NodeTypes.IF,
      loc: node.loc,
      branches: [branch],
    }
    context.replaceNode(ifNode)
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  } else {
    // TODO:
  }
}

function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: [node],
  }
}
```

接下来处理 v-if 以外的情况。

我们从 context 获取 parent 的 children，找到 siblings，从当前节点（自身）开始循环遍历，
根据自身生成 IfBranch 并添加到 branches 中。同时，我们会删除注释和空文本节点。

```ts
if (dir.name === 'if') {
  /** 省略 */
} else {
  const siblings = context.parent!.children
  let i = siblings.indexOf(node)
  while (i-- >= -1) {
    const sibling = siblings[i]
    if (sibling && sibling.type === NodeTypes.COMMENT) {
      context.removeNode(sibling)
      continue
    }

    if (
      sibling &&
      sibling.type === NodeTypes.TEXT &&
      !sibling.content.trim().length
    ) {
      context.removeNode(sibling)
      continue
    }

    if (sibling && sibling.type === NodeTypes.IF) {
      context.removeNode()
      const branch = createIfBranch(node, dir)
      sibling.branches.push(branch)
      const onExit = processCodegen && processCodegen(sibling, branch, false)
      traverseNode(branch, context)
      if (onExit) onExit()
      context.currentNode = null
    }
    break
  }
}
```

可以看出，我们实际上没有区分 else-if 和 else。

在 AST 中，我们通过 condition 是否存在来区分，如果不存在则视为 else。
（这在 `createIfBranch` 中通过 `dir.name === "else" ? undefined : dir.exp` 实现）

关键点是在遇到 `if` 时生成 `IfNode`，然后对于其他情况，只需将它们添加到该节点的 branches 中。

transformIf 的实现就此完成。接下来我们需要对周边代码进行一些调整。

我们需要确保 traverseNode 能够处理 IfNode 的 branches，并对它们执行 traverseNode。

我们还需要将 IfBranch 添加到 traverseChildren 的处理对象中。

```ts
export function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) {
  // .
  // .
  // .
  switch (node.type) {
    // .
    // .
    // 新增
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break

    case NodeTypes.IF_BRANCH: // 新增
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
  }
}
```

最后，我们需要将 transformIf 注册为编译器选项。

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [transformIf, transformElement],
    { bind: transformBind, on: transformOn },
  ]
}
```

transformer 已经实现完成！

剩下的就是实现 codegen，v-if 的实现就完成了。我们已经快接近终点了！

### codegen 实现

最后的部分很简单，我们只需要根据 ConditionalExpression 节点生成代码：

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF: // 别忘了添加这个！
      genNode(node.codegenNode!, context, option)
      break
    // .
    // .
    // .
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context, option)
      break
    /* istanbul ignore next */
    case NodeTypes.IF_BRANCH:
      // noop
      break
  }
}

function genConditionalExpression(
  node: ConditionalExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { test, consequent, alternate, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    genExpression(test, context)
  } else {
    push(`(`)
    genNode(test, context, option)
    push(`)`)
  }
  needNewline && indent()
  context.indentLevel++
  needNewline || push(` `)
  push(`? `)
  genNode(consequent, context, option)
  context.indentLevel--
  needNewline && newline()
  needNewline || push(` `)
  push(`: `)
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  if (!isNested) {
    context.indentLevel++
  }
  genNode(alternate, context, option)
  if (!isNested) {
    context.indentLevel--
  }
  needNewline && deindent(true /* without newline */)
}
```

这里我们只是基于 AST 生成条件表达式，没有什么特别复杂的地方。

## 完成！！

这是一个相对较大的章节，但现在我们已经完成了 v-if 的实现！（辛苦了！）

让我们实际运行一下！！！！

运行正常！

![vif_fizzbuzz](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/vif_fizzbuzz.png)

到此为止的源代码: [GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/040_v_if_and_structural_directive) 