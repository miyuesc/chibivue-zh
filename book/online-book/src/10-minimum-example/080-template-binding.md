# 数据绑定

## 我希望绑定状态到模板上

在现在这种状态下，我们只能直接操作 DOM 元素，所以是没有办法从响应式系统和虚拟 DOM 中获得什么收益的。
实际上，我还想在模板部分直接编写事件绑定和动态文本，这也是声明式 UI 的乐趣所在。

现在我们的目标是实现这样的一个“开发者界面”。

```ts
import { createApp, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },

  template: `
    <div class="container" style="text-align: center">
      <h2>message: {{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage"> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})

app.mount('#app')
```

我希望能够在模板中使用和处理 `setup` 函数中的返回值。
从现在开始，我将其称为 “模板绑定”，也可以简称为 “绑定”。

注意我说的是 `setup 函数的返回值`，但是现在 `setup` 函数返回的是 `undefined` 或者是一个 `Function` 函数（渲染函数）。

所以在实现绑定之前，还需要先实现能够从 `setup` 函数中得到返回的状态数据并将他们保存为组件状态数据。

```ts
export type ComponentOptions = {
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function | Record<string, unknown> | void // Record<string, unknown> 为了得到返回值
  // .
  // .
  // .
}
```

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  setupState: Data // 如果 setup 的返回结果是对象，则存储在这里
}
```

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  const { props } = instance.vnode
  initProps(instance, props)

  const component = instance.type as Component
  if (component.setup) {
    const setupResult = component.setup(instance.props, {
      emit: instance.emit,
    }) as InternalRenderFunction

    // 判断 setupResult 的类型进入不同的分支
    if (typeof setupResult === 'function') {
      instance.render = setupResult
    } else if (typeof setupResult === 'object' && setupResult !== null) {
      instance.setupState = setupResult
    } else {
      // do nothing
    }
  }
  // .
  // .
  // .
}
```

因此，从现在开始，`setup` 中定义的数据将被称为 `setupState` 。

现在，在实现编译器之前，让我们回顾一下之前是如何将 `setupState` 的绑定到模板上。

在实现编译器之前，我们是通过这种方式将 `setupState` 绑定到模板上的。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    return () => h('div', {}, [state.message])
  },
})
```

嗯，这种方式并不是真正的绑定，而是通过渲染函数形成一个闭包并引用该变量来进行的绑定。

然而，这一次，由于 `setup` 选项和 `render` 渲染函数属于两个不同的概念，我们需要找到一种方法将 `setupState` 传递给渲染函数。


```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    return { state }
  },

  // 这部分被转换为 render 函数
  template: '<div>{{ state.message }}</div>',
})
```

因为 `template` 选项最终会被编译成使用 `h` 函数来实现的渲染函数并赋值到 `instance.render` 上，所以这部分代码相当于下面这种形式：

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    return { state }
  },

  render() {
    return h('div', {}, [state.message])
  },
})
```

当然，变量 `state` 不是在渲染函数中定义的。

现在，我们如何引用状态呢？

## with 语句

结论：您可以使用 `with` 语句执行以下操作：

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    return { state }
  },

  render(ctx) {
    with (ctx) {
      return h('div', {}, [state.message])
    }
  },
})
```

我想有很多人对 `with` 语句不太了解。。

正如预料的那样，此功能已经被弃用了。

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with

根据 MDN 的解释：

> 已弃用: 不再推荐使用该特性。虽然一些浏览器仍然支持它，但也许已从相关的 web 标准中移除，也许正准备移除或出于兼容性而保留。请尽量不要使用该特性，并更新现有的代码；参见本页面底部的兼容性表格以指导你作出决定。请注意，该特性随时可能无法正常工作。

所以，我们通常建议您不要使用它。

我也不知道 Vue.js 未来会怎么样实现这部分功能，但是 Vue.js 3 确实使用了 `with` 语句，所以这次我也会使用 `with` 语句来实现。

顺带说明一下，即使在 Vue.js 中使用了 `with`，但是也不是所有内容都是通过 `with` 实现的。

在处理 `SFC` 中的 `template` 模板时，就没有使用 `with` 语句来实现。

我们会在后面的章节中来讨论这一点。现在，我们先考虑如何通 `with` 语句来实现上述的功能。

---

首先，我们先回顾一下 `with` 语句的作用。`with` 语句会扩展一个语句的作用域链。

效果如下：

```ts
const obj = { a: 1, b: 2 }

with (obj) {
  console.log(a, b) // 1, 2
}
```

即如果我们在 `with` 中传递一个具有 `state` 的数据（父对象），那么我们则可以在 `with` 的作用域内访问这个 `state`（父对象的属性）。

