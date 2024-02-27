# 实现 HTML 元素的渲染

## 什么是 h 函数？

到目前为止，我们下面的代码已经可以运行了。

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

这只是一个简单讲 `Hello World.` 这串文字渲染到浏览器上的函数。
但是只渲染这么一条消息肯定是很无聊的，所以我们需要考虑怎么将一个 HTML 元素渲染到画面上。
这就是需要 h 函数来发挥作用的时候了。
这里的 h 是 `hyperscript` 的简写（Hyper Text Markup Language），即为了在 JS 中实现 HTML 的编写。

> h() is short for hyperscript - which means "JavaScript that produces HTML (hypertext markup language)". This name is inherited from conventions shared by many Virtual DOM implementations. A more descriptive name could be createVnode(), but a shorter name helps when you have to call this function many times in a render function.
> 
> 翻译：`h()` 是 hyperscript 的简写，意思是“用于生成 HTML（超文本标记语言）的 JavaScript”。这个名称继承了很多虚拟 DOM 的实现中共有的很多约定。
> 实际上，对其更加准确的描述应该是 `createVnode()`，但是通常我们需要在一个渲染函数中的很多地方使用这个函数，所以更加简短的名称显然更加有帮助。

引用: https://vuejs.org/guide/extras/render-function.html#creating-vnodes


Vue.js 中 h 函数是怎么使用的？

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['HelloWorld']),
      h('button', {}, ['click me!']),
    ])
  },
})

app.mount('#app')
```

使用 h 函数的基本使用方法是将标签名称作为第一个参数，将属性作为第二个参数，将子元素数组作为第三个参数。
为什么说是“基本使用方法”？是因为 h 函数还有很多种使用方式，例如省略第二个参数或者不传递子元素数组等。
但是，这里我想先按照最基本的使用方法来实现 h 函数。

## 如何实现？ 🤔

现在我们肯定已经对这个方法的接口（参数定义）有了一定的了解，那么我们来思考该如何实现它。
需要注意的是，我们会将这个函数的返回值作为 render 函数的参数。
这也意味着，h 函数的返回值会在 Vue.js 的内部被使用。
当然，如果在刚开始我们就是用复杂的子元素结构的话可能会难以理解，所以我们从最简单的 h 函数使用开始。。

```ts
const result = h('div', { class: 'container' }, ['hello'])
```

result 的结果会是怎么样的呢？（我们应该怎样去处理这个结果并且渲染它？）

加上 result 包含的是以下的内容：

```ts
const result = {
  type: 'div',
  props: { class: 'container' },
  children: ['hello'],
}
```

换句话说，我们需要在 render 函数中实现一个“接收这种格式的参数并根据它来通过 DOM 将它对应内容渲染出来”。
也就是下面这种场景（crateApp 方法中的 mount 方法）。

```ts
const app: App = {
  mount(rootContainer: HostElement) {
    const node = rootComponent.render!()
    render(node, rootContainer)
  },
}
```

很明显，这里的唯一的变化就是将之前的 `message` 文本字符串改为了一个 `node` 节点对象。
现在，我们要做的就是在 render 函数中根据这个对象来进行 DOM 操作。

实际上，这个对象有一个名字：Virtual DOM，也就是虚拟 DOM。
当然虚拟 DOM 在后面的章节中有专门的介绍，这里我们只需要记住这个对象名字就行了。

## 实现 h 函数

首先，我们创建对应的文件：

```sh
pwd # ~
touch packages/runtime-core/vnode.ts
touch packages/runtime-core/h.ts
```

然后我们只需要在 vnode.ts 中定义相关的类型

```ts
export interface VNode {
  type: string
  props: VNodeProps
  children: (VNode | string)[]
}

export interface VNodeProps {
  [key: string]: any
}
```

接下来，就需要在 h.ts 中实现 h 函数的本体了。

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return { type, props, children }
}
```

现在，让我们在 playground 中验证一下 h 函数。

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

虽然现在在画面上不会显示任何内容了。
但是如果我们在 createApp 的方法中添加一个日志打印，就可以看到目前的运行情况是符合我们的预期的。

