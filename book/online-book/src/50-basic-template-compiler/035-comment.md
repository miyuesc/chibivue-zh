# 实现注释功能

## 目标开发者接口

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `
  <!-- this is header. -->
  <header>header</header>

  <!-- 
    this is main.
    main content is here!
  -->
  <main>main</main>

  <!-- this is footer -->
  <footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

这个功能不需要特别说明。

## AST和解析器实现

关于如何实现注释，乍看之下似乎可以在解析时直接忽略它们。

但是，Vue的注释会被原样输出到HTML中。

这意味着我们需要渲染注释，因此需要在VNode中表示它们，编译器也需要生成相应的代码，  
并且还需要实现创建注释节点的操作。

首先让我们实现AST和解析器。

### AST

```ts
export const enum NodeTypes {
  // .
  // .
  COMMENT,
  // .
  // .
  // .
}

export interface CommentNode extends Node {
  type: NodeTypes.COMMENT
  content: string
}

export type TemplateChildNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | CommentNode
```

### 解析器

对于错误处理，暂时使用throw。

```ts
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[],
): TemplateChildNode[] {
  // .
  // .
  // .
  if (startsWith(s, '{{')) {
    node = parseInterpolation(context)
  } else if (s[0] === '<') {
    if (s[1] === '!') {
      // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
      if (startsWith(s, '<!--')) {
        node = parseComment(context)
      }
    } else if (/[a-z]/i.test(s[1])) {
      node = parseElement(context, ancestors)
    }
  }
  // .
  // .
  // .
}

function parseComment(context: ParserContext): CommentNode {
  const start = getCursor(context)
  let content: string

  // 普通注释
  const match = /--(\!)?>/.exec(context.source)
  if (!match) {
    content = context.source.slice(4)
    advanceBy(context, context.source.length)
    throw new Error('EOF_IN_COMMENT') // TODO: 错误处理
  } else {
    if (match.index <= 3) {
      throw new Error('ABRUPT_CLOSING_OF_EMPTY_COMMENT') // TODO: 错误处理
    }
    if (match[1]) {
      throw new Error('INCORRECTLY_CLOSED_COMMENT') // TODO: 错误处理
    }
    content = context.source.slice(4, match.index)

    const s = context.source.slice(0, match.index)
    let prevIndex = 1,
      nestedIndex = 0
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1)
      if (nestedIndex + 4 < s.length) {
        throw new Error('NESTED_COMMENT') // TODO: 错误处理
      }
      prevIndex = nestedIndex + 1
    }
    advanceBy(context, match.index + match[0].length - prevIndex + 1)
  }

  return {
    type: NodeTypes.COMMENT,
    content,
    loc: getSelection(context, start),
  }
}
```

## 生成代码

在runtime-core中添加表示Comment的VNode。

```ts
export const Comment = Symbol()
export type VNodeTypes =
  | string
  | Component
  | typeof Text
  | typeof Comment
  | typeof Fragment
```

实现createCommentVNode函数并作为helper公开。

在codegen中生成调用createCommentVNode的代码。

```ts
export function createCommentVNode(text: string = ''): VNode {
  return createVNode(Comment, null, text)
}
```

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    // .
    // .
    // .
    case NodeTypes.COMMENT:
      genComment(node, context)
      break
    // .
    // .
    // .
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  const { push, helper } = context
  push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node)
}
```

## 渲染实现

接下来实现renderer部分。

像往常一样，在patch函数中添加处理Comment的分支，在mount时创建注释。

对于patch过程，由于注释是静态的，所以不需要特别处理（代码中只是直接赋值）。

```ts
const patch = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  const { type, ref, shapeFlag } = n2
  if (type === Text) {
    processText(n1, n2, container, anchor)
  } else if (type === Comment) {
    processCommentNode(n1, n2, container, anchor)
  } //.
  //.
  //.
}

const processCommentNode = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  if (n1 == null) {
    hostInsert(
      (n2.el = hostCreateComment((n2.children as string) || '')), // 需要在nodeOps中实现hostCreateComment！
      container,
      anchor,
    )
  } else {
    n2.el = n1.el
  }
}
```

到此为止，注释功能应该已经实现了。让我们来测试一下实际效果！

完整源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/035_comment) 