这次，我们将 `setupState` 作为父对象。
在后面的实现中，我们可能不仅需要访问 `setupState`，还需要访问 `props` 数据和 `optionsAPI` 定义的数据。
但是这次，我们只考虑使用 `setupState` 的情况。
（访问非 `setupState` 数据的情况暂时不会在 “最小示例” 这部分讨论，而是在以后得章节中说明）。

今天我们可以借助下面这个模板来实现我们想要的功能。

```html
<div>
  <p>{{ state.message }}</p>
  <button @click="changeMessage">click me</button>
</div>
```

将会被编译成以下函数

```ts
_ctx => {
  with (_ctx) {
    return h('div', {}, [
      h('p', {}, [state.message]),
      h('button', { onClick: changeMessage }, ['click me']),
    ])
  }
}
```

我们将会把 `setupState` 传递给这个函数。

```ts
const setupState = setup()
render(setupState)
```

## 实现 Mustache 语法

首先，我们将实现主要的 Mustache 语法。

像往常一样，我们会先考虑 AST 结构，然后实现解析器，最后实现代码生成器。
目前，我们的 AST 定义的 Node 节点类型只有 Element、Text 和 Attribute。
因为我们目前想重新定义主语法，因此我们可以直接考虑像 `Mustache` 的 AST。
与此相对应的是名为 `interpolation` 的 Node 类型。
它具有“插值”或“插入”等含义。

因此，我们这次要处理的 AST 的节点类型如下：

```ts
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  INTERPOLATION, // 追加

  ATTRIBUTE,
}

export type TemplateChildNode = ElementNode | TextNode | InterpolationNode // 追加的 InterpolationNode

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: string // 写在 Mustache 里面的内容 (在这种情况下，在 setup 中定义的单个变量名称将放在这里)
}
```

现在 AST 的定义已经实现了，所以接下来实现解析器部分。

让我们实现解析 <span v-pre>`{{`</span> 为 Interpolation 插值节点的解析器。

```ts
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[]
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = [];

  while (!isEnd(context, ancestors)) {
    const s = context.source;
    let node: TemplateChildNode | undefined = undefined;

    if (startsWith(s, "{{")) { // 这里
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors);
      }
    }
    // .
    // .
    //
    }
```

```ts
function parseInterpolation(
  context: ParserContext,
): InterpolationNode | undefined {
  const [open, close] = ['{{', '}}']
  const closeIndex = context.source.indexOf(close, open.length)
  if (closeIndex === -1) return undefined

  const start = getCursor(context)
  advanceBy(context, open.length)

  const innerStart = getCursor(context)
  const innerEnd = getCursor(context)
  const rawContentLength = closeIndex - open.length
  const rawContent = context.source.slice(0, rawContentLength)
  const preTrimContent = parseTextData(context, rawContentLength)

  const content = preTrimContent.trim()

  const startOffset = preTrimContent.indexOf(content)

  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset)
  }
  const endOffset =
    rawContentLength - (preTrimContent.length - content.length - startOffset)
  advancePositionWithMutation(innerEnd, rawContent, endOffset)
  advanceBy(context, close.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content,
    loc: getSelection(context, start),
  }
}
```

因为 Text 节点的内容中也有可能出现 <span v-pre>`{{`</span>，所以 `parseText` 也需要一起修改一下。

```ts
function parseText(context: ParserContext): TextNode {
  const endTokens = ['<', '{{'] // 出现 < 或者 {{ 时都结束 parseText 解析

  let endIndex = context.source.length

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  const start = getCursor(context)
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  }
}
```

对于之前已经自己实现过解析器的人来说，这部分应该不是特别困难。
它只是查找 <span v-pre>`{{`</span> 到之后继续遍历，直到读取到 <span v-pre>`}}`</span> 结束然后生成 AST。
如果没有找到 <span v-pre>`}}`</span> 则返回 `undefined` 然后进入到 `parseText` 对应的分支将其作为 Text 节点进行解析。

现在让我们将其输出到浏览器控制台来检查解析是否正确。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },
  template: `
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})
```

![parse_interpolation](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/parse_interpolation.png)

看起来没问题了！

现在，让我们基于这个 AST 来实现数据绑定。
首先用 `with` 语句将渲染函数包裹起来。

```ts
export const generate = ({
  children,
}: {
  children: TemplateChildNode[]
}): string => {
  return `return function render(_ctx) {
  with (_ctx) {
    const { h } = ChibiVue;
    return ${genNode(children[0])};
  }
}`
}

const genNode = (node: TemplateChildNode): string => {
  switch (node.type) {
    // .
    // .
    case NodeTypes.INTERPOLATION:
      return genInterpolation(node)
    // .
    // .
  }
}

const genInterpolation = (node: InterpolationNode): string => {
  return `${node.content}`
}
```

现在，让我们在实际执行 `render` 渲染函数时将 `setupState` 作为参数传递进去。

`~/packages/runtime-core/component.ts`

```ts
export type InternalRenderFunction = {
  (ctx: Data): VNodeChild // 为了能接收 ctx
}
```