```ts
mount(rootContainer: HostElement) {
  const vnode = rootComponent.render!();
  console.log(vnode); // 打印日志
  render(vnode, rootContainer);
},
```

现在，让我们来实现 render 函数的具体逻辑。
当然，我们首先要在 `RendererOptions` 中实现 `createElement`、 `createText` 和 `insert` 这几个方法。

```ts
export interface RendererOptions<HostNode = RendererNode> {
  createElement(type: string): HostNode // 追加

  createText(text: string): HostNode // 追加

  setElementText(node: HostNode, text: string): void

  insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void // 追加
}
```

然后，在 render 函数中尝试实现 `renderVNode` 方法（暂时先忽略 Props 的实现）。

```ts
export function createRenderer(options: RendererOptions) {
  const {
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
  } = options

  function renderVNode(vnode: VNode | string) {
    if (typeof vnode === 'string') return hostCreateText(vnode)
    const el = hostCreateElement(vnode.type)

    for (const child of vnode.children) {
      const childEl = renderVNode(child)
      hostInsert(childEl, el)
    }

    return el
  }

  const render: RootRenderFunction = (vnode, container) => {
    const el = renderVNode(vnode)
    hostInsert(el, container)
  }

  return { render }
}
```

runtime-dom 中的 nodeOps 也需要根据 DOM 提供的 API 来实现 RendererOptions 中定义的几个方法。

```ts
export const nodeOps: RendererOptions<Node> = {
  // 追加
  createElement: tagName => {
    return document.createElement(tagName)
  },

  // 追加
  createText: (text: string) => {
    return document.createTextNode(text)
  },

  setElementText(node, text) {
    node.textContent = text
  },

  // 追加
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
}
```

现在，应该就可以在画面上显示相应的内容了。
让我们用 playground 写一些东西来验证一下!

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['Hello world.']),
      h('button', {}, ['click me!']),
    ])
  },
})

app.mount('#app')
```

Nice！现在我们就可以使用 h 函数来渲染不同的 HTML 标签了。

![](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/simple_h_function.png)

## 只是显示是远远不够的

现在我们已经完成了元素的显示，借此机会，我们可以接着实现 props 部分的处理，以便我们能使用元素样式和事件。

虽然这部分我们也可以直接在 renderVNode 方法里面实现，但是最好还是遵循我们最初的代码设计来继续进行。

请大家将注意力转移到 Vue.js 的 runtime-dom 目录上。

https://github.com/vuejs/core/tree/main/packages/runtime-dom/src

特别需要主要的是 `modules.ts` 和 `patchProp.ts` 两个文件。

在 module 目录中，有一些用于操作 class 类、样式和其他属性的文件。 https://github.com/vuejs/core/tree/main/packages/runtime-dom/src/modules

这些会在 patchProp.ts 中组合到一个 patchProp 的函数中，然后这个函数会被整合到 nodeOps 对象里面。

这部分比较难以用语言来完美地解释，所以我们会根据这个设计来实现对应的代码，希望大家能从代码中进行理解。

## 创建 patchProps

首先先创建一个 patchProps.ts 文件。

```sh
pwd # ~
touch packages/runtime-dom/patchProp.ts
```

`runtime-dom/patchProp.ts` の内容

```ts
type DOMRendererOptions = RendererOptions<Node, Element>

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    // patchEvent(el, key, value); // 现在需要实现的
  } else {
    // patchAttr(el, key, value); // 现在需要实现的
  }
}
```

因为目前 `RendererOptions` 中没有 patchProp 的类型定义，所以我们需要加上。

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement
> {
  // 追加
  patchProp(el: HostElement, key: string, value: any): void;
  .
  .
  .
```

同时，需要将 nodeOps 修改成使用 `RendererOptions` 中除了 patchProp 之外的那部分。

```ts
// patchPropをomitする
export const nodeOps: Omit<RendererOptions, "patchProp"> = {
  createElement: (tagName) => {
    return document.createElement(tagName);
  },
  .
  .
  .
```

