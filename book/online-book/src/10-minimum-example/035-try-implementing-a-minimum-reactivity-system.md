# 尝试实现一个最小的响应式系统

## 使用 Proxy 实现响应式机制

::: info 关于与当前 vuejs/core 设计的差异
当前(2024/12)的 Vue.js 响应式系统采用了基于双向链表的观察者模式。\
这个实现是在 [Refactor reactivity system to use version counting and doubly-linked list tracking](https://github.com/vuejs/core/pull/10397) 中完成的，对性能提升有很大贡献。

然而，对于第一次实现响应式系统的人来说，这可能有点难度，所以在本章中，我们将实现一个更简化的传统版本（改进前的版本）。\
更接近当前实现的版本将在 [响应式系统的优化](/zh/30-basic-reactivity-system/005-reactivity-optimization) 中解释。

另外，还有一个重要的改进 [feat(reactivity): more efficient reactivity system](https://github.com/vuejs/core/pull/5912)，这个我们也会在另一章节中解释。
:::

让我们重新明确一下目标，本次的目标是"当状态改变时执行 `updateComponent`"。  
让我们来解释一下使用 Proxy 实现的流程。

首先，在 Vue.js 的响应式系统中，会出现 `target`、`Proxy`、`ReactiveEffect`、`Dep`、`track`、`trigger`、`targetMap`、`activeEffect`（现在是 `activeSub`）这些概念。

首先，让我们来看 targetMap 的结构。  
targetMap 是某个 target 的 key 和 dep 的映射。  
target 是我们想要使其响应式的对象，dep 可以理解为我们想要执行的作用（函数）。  
用代码表示就是这样：

```ts
type Target = any // 任意的target
type TargetKey = any // target持有的任意key

const targetMap = new WeakMap<Target, KeyToDepMap>() // 在这个模块内定义为全局变量

type KeyToDepMap = Map<TargetKey, Dep> // target的key和作用的映射

type Dep = Set<ReactiveEffect> // dep持有多个ReactiveEffect

class ReactiveEffect {
  constructor(
    // 这里持有实际想要执行的函数（在本例中是updateComponent）
    public fn: () => T,
  ) {}
}
```

这意味着我们要为"某个 target（对象）"的"某个 key"注册"某个作用"。

仅看代码可能不太容易理解，所以让我们通过具体例子和图示来补充说明。\
假设我们有以下这样的组件：

```ts
export default defineComponent({
  setup() {
    const state1 = reactive({ name: "John", age: 20 })
    const state2 = reactive({ count: 0 })

    function onCountUpdated() {
      console.log("count updated")
    }

    watch(() => state2.count, onCountUpdated)

    return () => h("p", {}, `name: ${state1.name}`)
  }
})
```

虽然在本章我们还没有实现 watch，但这里写出来是为了帮助理解。\
在这个组件中，最终会形成如下的 targetMap：

![target_map](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/target_map.drawio.png)

targetMap 的 key 是"某个 target"。在这个例子中，state1 和 state2 就是 target。\
然后，这些 target 持有的 key 会成为 targetMap 的 key。\
与之关联的作用就是它的 value。

在 `() => h("p", {}, name: ${state1.name})` 这部分会注册 `state1->name->updateComponentFn` 这样的映射，而在 `watch(() => state2.count, onCountUpdated)` 这部分会注册 `state2->count->onCountUpdated` 这样的映射。

基本结构就是这样，接下来我们需要考虑如何构建这个 TargetMap（如何注册）以及如何执行实际的作用。

这就引出了 `track` 和 `trigger` 这两个概念。
顾名思义，`track` 是注册到 `TargetMap` 的函数，`trigger` 是从 `TargetMap` 中取出作用并执行的函数。

```ts
export function track(target: object, key: unknown) {
  // ..
}

export function trigger(target: object, key?: unknown) {
  // ..
}
```

这个 track 和 trigger 会在 Proxy 的 get 和 set 处理器中实现。

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

用于生成这个 Proxy 的 API 就是 reactive 函数。

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

![reactive](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactive.drawio.png)

这时，你可能会注意到缺少了一个要素。那就是"在 track 中注册哪个函数？"这一点。
答案就是 `activeEffect` 这个概念。
这个和 targetMap 一样，在这个模块内被定义为全局变量，并通过 ReactiveEffect 的 `run` 方法进行设置。

```ts
let activeEffect: ReactiveEffect | undefined

class ReactiveEffect {
  constructor(
    // 这里持有实际想要执行的函数（在本例中是updateComponent）
    public fn: () => T,
  ) {}

  run() {
    activeEffect = this
    return this.fn()
  }
}
```

让我们来看看原理，想象一下这样的组件：

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

在内部，它是这样形成响应式的：

```ts
// chibivue 内部实现
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

让我们按顺序解释一下，首先，执行 `setup` 函数。
此时会生成 reactive proxy。也就是说，从这时起，对这个生成的 proxy 的任何操作都会按照我们设置的 proxy 行为执行。

```ts
const state = reactive({ count: 0 }) // 生成proxy
```

接下来，我们传入 `updateComponent` 来生成 `ReactiveEffect`（观察者端）。

```ts
const effect = new ReactiveEffect(updateComponent)
```

这个 `updateComponent` 使用的 `componentRender` 是 `setup` 的`返回值`函数。而这个函数引用了由 proxy 创建的对象。

```ts
function render() {
  return h('div', { id: 'my-app' }, [
    h('p', {}, [`count: ${state.count}`]), // 引用由proxy创建的对象
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

当这个函数实际运行时，`state.count` 的 `getter` 函数会执行，从而执行 `track`。  
在这种情况下，让我们执行 effect。

```ts
effect.run()
```

这样，首先 `activeEffect` 会被设置为 `updateComponent`（持有的 ReactiveEffect）。  
在这种状态下执行 `track`，就会在 `targetMap` 中注册 `state.count` 和 `updateComponent`（持有的 ReactiveEffect）的映射。  
这就形成了响应式。

现在，让我们考虑当 increment 执行时会发生什么。  
increment 会修改 `state.count`，所以会执行 `setter`，从而执行 `trigger`。  
`trigger` 会根据 `state` 和 `count` 从 `targetMap` 中找到 `effect`（在本例中是 updateComponent）并执行。
这样就实现了页面的更新！

通过这种方式，我们实现了响应式。

因为有点复杂，所以用图来总结一下。

![reactivity_create](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactivity_create.drawio.png)

## 基于以上内容来实现

最难的部分是理解上述内容，一旦理解了，剩下的就只是编写源代码了。  
当然，可能有人还是不太明白实际上是如何工作的，仅凭上面的内容可能无法完全理解。  
即使是这样的人，也让我们先尝试实现一下。然后在阅读实际代码的同时，再回顾一下前面的章节！

让我们开始实现吧。首先创建必要的文件：

```sh
pwd # ~
mkdir packages/reactivity
touch packages/reactivity/index.ts
touch packages/reactivity/reactive.ts
touch packages/reactivity/effect.ts
touch packages/reactivity/dep.ts
```

首先在 `dep.ts` 中实现 `Dep` 类型和 `targetMap`：

```ts
import { ReactiveEffect } from './effect'

export type Dep = Set<ReactiveEffect>

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  return dep
}

export type KeyToDepMap = Map<any, Dep>
export const targetMap = new WeakMap<any, KeyToDepMap>()
```

然后在 `effect.ts` 中实现 `ReactiveEffect` 类：

```ts
export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {
    activeEffect = this
    return this.fn()
  }
}

export function track(target: object, key: unknown) {
  if (!activeEffect) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  dep.add(activeEffect)
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key!)
  if (!dep) return

  triggerEffects(dep)
}

export function triggerEffects(dep: Dep) {
  for (const effect of dep) {
    effect.run()
  }
}
```

最后在 `reactive.ts` 中实现 `reactive` 函数：

```ts
import { track, trigger } from './effect'

export const reactive = <T extends object>(target: T): T => {
  return new Proxy(target, {
    get(target: object, key: string | symbol, receiver: object) {
      const res = Reflect.get(target, key, receiver)
      track(target, key)
      return res
    },

    set(target: object, key: string | symbol, value: unknown, receiver: object) {
      Reflect.set(target, key, value, receiver)
      trigger(target, key)
      return true
    },
  })
}
```

让我们在 playground 中试试看：

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++

    return () =>
      h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

太好了！我们成功实现了一个最小的响应式系统！
当你点击按钮时，屏幕会更新。

![reactivity_system](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactivity_system.png)

到目前为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/035_minimum_reactivity_system) 