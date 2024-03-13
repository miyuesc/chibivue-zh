# computed / watch api

::: warning
2023 年 12 月月底 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布了，其中包括了 [reactivity 的性能优化](https://github.com/vuejs/core/pull/5912) 部分。  
需要注意的是，本书参考的是 Vue.js 之前的实现方式。  
本章内容不会有太大改变，但是文件结构可能略有调整，代码也有部分改动。
我也会在日后对这本书进行相应的更新。  
:::

## 回顾 computed (和实现)

在上一小章中，我们实现了 `ref` 相关的一些 API。现在，该实现 `computed` 了。

https://cn.vuejs.org/api/reactivity-core.html#computed

`computed` 有两种使用方式：只读和可写。

```ts
// read-only
function computed<T>(
  getter: () => T,
  // see "Computed Debugging" link below
  debuggerOptions?: DebuggerOptions,
): Readonly<Ref<Readonly<T>>>

// writable
function computed<T>(
  options: {
    get: () => T
    set: (value: T) => void
  },
  debuggerOptions?: DebuggerOptions,
): Ref<T>
```

源代码中的实现虽然不长，但是逻辑比较复杂，所以我们先从一个简单的实现开始。

我目前能想到的最简单的方法就是，在每次读取 `value` 的时候就执行一次计算（`getter()`）得到计算结果然后返回。

```ts
export class ComputedRefImpl<T> {
  constructor(private getter: ComputedGetter<T>) {}

  get value() {
    return this.getter()
  }

  set value() {}
}
```

但是，在这种情况下 `computed` 只能称为是一个函数调用（我觉得这并没有什么值得兴奋的）。

实际上，我们希望它能自动追踪依赖项，并在依赖项的值发生改变时重新计算它。

为了实现这个效果，我们使用了一种新的机制，将 `_dirty` 标志的更新函数作为调度器的 `job` 来执行。

`_dirty` 标志用来确定 “是否需要重新计算”，在依赖项发生变化时被重写更新。

下面是它的工作原理的示例：

```ts
export class ComputedRefImpl<T> {
  public dep?: Dep = undefined
  private _value!: T
  public readonly effect: ReactiveEffect<T>
  public _dirty = true

  constructor(getter: ComputedGetter<T>) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
      }
    })
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }
}
```

`computed` 实际上还有 “惰性计算” 的特性，如果需要重新进行计算，也只有在发送计算属性值读取的时候才会重新计算（即不是在依赖发生改变时就立即重新计算）。

然后，将更改标志为 `true` 的函数注册为一个 `ReactiveEffect` 调度程序，因为这个函数的执行是由这个计算属性对应的依赖项更新触发的。

基本的流程就是这样的。但是在实现时，还有一些需要注意的事项，大概总结如下：

- 当 `_dirty` 修改为 `true` 时，还会触发所有与这个计算属性相关（依赖它）的副作用函数执行
  ```ts
  if (!this._dirty) {
    this._dirty = true
    triggerRefValue(this)
  }
  ```
- `computed` 在分类上也属于 `ref` 一类的，所以计算属性对象的 `__v_isRef` 属性为 `true`
- 如果你想实现 `setter`，请在最后再实现它，首要目标是实现值的计算

现在我们已经准备好了，让我们开始实现它吧！

如果下面的代码能像预期的那样工作，那就 OK 了！（请确保只有内部的依赖项改变才会触发重新计算！）

```ts
import { computed, createApp, h, reactive, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = reactive({ value: 0 })
    const count2 = reactive({ value: 0 })
    const double = computed(() => {
      console.log('computed')
      return count.value * 2
    })
    const doubleDouble = computed(() => {
      console.log('computed (doubleDouble)')
      return double.value * 2
    })

    const countRef = ref(0)
    const doubleCountRef = computed(() => {
      console.log('computed (doubleCountRef)')
      return countRef.value * 2
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('p', {}, [`count2: ${count2.value}`]),
        h('p', {}, [`double: ${double.value}`]),
        h('p', {}, [`doubleDouble: ${doubleDouble.value}`]),
        h('p', {}, [`doubleCountRef: ${doubleCountRef.value}`]),
        h('button', { onClick: () => count.value++ }, ['update count']),
        h('button', { onClick: () => count2.value++ }, ['update count2']),
        h('button', { onClick: () => countRef.value++ }, ['update countRef']),
      ])
  },
})

app.mount('#app')
```

当前源代码位于: 
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/050_computed)

(`setter` 相关的内容在这里): 
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/060_computed_setter)

## Watch 的实现

https://cn.vuejs.org/api/reactivity-core.html#watch

在 `watch` 这个类型下也有很多的 API。

首先，让我们先显示一个最简单的 API，它由一个 `getter` 函数进行依赖收集。

我们目前的目标是能正常运行下面的代码。

```ts
import { createApp, h, reactive, watch } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    watch(
      () => state.count,
      () => alert('state.count was changed!'),
    )

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: () => state.count++ }, ['update state']),
      ])
  },
})

app.mount('#app')
```

我们会在 `runtime-core` 目录中实现 `watch` 函数(`apiWatch.ts`)，而不是之前的 `reactivity`。

因为源码中混合了很多其他的 API，所以看起来非常复杂，但是如果我们缩小一下范围，就会发现其实它非常简单。

我已经实现了当前要实现的 `watch` 函数对应的类型签名，大家试着自己实现一下吧。

如果你已经掌握了到目前为止的所有响应式相关的知识，我相信你可以轻松的做到这一点。

```ts
export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = () => T

type OnCleanup = (cleanupFn: () => void) => void

export function watch<T>(
  source: WatchSource<T>,
  cb: (newValue: T, oldValue: T) => void,
) {
  // TODO:
}
```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/070_watch)

## watch API 的其他实现

一旦我们掌握了基础部分，那么扩展它就是很容易的事情了，这些也不用做太多的解释。

- 监听 `ref`。
  ```ts
  const count = ref(0)
  watch(count, () => {
    /** some effects */
  })
  ```
- 监听多个来源。

  ```ts
  const count = ref(0)
  const count2 = ref(0)
  const count3 = ref(0)
  watch([count, count2, count3], () => {
    /** some effects */
  })
  ;``
  ```

- `immediate` 立即执行

  ```ts
  const count = ref(0)
  watch(
    count,
    () => {
      /** some effects */
    },
    { immediate: true },
  )
  ```

- `deep` 深度监听

  ```ts
  const state = reactive({ count: 0 })
  watch(
    () => state,
    () => {
      /** some effects */
    },
    { deep: true },
  )
  ```

- `reactive object` 响应式对象

  ```ts
  const state = reactive({ count: 0 })
  watch(state, () => {
    /** some effects */
  }) // automatically in deep mode
  ```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/080_watch_api_extends)

## watchEffect

https://cn.vuejs.org/api/reactivity-core.html#watcheffect

使用 `watch` 的实现原理来实现 `watchEffect` 是很容易的。

```ts
const count = ref(0)

watchEffect(() => console.log(count.value))
// -> logs 0

count.value++
// -> logs 1
```

看起来就像实现 `immediate` 为 `true` 时的 `watch` 一样。

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/090_watch_effect)

---

※ 我们将在其他章节讨论 `watch` 监听的清理。
