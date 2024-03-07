# 小节（休息一下）

## 最简实现示例到此结束！

从本书的最开始，我就提到了这本书会分为几个章节，其中第一个章节 “最简实现示例” 到此就结束了，大家辛苦了。

如果你问我为什么要把它命名成 “章节”，有两个原因。

首先，从这里开始，我们的目标就是让每个章节尽可能不存在互相依赖的情况，加深大家对感兴趣的章节的理解。

如果你对 “虚拟 DOM” 和补丁渲染有兴趣，那你可以直接跳到 “基础虚拟 DOM” 一章，如果你想进一步了解组件系统，你可以直接跳到 “基础组件系统” 一章。
如果你对模板中更加完善和丰富的语法（指令等）有兴趣，你可以直接跳到 “基础模板编译” 一章，如果你对 `Script setup` 和编译语法宏有兴趣，也可以直接跳到 “基础 SFC 编译” 一章。
（当然，如果你有兴趣，你也可以阅读所有的内容）

而且，更重要的是，“最简实现示例” 也是一个非常优秀的章节。
如果你的想法是 “我不需要了解的多么深入，只想有一个完整的系统性的认识”，那么到目前为止，你了解的内容已经差不多了。

（剩下的 “Web Application Essentials 一个 Web 应用的其他必要内容” 一章，由于某些地方与 Vue 的基础实现有关系，所以它和其它几个章节都会有些联系。）

## 到目前为止，我们取得了哪些成就？

最后，让我们回顾一下我们在 “最简实现示例” 一章中所做过的事情，以及我们现在可以做到什么程度。

## 我们开始明白我们看的是什么内容，它在哪个位置

首先，通过 `createApp` 这个最初的开发者接口，我们理解了 ( Web 应用程序的 ) 开发者和 Vue 是怎样联系到一起的。

具体来说，从我们最初所完成的代码开始，到现在我们应该能够理解 Vue 的基础目录结构以及它们各自的依赖关系，以及开发者通常接触到的部分在哪个位置。
现在，让我们来比较一下当前我们的目录结构与 Vue.js 源码的目录结构。

chibivue
![minimum_example_artifacts](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/minimum_example_artifacts.png)

※ Vue.js 的源码目录太大了，截图放不下，所以这里省略掉了。大家可以去 github 仓库查看。

https://github.com/vuejs/core

虽然我们实现的内容很少，但是每个文件的内容和它的作用我们应该都能很好的理解。
我也希望你能阅读 Vue.js 源码中那些我们还没有涉及到的内容（应该可以一点一点的理解清楚）。

## 我们知道了声明式 UI 是怎么实现的

通过实现 `h` 函数，我们也了解了声明式 UI 是怎么实现的。

```ts
// 内部生成 { tag, props, children } 这样的对象，并以此为基础进行 DOM 操作
h('div', { id: 'my-app' }, [
  h('p', {}, ['Hello!']),
  h(
    'button',
    {
      onClick: () => {
        alert('hello')
      },
    },
    ['Click me!'],
  ),
])
```

这也是虚拟 DOM 首次出现的位置

## 了解了什么是响应式系统，以及如何根据它动态更新页面

理解了 Vue 中最独特的部分，即响应式系统到底是什么，以及它是通过什么实现的。

```ts
const targetMap = new WeakMap<any, KeyToDepMap>()

function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, {
    get(target: object, key: string | symbol, receiver: object) {
      track(target, key)
      return Reflect.get(target, key, receiver)
    },

    set(
      target: object,
      key: string | symbol,
      value: unknown,
      receiver: object,
    ) {
      Reflect.set(target, key, value, receiver)
      trigger(target, key)
      return true
    },
  })
}
```

```ts
const component = {
  setup() {
    const state = reactive({ count: 0 }) // create proxy

    const increment = () => {
      state.count++ // trigger
    }

    ;() => {
      return h('p', {}, `${state.count}`) // track
    }
  },
}
```

## 知道了什么是虚拟 DOM，它有什么好处，以及怎么实现虚拟 DOM

作为改善使用 `h` 函数进行渲染的方式，我们通过比较的方式理解了如何使用虚拟 DOM 来进行高效的渲染。

```ts
// 虚拟 DOM 的接口类型定义
export interface VNode<HostNode = any> {
  type: string | typeof Text | object
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined
}

// まず、render関数が呼ばれる
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  // 第一次渲染 n1 为 null。在这种情况下，在各节点对应 process 方法中执行 mount
  patch(null, vnode, container)
}

const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else if (typeof type === 'string') {
    processElement(n1, n2, container)
  } else if (typeof type === 'object') {
    processComponent(n1, n2, container)
  } else {
    // do nothing
  }
}

// 第二次及以后的更新，通过将上一个 VNode 和当前 VNode 传递给 patch 函数来更新差异部分
const nextVNode = component.render()
patch(prevVNode, nextVNode)
```

