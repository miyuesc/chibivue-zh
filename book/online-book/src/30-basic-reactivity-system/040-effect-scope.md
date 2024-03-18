# Effect 副作用清理和作用域

::: warning
2023 年 12 月月底 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布了，其中包括了 [reactivity 的性能优化](https://github.com/vuejs/core/pull/5912) 部分。  
需要注意的是，本书参考的是 Vue.js 之前的实现方式。  
本章内容不会有太大改变，但是文件结构可能略有调整，代码也有部分改动。
我也会在日后对这本书进行相应的更新。  
:::

## ReactiveEffect 的清理方式

到目前为止，我们还没有去想办法处理所有注册的 `effect` 副作用函数。所以，我们需要在 `ReactiveEffect` 中添加一个清理操作来完成 `effect` 清理。

首先，在 `ReactiveEffect` 中添加一个 `stop` 方法与一个标志位 `active`。

在这个方法中，我们会设置标志位 `active` 的值为 `false`，然后删除其 `deps` 依赖。

```ts
export class ReactiveEffect<T = any> {
  active = true // 添加标志位
  //.
  //.
  //.
  stop() {
    if (this.active) {
      this.active = false
    }
  }
}
```

然后，要注册在执行 `cleanUp` 清理时需要执行的操作。我们可以通过在 `activeEffect` 添加 `hooks` 钩子函数和处理方法来实现。

```ts
export class ReactiveEffect<T = any> {
  private deferStop?: boolean // 追加
  onStop?: () => void // 追加
  parent: ReactiveEffect | undefined = undefined // 追加 (为了在特定范围(finally)内引用和处理，所以需要将每个实例与一个 EffectScope 关联)

  run() {
    if (!this.active) {
      return this.fn() // 如果 active 为 false，则只执行函数
    }

    try {
      this.parent = activeEffect
      activeEffect = this
      const res = this.fn()
      return res
    } finally {
      activeEffect = this.parent
      this.parent = undefined
      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      // 如果 activeEffect 是自身，则在 run 的最后一步时设置标志位 deferStop，以便在该位置停止 effect
      this.deferStop = true
    } else if (this.active) {
      // ...
      if (this.onStop) {
        this.onStop() // 执行注册的钩子函数
      }
      // ...
    }
  }
}
```

在 `ReactiveEffect` 中添加了清理操作后，我们现在就可以实现 `watch` 函数对应的清理函数了。

如果下面这段代码可以执行说明就没有问题了。

```ts
import { createApp, h, reactive, watch } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    const unwatch = watch(
      () => state.count,
      (newValue, oldValue, cleanup) => {
        alert(`New value: ${newValue}, old value: ${oldValue}`)
        cleanup(() => alert('Clean Up!'))
      },
    )

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, [`increment`]),
        h('button', { onClick: unwatch }, [`unwatch`]),
      ])
  },
})

app.mount('#app')
```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/130_cleanup_effects)

## Effect Scope 是什么

现在我们已经能够清理 `effect` 了，那么在组件卸载时我们肯定也希望清理掉后续无用的 `effect`。

但是，不管是 `watch` 还是 `computed`，手动收集所有的依赖然后清理这个逻辑是非常繁琐的。

如果我们直接使用这种方式实现的话，可能代码就会变成这个样子。

```ts
let disposables = []

const counter = ref(0)

const doubled = computed(() => counter.value * 2)
disposables.push(() => stop(doubled.effect))

const stopWatch = watchEffect(() => console.log(`counter: ${counter.value}`))
disposables.push(stopWatch)
```

```ts
// cleanup effects
disposables.forEach(f => f())
disposables = []
```

这种管理 `effect` 的方式是非常繁琐的，并且非常容易出现问题。

这也是为什么 Vue.js 中会出现 `Effect Scope` 这种机制。

https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md

从概念上讲，每个实例拥有一个 `EffectScope`，具体来说，它们有以下基础逻辑：

```ts
const scope = effectScope()

scope.run(() => {
  const doubled = computed(() => counter.value * 2)

  watch(doubled, () => console.log(doubled.value))

  watchEffect(() => console.log('Count: ', doubled.value))
})

// to dispose all effects in the scope
scope.stop()
```

引用自: https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md#basic-example

除此之外，`EffectScope` 还作为面向用户的 API 公开。

https://cn.vuejs.org/api/reactivity-advanced.html#effectscope

## EffectScope 的实现

就像之前提到的，每一个实例都拥有一个 `EffectScope`。

```ts
export interface ComponentInternalInstance {
  scope: EffectScope
}
```

在卸载组件时，我们就可以停止并清理该组件中收集到的 `effect`。

```ts
const unmountComponent = (...) => {
  // .
  // .
  const { scope } = instance;
  scope.stop();
  // .
  // .
}
```

`EffectScope` 的结构包括一个 `activeEffectScope` 变量，用于指向当前活动的 `EffectScope`，并通过 `EffectScope` 的 `on/off/run/stop` 方法来管理其状态。

当创建 `ReactiveEffect` 时，会将 `effect` 注册到 `activeEffectScope` 中。

这么解释可能有点儿晦涩，我们用代码来演示一下：

```ts
instance.scope.on()

/** 创建 computed、watch 等 ReactiveEffect */
setup()

instance.scope.off()
```

通过这种方式，我们可以将生成的 `effect` 收集到实例的 `EffectScope` 中。
然后，通过触发这些 `effect` 的 `stop` 方法，就可以清理所有 `effect` 了。

现在基本原理大家应该清楚了，那就一边阅读源代码一边实现吧！

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/140_effect_scope)
