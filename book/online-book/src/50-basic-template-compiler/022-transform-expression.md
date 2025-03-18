# transformExpression

## 目标开发者接口和当前问题

首先，请看以下组件：

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}
</script>

<template>
  <div>
    <button :onClick="increment">count + count is: {{ count + count }}</button>
  </div>
</template>
```

这个组件存在一些问题。  
由于这个组件是用 SFC 编写的，因此不会使用 with 语句。
这意味着绑定无法正常工作。

让我们看看编译后的代码：

```js
const _sfc_main = {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}

function render(_ctx) {
  const { h, mergeProps, normalizeProps, normalizeClass, normalizeStyle } =
    ChibiVue

  return h('div', null, [
    '\n    ',
    h('button', normalizeProps({ onClick: increment }), [
      'count + count is: ',
      _ctx.count + count,
    ]),
    '\n  ',
  ])
}

export default { ..._sfc_main, render }
```

- 问题点 1  
  注册为事件处理器的 increment 无法通过 \_ctx 访问。  
  这是理所当然的，因为在上一次实现 v-bind 时，我们没有添加前缀。
- 问题点 2  
  count + count 无法通过 \_ctx 访问。  
  对于双花括号表达式，我们只是简单地添加了 `_ctx.` 前缀，但没有处理其他标识符。  
  像这样，表达式中出现的所有标识符都需要添加 `_ctx.` 前缀。这不仅适用于双花括号表达式，也适用于所有其他地方。

看来我们需要一个处理，为表达式中出现的标识符添加 `_ctx.` 前缀。

::: details 我们希望编译成这样

```js
const _sfc_main = {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}

function render(_ctx) {
  const { h, mergeProps, normalizeProps, normalizeClass, normalizeStyle } =
    ChibiVue

  return h('div', null, [
    '\n    ',
    h('button', normalizeProps({ onClick: _ctx.increment }), [
      'count + count is: ',
      _ctx.count + _ctx.count,
    ]),
    '\n  ',
  ])
}

export default { ..._sfc_main, render }
```

:::

::: warning

实际上，Vue.js 官方实现的方法略有不同。

如下所示，在官方实现中，从 setup 函数绑定的内容是通过 `$setup` 解析的。

![resolve_bindings_original](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/resolve_bindings_original.png)

但实现这种方式稍微有点复杂，所以我们简化为添加 `_ctx.` 前缀。（props 和 setup 都从 \_ctx 中解析）

:::

## 实现方针

简而言之，我们想要"给 ExpressionNode 上的所有标识符（Identifier）添加 `_ctx.` 前缀"。

让我再详细解释一下。  
回顾一下，程序在被解析后会表示为 AST。  
程序的 AST 节点主要分为两类：Expression（表达式）和 Statement（语句）。

```ts
1 // 这是 Expression
ident // 这是 Expression
func() // 这是 Expression
ident + func() // 这是 Expression

let a // 这是 Statement
if (!a) a = 1 // 这是 Statement
for (let i = 0; i < 10; i++) a++ // 这是 Statement
```

我们现在关注的是 Expression（表达式）。  
Expression 有多种类型。Identifier（标识符）是其中一种，表示由标识符表示的表达式。  
（基本上可以认为是变量名）

ExpressionNode 上的所有标识符指的是：

```ts
1 // 没有
ident // ident --- (1)
func() // func --- (2)
ident + func() // ident, func --- (3)
```

例如，(1) 本身就是一个标识符，(2) 是 CallExpression 的 callee 是标识符，  
(3) 是 BinaryExpression 的 left 是标识符，right 是 CallExpression，其 callee 是标识符。

这样，标识符会在表达式的各种位置出现。

您可以在以下网站输入程序轻松观察 AST，请尝试观察各种表达式上的标识符：  
https://astexplorer.net/#/gist/670a1bee71dbd50bec4e6cc176614ef8/9a9ff250b18ccd9000ed253b0b6970696607b774

## 查找标识符

了解了我们的目标后，如何实现呢？

看起来很复杂，但实际上很简单，我们使用 estree-walker 库。  
https://github.com/Rich-Harris/estree-walker

我们使用这个库遍历通过 babel 解析得到的 AST。  
使用方法非常简单，将 AST 传递给 walk 函数，并在第二个参数中描述每个节点的处理逻辑。  
这个 walk 函数会逐个遍历 AST 节点，enter 选项用于在到达节点时处理节点。  
还有其他选项，比如 leave 用于在离开节点时处理。今次只使用 enter。

我们创建一个新的 `compiler-core/babelUtils.ts` 文件，实现对标识符进行操作的实用函数。

首先安装 estree-walker：

```sh
ni estree-walker

