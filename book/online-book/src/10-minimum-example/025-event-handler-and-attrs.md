# 实现事件处理器和属性

## 仅仅显示内容还不够

让我们实现一个简单的 props 功能，使其能够处理点击事件和样式。

虽然我们可以直接在 renderVNode 中实现这部分功能，但我们还是想参考 Vue.js 的设计思路来进行。

请注意看 Vue.js 的 runtime-dom 目录。

https://github.com/vuejs/core/tree/main/packages/runtime-dom/src

特别要注意的是 `modules` 目录和 `patchProp.ts` 文件。

modules 目录中包含了用于处理 class、style 和其他 props 操作的文件实现。
https://github.com/vuejs/core/tree/main/packages/runtime-dom/src/modules

而 patchProp.ts 则是将这些功能整合到 patchProp 函数中，并将其混入到 nodeOps 中。

与其用文字解释，不如我们直接基于这个设计来实现。

## 创建 patchProps 的框架

首先创建基本框架。

```sh
pwd # ~
touch packages/runtime-dom/patchProp.ts
```

`runtime-dom/patchProp.ts` 的内容：

```ts
type DOMRendererOptions = RendererOptions<Node, Element>

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    // patchEvent(el, key, value); // 我们即将实现这个
  } else {
    // patchAttr(el, key, value); // 我们即将实现这个
  }
}
```

在 `RendererOptions` 中添加 patchProp 的类型定义：

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement
> {
  // 新增
  patchProp(el: HostElement, key: string, value: any): void;
  .
  .
  .
```

相应地，修改 nodeOps 只使用 patchProps 以外的部分：

```ts
// 省略 patchProp
export const nodeOps: Omit<RendererOptions, "patchProp"> = {
  createElement: (tagName) => {
    return document.createElement(tagName);
  },
  .
  .
  .
```

然后，在 `runtime-dom/index` 中生成 renderer 时也传入 patchProp：

```ts
const { render } = createRenderer({ ...nodeOps, patchProp })
```

## 事件处理器

实现 patchEvent。

```sh
pwd # ~
mkdir packages/runtime-dom/modules
touch packages/runtime-dom/modules/events.ts
```

实现 events.ts：

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

function parseName(rawName: string): string {
  return rawName.slice(2).toLocaleLowerCase()
}

function createInvoker(initialValue: EventValue) {
  const invoker: Invoker = (e: Event) => {
    invoker.value(e)
  }
  invoker.value = initialValue
  return invoker
}
```

虽然代码看起来有点长，但如果分解开来其实很简单。

addEventListener 顾名思义，就是用来注册事件监听器的函数。
虽然实际上需要在适当的时机移除监听器，但这里我们暂时不考虑这个问题。

在 patchEvent 中，我们用 invoker 函数包装监听器来注册。
关于 parseName，它只是简单地将 props 的键名（如 `onClick` 或 `onInput`）转换为去掉 on 的小写形式（如 click, input）。
需要注意的一点是，为了避免对同一个元素重复调用 addEventListener，我们在元素上添加了一个名为 `_vei`（vue event invokers）的属性来存储 invoker。
这样在 patch 时，我们可以通过更新 existingInvoker.value 来更新处理器，而不需要重复调用 addEventListener。
invoker 就是"执行者"的意思，没有特别深的含义，它只是一个用来存储实际要执行的处理器的对象。

接下来，让我们将它整合到 patchProps 中，并在 renderVNode 中使用。

patchProps：

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    patchEvent(el, key, value)
  } else {
    // patchAttr(el, key, value); // 我们即将实现这个
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

    // 这里
    Object.entries(vnode.props).forEach(([key, value]) => {
      hostPatchProp(el, key, value);
    });
    .
    .
    .
```

现在，让我们在 playground 中试试。我们来实现一个简单的警告框：

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

现在我们可以在 h 函数中注册事件处理器了！

![simple_h_function_event](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function_event.png)

## 支持其他 Props

接下来只需要用 setAttribute 做类似的事情。
这部分我们将在 `modules/attrs.ts` 中实现。
这部分建议你自己尝试实现。答案会在本章最后的源代码中提供，你可以在那里查看。
如果能让下面这样的代码运行起来，就算是达到目标了：

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
          style: 'color: blue; font-weight: bold;',
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

如果你能让这样的代码运行起来，就说明你已经成功实现了基本的属性支持！

到目前为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/025_event_handler_and_attrs) 