## 了解了组件的结构，以及组件之间的交互是怎么实现的

```ts
export interface ComponentInternalInstance {
  type: Component

  vnode: VNode
  subTree: VNode
  next: VNode | null
  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void

  propsOptions: Props
  props: Data
  emit: (event: string, ...args: any[]) => void

  isMounted: boolean
}
```

```ts
const MyComponent = {
  props: { someMessage: { type: String } },

  setup(props: any, { emit }: any) {
    return () =>
      h('div', {}, [
        h('p', {}, [`someMessage: ${props.someMessage}`]),
        h('button', { onClick: () => emit('click:change-message') }, [
          'change message',
        ]),
      ])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(
          MyComponent,
          {
            'some-message': state.message,
            'onClick:change-message': changeMessage,
          },
          [],
        ),
      ])
  },
})
```

## 了解了编译器是什么，以及模板编译是怎么实现的

我们知道了编译器是什么东西。
并且通过实现模板编译器，我们了解了如何实现更加接近原始 HTML 语法的模板，以及如何实现 Vue.js 特定的功能，例如 Mustache 插值语法等。

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

## 通过 Vite 插件了解了 SFC 编译器的实现方法。

通过已经实现的模板编译器，了解了如何在 Vite 中使用它将 SFC 中的 `script`、`template`、`style` 几个部分重新编译组合到一个文件中。

我们还了解了 vite 插件的实现，以及 `transform` 选项和虚拟模块的用途和用法。

```vue
<script>
import { reactive } from 'chibivue'

export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!', input: '' })

    const changeMessage = () => {
      state.message += '!'
    }

    const handleInput = e => {
      state.input = e.target?.value ?? ''
    }

    return { state, changeMessage, handleInput }
  },
}
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>{{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      alt="Vue.js Logo"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>

    <br />

    <label>
      Input Data
      <input @input="handleInput" />
    </label>

    <p>input value: {{ state.input }}</p>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

## 关于今后的展望

从现在开始，我们会更加详细地研究 Vue.js 的每一个组成部分，因为我希望能将 Chibivue 变得更加实用和完整。

同样的，后面的每一个章节中的代码实现我也都会从 “最简实现示例” 中的最后一个源代码实现开始。

然后，我会解释我们在每一个章节需要做的事情，以及怎么实现。

## 我们该怎么做？

这里和本书的开头会有点儿重复。

从这里开始，我们会分为 5 个章节加上一个附录。

- Basic Virtual DOM 章节（基础虚拟 DOM）
  - 调度器的实现
  - 实现目前还不支持的更新程序 (主要针对属性)
  - 实现 Fragment
- Basic Reactivity System 章节（基础响应式系统）
  - ref api
  - computed api
  - watch api
- Basic Component System 章节（基础组件系统）
  - provide/inject
  - lifecycle hooks
- Basic Template Compiler 章节（基础模板编译器）
  - v-on
  - v-bind
  - v-for
  - v-model
- Basic SFC Compiler 章节（基础 SFC 编译器）
  - SFC 的基础原理
  - script setup
  - compiler macro
- Web Application Essentials 章节 (附录：一个 Web 应用的其他必要内容)

  本章节为附录。主要实现在 Web 开发中经常与 Vue 一起使用的库。
  该章节在某种程度上依赖于其他章节的内容。
  当然，从这个章节开始，根据内容需要在其他章节做必要的改动也是没有问题，但有可能有点难以理解。

  - store
  - route

  我们将在附录章节实现上述的两个库，但是如果你有其他的想法，也可以在这里实现它。

## 主要思想（Policy）

在 “最简实现示例” 一章中，我们已经详细得解释了实现的过程。
对于已经实现了这一章的内容的人来说，你现在应该已经可以阅读 Vue.js 的源代码了。
因此，在以后的章节中，我将会把代码解释限制在一个大概能解释清楚的程度上，你需要在阅读源代码的同时进行思考并且自己尝试实现。
（这并不是说我厌烦了写详细的解释，或者类似的东西）

虽然阅读这本书并且按照书中的样子去实现是非常有趣的事情，但是一旦理解到了一定程度，尝试自己去实现应该是更加有趣的事情，并且我认为这会给你带来更加深入的理解。

从这一点来看，这本书应该看做是一个主要思想，核心内容还是在 Vue.js 的源代码当中。