然后，在 `runtime-dom/index` 的 renderer 创建函数中，将 patchProp 也一起传递进去。

```ts
const { render } = createRenderer({ ...nodeOps, patchProp })
```

## 事件处理

现在开始实现 patchEvent。

```sh
pwd # ~
mkdir packages/runtime-dom/modules
touch packages/runtime-dom/modules/events.ts
```

首先实现 event.ts。

```ts
interface Invoker extends EventListener {
  value: EventValue
}

type EventValue = Function

export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
) {
  el.addEventListener(event, handler)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
) {
  el.removeEventListener(event, handler)
}

export function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  value: EventValue | null,
) {
  // vei = vue event invokers
  const invokers = el._vei || (el._vei = {})
  const existingInvoker = invokers[rawName]

  if (value && existingInvoker) {
    // patch
    existingInvoker.value = value
  } else {
    const name = parseName(rawName)
    if (value) {
      // add
      const invoker = (invokers[rawName] = createInvoker(value))
      addEventListener(el, name, invoker)
    } else if (existingInvoker) {
      // remove
      removeEventListener(el, name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}

function parseName(rowName: string): string {
  return rowName.slice(2).toLocaleLowerCase()
}

function createInvoker(initialValue: EventValue) {
  const invoker: Invoker = (e: Event) => {
    invoker.value(e)
  }
  invoker.value = initialValue
  return invoker
}
```

虽然代码有点儿多，但是拆分成几个部分来理解就很简单了。

顾名思义，`addEventListener` 是一个用来注册监听器的函数。
当然，实际上，在合适的时机去移除监听器是非常有必要的，但是目前我们还不需要太过注意这部分内容。

在 `patchEvent` 函数中，我们会将绑定的事件函数封装到 `invoker` 中，然后再通过 `addEventListener` 这个注册监听器。

对于 `parseName` 函数，就是单纯的将 `props` 中的事件绑定属性（就是 `onClick`、`onInput`）去掉前面的 `on` 并转换为小写。

值得注意的一点是，在 `patchEvent` 中需要在 Element 元素上创建一个 `_vei` 的事件调用处理函数对象，增加一个已有事件的对比判断，这样就不会给同一个元素多次注册相同的事件处理。

这样做也可以在 patch 更新阶段，直接更新 `existingInvoker.value` 来更新事件处理函数，而不是再次调用 `addEventListener` 来重新注册。

现在我们将这部分内容合并到 `patchProps` 中，与 `renderVNode` 一起使用。

patchProps：

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    patchEvent(el, key, value)
  } else {
    // patchAttr(el, key, value); // 需要实现
  }
}
```

runtime-core/renderer.ts 中的 renderVNode：

```ts
  const {
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
  } = options;
  .
  .
  .
  function renderVNode(vnode: VNode | string) {
    if (typeof vnode === "string") return hostCreateText(vnode);
    const el = hostCreateElement(vnode.type);

    // 这里增加以下内容
    Object.entries(vnode.props).forEach(([key, value]) => {
      hostPatchProp(el, key, value);
    });
    .
    .
    .
```

然后，我们在 playground 中使用一下，就简单的显示一个提示消息吧。

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['Hello world.']),
      h(
        'button',
        {
          onClick() {
            alert('Hello world!')
          },
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

现在已经可以使用 h 函数来处理事件绑定了。

![simple_h_function_event](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/simple_h_function_event.png)

## 尝试支持其他的 props 内容

接下来就是在 `setAttribute` 中实现类似的内容。

我们可以创建 `modules/attrs.ts` 并在这里实现这个方法。
大家可以尝试自己实现一下。答案可以参考本章最后的源代码部分。

实现的目标是让下面的这部分代码可以正常的工作。

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', { id: 'my-app' }, [
      h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
      h(
        'button',
        {
          onClick() {
            alert('Hello world!')
          },
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

![simple_h_function_attr](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/simple_h_function_attr.png)

现在，我们就可以处理很多的 HTML 元素和属性了。

到此为止的所有源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/020_simple_h_function)