`~/packages/runtime-core/renderer.ts`

```ts
const setupRenderEffect = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
) => {
  const componentUpdateFn = () => {
    const { render, setupState } = instance
    if (!instance.isMounted) {
      // .
      // .
      // .
      const subTree = (instance.subTree = normalizeVNode(render(setupState))) // 传递 setupState
      // .
      // .
      // .
    } else {
      // .
      // .
      // .
      const nextTree = normalizeVNode(render(setupState)) // 传递 setupState
      // .
      // .
      // .
    }
  }
}
```

现在，我们应该可以渲染元素了，让我们来试验一下。

![render_interpolation](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/render_interpolation.png)

没问题！这样我们就完成了基础的数据绑定了。

## 第一个指令

接下来，就是事件处理程序了。

```ts
const genElement = (el: ElementNode): string => {
  return `h("${el.tag}", {${el.props
    .map(({ name, value }) =>
      // props 中的 @click 应该转换为 onClick
      name === '@click'
        ? `onClick: ${value?.content}`
        : `${name}: "${value?.content}"`,
    )
    .join(', ')}}, [${el.children.map(it => genNode(it)).join(', ')}])`
}
```

让我们来检查一下它是怎么工作的。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },
  template: `
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage"> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})
```

是的，它改变了！你已经完全做到了！

但我想说的是，这种实现方式还是不够 “干净”，所以我想应该重构一下。

`@click` 现在被归类到了指令的目录下面，所以你很容易想到将来还需要实现 `v-bind`、`v-model` 等指令，所以我们将它命名为 `DIRECTIVE`，以便和简单的 `ATTRIBUTE` 进行区分。

和之前一样，我们还是按照 AST -> parse -> codegen 的顺序来实现。

```ts
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  INTERPOLATION,

  ATTRIBUTE,
  DIRECTIVE, // 追加
}

export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string
  props: Array<AttributeNode | DirectiveNode> // props 是 Attribute 和 DirectiveNode 组成的联合类型数组
  // .
  // .
}

export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  // 指令通常以 v-name:arg="exp" 这样的形式来体现。
  // eg. v-on:click="increment" 应该拆分为 { name: "on", arg: "click", exp="increment" }
  name: string
  arg: string
  exp: string
}
```

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>
): AttributeNode | DirectiveNode {
  // 属性名
  const start = getCursor(context);
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
  const name = match[0];

  nameSet.add(name);

  advanceBy(context, name.length);

  // 属性值
  let value: AttributeValue = undefined;

  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    advanceSpaces(context);
    advanceBy(context, 1);
    advanceSpaces(context);
    value = parseAttributeValue(context);
  }

  // --------------------------------------------------- 从这个位置开始
  // directive
  const loc = getSelection(context, start);
  if (/^(v-[A-Za-z0-9-]|@)/.test(name)) {
    const match =
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name
      )!;

    let dirName = match[1] || (startsWith(name, "@") ? "on" : "");

    let arg = "";

    if (match[2]) arg = match[2];

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value?.content ?? "",
      loc,
      arg,
    };
  }
  // --------------------------------------------------- 到这个位置结束
  // .
  // .
  // .
```

```ts
const genElement = (el: ElementNode): string => {
  return `h("${el.tag}", {${el.props
    .map(prop => genProp(prop))
    .join(', ')}}, [${el.children.map(it => genNode(it)).join(', ')}])`
}

const genProp = (prop: AttributeNode | DirectiveNode): string => {
  switch (prop.type) {
    case NodeTypes.ATTRIBUTE:
      return `${prop.name}: "${prop.value?.content}"`
    case NodeTypes.DIRECTIVE: {
      switch (prop.name) {
        case 'on':
          return `${toHandlerKey(prop.arg)}: ${prop.exp}`
        default:
          // TODO: other directives
          throw new Error(`unexpected directive name. got "${prop.name}"`)
      }
    }
    default:
      throw new Error(`unexpected prop type.`)
  }
}
```

那么，让我们在 playground 中验证一下它的运行吧。

我们现在应该不仅能处理 `@click`，还可以处理 `v-on:click` 以及其他的事件。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'Hello, chibivue!', input: '' })

    const changeMessage = () => {
      state.message += '!'
    }

    const handleInput = (e: InputEvent) => {
      state.input = (e.target as HTMLInputElement)?.value ?? ''
    }

    return { state, changeMessage, handleInput }
  },

  template: `
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage"> click me! </button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})
```

![compile_directives](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/compile_directives.png)

非常棒！我们现在离真正的 Vue 已经非常接近了。

至此，简易模板的解析的实现就完成了。感谢你的努力工作。

当前源代码位于:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/060_template_compiler3)

<!-- 看起来运行正常，所以我们已经完成了刚开始准备编译器实现时划分的三个任务。你做到了！ -->