ni -D @babel/types # 也需要这个
```

```ts
import { Identifier, Node } from '@babel/types'

import { walk } from 'estree-walker'

export function walkIdentifiers(
  root: Node,
  onIdentifier: (node: Identifier) => void,
) {
  ;(walk as any)(root, {
    enter(node: Node) {
      if (node.type === 'Identifier') {
        onIdentifier(node)
      }
    },
  })
}
```

然后，我们只需要生成表达式的 AST，将其传递给这个函数，并在转换过程中修改节点。

## transformExpression 的实现

### AST 的修改和解析器

现在我们开始实现转换处理的核心部分 transformExpression。

首先，我们将 InterpolationNode 的 content 从 string 类型改为 SimpleExpressionNode 类型。

```ts
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: string // [!code --]
  content: ExpressionNode // [!code ++]
}
```

相应地，我们也需要修改 parseInterpolation 函数。

```ts
function parseInterpolation(
  context: ParserContext,
): InterpolationNode | undefined {
  // .
  // .
  // .
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content,
      loc: getSelection(context, innerStart, innerEnd),
    },
    loc: getSelection(context, start),
  }
}
```

### transformer（核心部分）的实现

为了在其他 transformer 中也能使用表达式转换功能，我们将其抽取为一个名为 `processExpression` 的函数。  
transformExpression 将处理 INTERPOLATION 和 DIRECTIVE 所持有的 ExpressionNode。

```ts
export const transformExpression: NodeTransform = node => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content as SimpleExpressionNode)
  } else if (node.type === NodeTypes.ELEMENT) {
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      if (dir.type === NodeTypes.DIRECTIVE) {
        const exp = dir.exp
        const arg = dir.arg
        if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION) {
          dir.exp = processExpression(exp)
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          dir.arg = processExpression(arg)
        }
      }
    }
  }
}

export function processExpression(node: SimpleExpressionNode): ExpressionNode {
  // TODO:
}
```

接下来是 processExpression 实现的说明。  
首先，在 processExpression 内部实现一个名为 rewriteIdentifier 的函数，用于重写标识符。  
如果节点本身是单个标识符，我们直接应用这个函数即可。

需要注意的是，这个 processExpression 函数仅适用于 SFC 情况（不使用 with 语句的情况）。  
也就是说，如果设置了 isBrowser 标志，我们就直接返回原始节点。  
我们将修改实现，以便通过 ctx 接收这个标志。

另外，我们希望保留 true、false 等字面量，所以我们创建一个字面量白名单。

```ts
const isLiteralWhitelisted = makeMap('true,false,null,this')

export function processExpression(
  node: SimpleExpressionNode,
  ctx: TransformContext,
): ExpressionNode {
  if (ctx.isBrowser) {
    // 浏览器情况下不做任何处理
    return node
  }

  const rawExp = node.content

  const rewriteIdentifier = (raw: string) => {
    return `_ctx.${raw}`
  }

  if (isSimpleIdentifier(rawExp)) {
    const isLiteral = isLiteralWhitelisted(rawExp)
    if (!isLiteral) {
      node.content = rewriteIdentifier(rawExp)
    }
    return node
  }

  // TODO:
}
```

makeMap 是 vuejs/core 中实现的一个辅助函数，用于检查字符串是否与用逗号分隔定义的字符串列表匹配，返回一个布尔值。

```ts
export function makeMap(
  str: string,
  expectsLowerCase?: boolean,
): (key: string) => boolean {
  const map: Record<string, boolean> = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val]
}
```

下一个问题是如何转换 SimpleExpressionNode（非简单标识符）。  
在接下来的讨论中需要注意的是，我们将处理两种 AST：由 Babel 解析器生成的 JavaScript AST 和我们为 chibivue 定义的 AST。  
为了避免混淆，我们在本章中将前者称为 estree，将后者称为 AST。

我们的方法分为两个步骤：

1. 替换 estree 节点并收集这些节点
2. 基于收集的节点构建 AST

首先是第一步。  
这部分比较简单，我们用 Babel 解析 SimpleExpressionNode 的内容（字符串），  
得到 estree 后，将其传递给我们之前创建的工具函数，应用 rewriteIdentifier。  
在此过程中，我们将节点收集到 ids 数组中。

```ts
import { parse } from '@babel/parser'
import { Identifier } from '@babel/types'
import { walkIdentifiers } from '../babelUtils'

