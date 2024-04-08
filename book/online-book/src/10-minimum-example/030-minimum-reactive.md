# 简易的响应式系统

## 这次我们需要开发的内容

从现在开始，我们将讨论 Vue.js 最核心的部分，也就是 `Reactivity System` 响应式系统。

之前我们实现的内容，只是使用起来像 Vue.js，但是它只有显示 HTML 元素的功能，这种实现完全不能算是 Vue.js。

也就是说我们之前实现的“开发者界面”，只能显示各种 HTML 元素，但是只要它已经被渲染出来之后，它就不会再发生任何的改变，只是一个完全静态的站点。

所以从现在开始，为了构建更加丰富且动态的 UI 界面，我们需要添加一个“状态”，并且在状态发生变化时更新界面显示。

首先，让我们先想象一下这部分开发的内容在使用时应该是什么样子。
是不是想下面这样？

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })

    const increment = () => {
      state.count++
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

这段代码对于平时使用 SFC 模式进行开发的开发人员来说可能有点陌生。
而这是一个具有 `setup` 选项来保存状态并返回一个执行 h 函数的渲染函数。
但是实际上 Vue.js 是支持这种使用方式的：
https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

在这段代码中，我们使用 `reactive` 来定义了一个状态，并且创建了一个 `increment` 函数来修改这个状态，并且将这个函数绑定到了按钮的 `click` 事件上。

总结一下我们需要完成的内容：
- 执行 `setup` 函数，并得到其执行 h 函数的返回函数
- 通过 `reactive` 函数来实现响应式对象
- 点击按钮时，更新数据状态
- 通过跟踪数据的状态变化，重新执行渲染函数并更新页面显示

## 什么是响应式系统？

让我们来回顾一下什么是响应式。
我们可以参考一下官方文档。

> 响应式对象是 JavaScript 代理，其行为就和普通对象一样。不同的是，Vue 能够拦截对响应式对象所有属性的访问和修改，以便进行依赖追踪和触发更新

[引用自：Vue/响应式基础/reactive](https://cn.vuejs.org/guide/essentials/reactivity-fundamentals#reactive)

> Vue 最标志性的功能就是其低侵入性的响应式系统。组件状态都是由响应式的 JavaScript 对象组成的。当更改它们时，视图会随即自动更新。

[引用自：Vue/深入响应式系统](https://cn.vuejs.org/guide/extras/reactivity-in-depth.html)

总而言之，响应式对象在状态发生变化时也会同时更新屏幕显示。
让我们暂时先忽略这部分，先实现之前提到的其他内容。

## 实现 setup 函数选项

这部分内容很简单。
我们只需要接收一个 `setup` 选项，然后执行它，得到渲染函数然后按照 render 一样的处理方式来处理它。

在 ~/packages/runtime-core/componentOptions.ts 中声明类型。

```ts
export type ComponentOptions = {
  render?: Function
  setup?: () => Function // 追加
}
```

然后修改下面的这些代码。

```ts
// createAppAPI

const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    updateComponent()
  },
}
```

```ts
// playground

import { createApp, h } from 'chibivue'

const app = createApp({
  setup() {
    // 在这里定义状态
    // const state = reactive({ count: 0 })

    return function render() {
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
    }
  },
})

app.mount('#app')
```

这样就差不多了。
后面的内容实际上是希望在状态变更时执行 `updateComponent` 函数。

## Proxy 对象代理

这次的核心主题是，希望在状态发生改变时以某种方式执行 `updateComponent` 函数。

其中的关键就是 Proxy 对象代理。

首先，不需要先忙着实现响应式系统，我先解释一下什么是 Proxy。

https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy 是一个非常有趣的内容。
它接收一个对象参数并通过 `new` 关键字来创建一个代理对象。

例如：

```ts
const o = new Proxy({ value: 1 }, {})
console.log(o.value) // 1
```

在这个例子中，代理对象 `o` 与普通对象的行为非常相似。

有趣的是，Proxy 接收第二参数，允许您自定义代理处理程序。

这个处理程序是什么呢？
它是用来操作源对象的程序。

例如：

```ts
const o = new Proxy(
  { value: 1, value2: 2 },

  {
    get(target, key, receiver) {
      console.log(`target:${target}, key: ${key}`)
      return target[key]
    },
  },
)
```

在这个例子中，我们自定义了代理对象的 `get` 操作。

也就是说，当访问（读取）这个对象的属性时，原始对象（target）和我们访问的对象属性（key） 都会被输出到控制台中。
我们可以在浏览器的控制台中检查这个操作。

![proxy_get](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/proxy_get.png)

可以看到，当我们通过 Proxy 生成的代理对象来访问对象属性时，就会执行 get 设置的方法。

同样的，我们也可以设置 set 对应的处理。

```ts
const o = new Proxy(
  { value: 1, value2: 2 },
  {
    set(target, key, value, receiver) {
      console.log('hello from setter')
      target[key] = value
      return true
    },
  },
)
```

![proxy_set](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/proxy_set.png)

暂时，我们将 Proxy 了解到这个程度就可以了。
····

## Proxy 实现响应式系统

::: warning
2023 年 12 月月底 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布了，其中包括了 [reactivity 的性能优化](https://github.com/vuejs/core/pull/5912) 部分。  
需要注意的是，本书参考的是 Vue.js 之前的实现方式。  
本章内容不会有太大改变，但是文件结构可能略有调整，代码也有部分改动。
我也会在日后对这本书进行相应的更新。  
:::

再次明确一下，我们这次的目的是实现“当数据状态发生改变时执行 `updateComponent` 更新页面视图”。
现在我们来分析以下怎么使用 Proxy 来实现这个过程。

首先，Vue.js 的整个响应式系统包括 `target`, `Proxy`, `ReactiveEffect`, `Dep`, `track`, `trigger`, `targetMap`, `activeEffect` 几个部分。

我们先了解一下 `targetMap` 的格式。
顾名思义，`targetMap` 是一个 Map 对象，是目标对象 target 的属性 key 与依赖对象 dep 的映射关系。
如果我们将 target 作为我们需要进行响应式处理的对象，那么 dep 就是我们需要在目标属性改变时执行的操作（函数）。

体现为代码的话，就是如下的形式：

```ts
type Target = any // 任意对象
type TargetKey = any // target 的任何一个 key

const targetMap = new WeakMap<Target, KeyToDepMap>() // 定义为当前模块中的全局变量

type KeyToDepMap = Map<TargetKey, Dep> // target 中 key 与 dep 组成的 Map 对象

type Dep = Set<ReactiveEffect> // dep 有多个叫做 Reactive Effect 的东西

class ReactiveEffect {
  constructor(
    // 发生改变时我们实际希望执行的操作函数（当前就是 updateComponent）
    public fn: () => T,
  ) {}
}
```

TargetMap 的基本结构大概就是这个样子了。现在我们需要考虑的是怎么创建这个 TargetMap（怎么注册）以及怎么去执行操作函数。

这里就需要提出 `track` 和 `trigger` 两个概念了。

顾名思义，`track` 就是注册 `targetMap` 与操作函数，而 `trigger` 则是从 `targetMap` 中找到对应的操作函数并执行它。

```ts
export function track(target: object, key: unknown) {
  // ..
}

export function trigger(target: object, key?: unknown) {
  // ..
}
```

而 `track` 和 `trigger` 这两个操作分别是在 Proxy 的 get 和 set 中执行的。

```ts
const state = new Proxy(
  { count: 1 },
  {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  },
)
```

而生成这个 Proxy 代理对象的就是我们的 reactive 函数。

```ts
function reactive<T>(target: T) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  })
}
```

![reactive](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive.drawio.png)

当然，通过这个图我们会注意到目前我们还差了一个元素。
也就是说“在 `track` 过程中我们应该向 `targetMap` 中注册哪个操作函数？”。
答案就是 `activeEffect`。
`activeEffect` 与 `targetMap` 一样，都是一个模块中的全局变量，基于类型 `ReactiveEffect`，由 `run` 方法随时控制当前执行的 `activeEffect` 具体内容。

```ts
let activeEffect: ReactiveEffect | undefined

class ReactiveEffect {
  constructor(
    // 发生改变时我们实际希望执行的操作函数（当前就是 updateComponent）
    public fn: () => T,
  ) {}

  run() {
    activeEffect = this
    return this.fn()
  }
}
```

至于它的原理，我们可以想象假设有这样一个组件：

```ts
{
  setup() {
    const state = reactive({ count: 0 });
    const increment = () => state.count++;

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h(
          "button",
          {
            onClick: increment,
          },
          ["increment"]
        ),
      ]);
    };
  },
}
```

然后，在内部会形成如下代码结构：

```ts
// chibivue 的内部实现
const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    const effect = new ReactiveEffect(updateComponent)
    effect.run()
  },
}
```

让我们一步一步的进行解释：

首先，执行 `setup` 函数。
此时，会先生成一个响应式代理对象 `state`，也就是说，这个代理对象执行任何读写操作，都会按照我们之前设置的方法执行。

```ts
const state = reactive({ count: 0 }) // proxy 生成
```

然后，会将 `updateComponent` 传递给 `ReactiveEffect` 生成一个操作对象（Observer 观察者端）。

```ts
const effect = new ReactiveEffect(updateComponent)
```

其中 `updateComponent` 这个函数使用的是 `componentRender`，也就是 `setup` 返回的 `render` 函数，并且这个 `render` 函数中还依赖了我们之前声明的代理对象。

```ts
function render() {
  return h('div', { id: 'my-app' }, [
    h('p', {}, [`count: ${state.count}`]), // 依赖由 reactive 创建的 proxy 代理对象
    h(
      'button',
      {
        onClick: increment,
      },
      ['increment'],
    ),
  ])
}
```

当这个函数实际执行的时候，就会读取 `state.count` 属性，执行 `getter` 函数，然后再执行 `track`。

这种情况下，当我们新建的 `effect` 对象运行时：

```ts
effect.run()
```

它会将 `activeEffect` 对应的事件处理函数设置为 `updateComponent`。
由于之前在 `track` 阶段已经将 `state.count` 与 `updateComponent` 之间的映射关系保存到了 `targetMap` 中，这时就形成了完整的响应处理方案。

现在，我们需要考虑当 `increment` 执行导致状态改变时会发生什么。

在 `increment` 方法中，由于修改了 `state.count`，会触发 `setter` 执行，从而执行 `trigger`。
而 `trigger` 方法会从 `targetMap` 中根据 `state` 和 `count` 找到状态变化对应的响应函数 `effect`（这里也就是 `updateComponent` 函数），然后执行这个 `effect`。

这样就完整地实现了响应式。

这么说起来可能很复杂，我用下面这张图来概括一下。

![reactivity_create](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactivity_create.drawio.png)

## 根据这些来完整地实现响应式系统

实际上，响应式系统中最难以理解的就是上面的内容，只要我们理解了这些内容，我们接下来要做的就是编写代码了。
但是话虽如此，肯定还是有很多人仅凭上面的内容还是难以理解。
如果是这样的话，我希望我们在这里去实现它的同时，也能根据编写的代码一起去回顾前面的内容。

首先，我们需要创建一些必要的文件，这些文件也在 `packages/reactivity` 的目录下。
并且我也会尽量与 Vue.js 的源码结构保持一致。

```sh
pwd # ~
mkdir packages/reactivity

touch packages/reactivity/index.ts

touch packages/reactivity/dep.ts
touch packages/reactivity/effect.ts
touch packages/reactivity/reactive.ts
touch packages/reactivity/baseHandler.ts
```

如上所示，index.ts 中只是通过 export 导出 reactivity 内部的内容，所以不会做详细说明。
如果你需要在外面使用 reactivity 中的内容，就需要在这里对它进行导出。

dep.ts 的内容如下：

```ts
import { type ReactiveEffect } from './effect'

export type Dep = Set<ReactiveEffect>

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep: Dep = new Set<ReactiveEffect>(effects)
  return dep
}
```

虽然在这之前 effect 还没有定义，但是我们马上就会实现它了。

接下来是 effect.ts 的内容：

```ts
import { Dep, createDep } from './dep'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {
    // ※ 保存之前绑定的 fn 函数，确保执行完成之后能恢复到之前的 activeEffect
    // 如果不这么处理的话，activeEffect 就会不停地被覆盖，导致一些意想不到的问题（所以最好还是恢复成原样）
    let parent: ReactiveEffect | undefined = activeEffect
    activeEffect = this
    const res = this.fn()
    activeEffect = parent
    return res
  }
}

export function track(target: object, key: unknown) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  if (activeEffect) {
    dep.add(activeEffect)
  }
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)

  if (dep) {
    const effects = [...dep]
    for (const effect of effects) {
      effect.run()
    }
  }
}
```

关于 track 和 trigger 的内容不会再做太多解释，因为他们就是单纯的注册 `targetMap` 或者从 `targetMap` 中查询操作并执行。

接下来是 baseHandler.ts。这里会定义一个 Proxy 代理的操作处理程序。
当然，你也可以直接用 reactive 来实现，但是为了保持与源码的结构一致，我这里会参考它的实现方式实现。

实际上，Vue.js 还有很多种代理方式，例如只读（readonly）代理和浅（shallow）代理，所以我们的想法是都在这里实现这些代理对应的处理函数（但是现在还不需要这么做）。

```ts
import { track, trigger } from './effect'
import { reactive } from './reactive'

export const mutableHandlers: ProxyHandler<object> = {
  get(target: object, key: string | symbol, receiver: object) {
    track(target, key)

    const res = Reflect.get(target, key, receiver)
    // 如果是object的话，可以进行 reactive (这样，嵌套的对象也可以进行代理。)
    if (res !== null && typeof res === 'object') {
      return reactive(res)
    }

    return res
  },

  set(target: object, key: string | symbol, value: unknown, receiver: object) {
    let oldValue = (target as any)[key]
    Reflect.set(target, key, value, receiver)
    // 检查一下值是否发生了变化
    if (hasChanged(value, oldValue)) {
      trigger(target, key)
    }
    return true
  },
}

const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)
```

注意，这里出现了一个新角色 —— Reflect。它与 Proxy 类似，但是 Proxy 是为对象生成了一个具有拦截操作的代理对象，而 Reflect 则是纯粹的通过指定方式操作对象。

Proxy 和 Reflect 都是 JS 引擎中用于处理对象相关的 API，与我们平时使用对象的方式相比，允许您执行元编程。
您可以执行各种元操作，例如控制对象的更改、对象属性的读取以及检查 key 是否存在。

目前，我们只需要理解为：Proxy = 创建对象对应的元操作代理对象，Reflect = 对现有对象执行特定的元操作。

然后就是 reactive.ts：

```ts
import { mutableHandlers } from './baseHandler'

export function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

现在 reactive 响应式部分基本上都实现完成了，然后我们在 mount 函数中使用一下。
位于：`~/packages/runtime-core/apiCreateApp.ts`

```ts
import { ReactiveEffect } from '../reactivity'

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const componentRender = rootComponent.setup!()

        const updateComponent = () => {
          const vnode = componentRender()
          render(vnode, rootContainer)
        }

        // 从这里开始
        const effect = new ReactiveEffect(updateComponent)
        effect.run()
      },
    }

    return app
  }
}
```

然后，我们在 playground 中验证一下效果：

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
    }
  },
})

app.mount('#app')
```

![reactive_example_mistake](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive_example_mistake.png)

emmm ………

现在渲染看起来是正常的，但是出现了一些新问题。
这其实也很容易理解，因为在 `updateComponent` 函数中我们每次都会创建一些新的元素。
所以，从第二次执行（点击按钮更新时）都会创建新的元素并渲染，而之前渲染的旧元素依然还是保持原来的样子。
因此，在每次渲染之前，我们都需要删除以前的元素。

那么我们对 `~/packages/runtime-core/renderer.ts` 中的 render 函数进行一些修改。

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild) // 添加所有元素的消除处理
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

现在我们再来看看效果。

![reactive_example](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive_example.png)

这次看起来没什么问题了!

现在，我们已经完成了通过 reactive 来响应式的更新画面了。

当前源代码位于: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/030_reactive_system)