interface PrefixMeta {
  start: number
  end: number
}

export function processExpression(node: SimpleExpressionNode): ExpressionNode {
  // .
  // .
  // .
  const ast = parse(`(${rawExp})`).program // ※ 这里的 ast 指的是 estree
  type QualifiedId = Identifier & PrefixMeta
  const ids: QualifiedId[] = []

  walkIdentifiers(ast, node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  })

  // TODO:
}
```

需要注意的是，到目前为止，我们只处理了 estree，还没有对 AST 节点进行任何操作。

### CompoundExpression

接下来是第二步。这里我们定义一个新的 AST 节点类型：`CompoundExpressionNode`。  
Compound 有"混合"、"复合"等含义。  
这个节点包含 children 属性，存储一些特殊值。  
先看一下 AST 的定义：

```ts
export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
  )[]
}
```

children 是上面这样的数组。  
这个节点的 children 表示什么，看具体例子会更容易理解：

以下表达式会解析为以下 CompoundExpressionNode：

```ts
count * 2
```

```json
{
  "type": 7,
  "children": [
    {
      "type": 4,
      "isStatic": false,
      "content": "_ctx.count"
    },
    " * 2"
  ]
}
```

看起来有点奇怪。children 可以是字符串类型就是为了这种情况。  
CompoundExpression 允许 Vue 编译器按需要的粒度进行分割，部分用字符串表示，部分用节点表示。  
具体来说，在这个例子中，我们需要重写表达式中的标识符，所以将标识符部分分割为单独的 SimpleExpressionNode。

所以，我们要做的就是基于收集到的 estree 标识符节点和源代码生成这个 CompoundExpression。  
以下代码是这一过程的实现：

```ts
export function processExpression(node: SimpleExpressionNode): ExpressionNode {
  // .
  // .
  // .
  const children: CompoundExpressionNode['children'] = []
  ids.sort((a, b) => a.start - b.start)
  ids.forEach((id, i) => {
    const start = id.start - 1
    const end = id.end - 1
    const last = ids[i - 1]
    const leadingText = rawExp.slice(last ? last.end - 1 : 0, start)
    if (leadingText.length) {
      children.push(leadingText)
    }

    const source = rawExp.slice(start, end)
    children.push(
      createSimpleExpression(id.name, false, {
        source,
        start: advancePositionWithClone(node.loc.start, source, start),
        end: advancePositionWithClone(node.loc.start, source, end),
      }),
    )
    if (i === ids.length - 1 && end < rawExp.length) {
      children.push(rawExp.slice(end))
    }
  })

  let ret
  if (children.length) {
    ret = createCompoundExpression(children, node.loc)
  } else {
    ret = node
  }

  return ret
}
```

由 Babel 解析的节点包含 start 和 end 属性（表示在原始字符串中的位置信息），我们基于这些信息从 rawExp 中提取相应部分，努力进行分割。  
详细内容请仔细阅读源代码。如果您理解了上述方法，应该能够理解代码。（advancePositionWithClone 等函数也是新实现的，请查看这些部分）

现在我们可以生成 CompoundExpressionNode 了，在 Codegen 部分也需要相应支持：

```ts
function genInterpolation(
  node: InterpolationNode,
  context: CodegenContext,
  option: Required<CompilerOptions>,
) {
  genNode(node.content, context, option)
}

function genCompoundExpression(
  node: CompoundExpressionNode,
  context: CodegenContext,
  option: Required<CompilerOptions>,
) {
  for (let i = 0; i < node.children!.length; i++) {
    const child = node.children![i]
    if (isString(child)) {
      // 字符串情况下直接 push
      context.push(child)
    } else {
      // 其他情况下对节点进行 codegen
      genNode(child, context, option)
    }
  }
}
```

（genInterpolation 变成了简单的 genNode，不过暂且保留它）

## 测试运行

现在，我们已经完成了实现，让我们完成编译器并运行测试！

```ts
// 添加 transformExpression
export function getBaseTransformPreset(): TransformPreset {
  return [[transformElement], { bind: transformBind }] // [!code --]
  return [[transformExpression, transformElement], { bind: transformBind }] // [!code ++]
}
```

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const count = ref(3)
    const getMsg = (count: number) => `Count: ${count}`
    return { count, getMsg }
  },

  template: `
    <div class="container">
      <p> {{ 'Message is "' + getMsg(count) + '"'}} </p>
    </div>
  `,
})

const app = createApp(App)

app.mount('#app')
```

到此为止的源代码: [GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/022_transform_expression) 