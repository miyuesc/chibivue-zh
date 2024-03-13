# ref api (Basic Reactivity System 基础响应式系统开始了)

::: warning
2023 年 12 月月底 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布了，其中包括了 [reactivity 的性能优化](https://github.com/vuejs/core/pull/5912) 部分。  
需要注意的是，本书参考的是 Vue.js 之前的实现方式。  
本章内容不会有太大改变，但是文件结构可能略有调整，代码也有部分改动。
我也会在日后对这本书进行相应的更新。  
:::

## 回顾 ref api (和实现)

Vue.js 有很多与 Reactivity 响应式相关的 API，但 ref 是其中最著名的一个。

甚至在官方文档中，也将其与其他几个 API 统称为 `Reactivity API:Core` 并首先介绍。

https://cn.vuejs.org/api/reactivity-core.html#ref

我们来思考一下，`ref` 是一个什么样的 API？

根据官方的描述：

> `ref` 对象是可更改的，也就是说你可以为 `.value` 赋予新的值。它也是响应式的，即所有对 `.value` 的操作都将被追踪，并且写操作会触发与之相关的副作用。

> 如果将一个对象赋值给 `ref`，那么这个对象将通过 `reactive()` 转为具有深层次响应式的对象。这也意味着如果对象中包含了嵌套的 `ref`，它们将被深层地解包。

(引用: https://cn.vuejs.org/api/reactivity-core.html#ref)

简而言之，`ref object`（即 `ref` 生成的响应式对象）有两个特点：

- `value` 属性的 `get` 和 `set` 分别调用 `track` 和 `trigger`
- 当传递给 `ref` 的是一个对象时，那么这个 `ref object` 的 `value` 属性是一个 `reactive` 对象

体现在代码中的话

```ts
const count = ref(0)
count.value++ // effect (特点 1 )

const state = ref({ count: 0 })
state.value = { count: 1 } // effect (特点 1 )
state.value.count++ // effect (特点 2 )
```

大概就是这样的意思。

在还没有了解 `ref` 和 `reactive` 的区别之前，我们可能会很容易混淆 `ref(0)` 和 `reactive({ value: 0 })` 两者之间的区别。
但只要我们理解了上面的两个特性，我们就可以很清楚的知道他们两个是不同的。

`ref` 不会创建 `{ value: x }` 这种格式的响应式对象，对 `value` 属性的 `get/set` 操作以及触发对应的 `track/trigger` 都是由 `ref` 内部进行实现的。
只有当 `value` 对应的初始值 `x` 也是一个对象（引用类型数据）的时候，才会通过 `reactive` 将 `x` 转换为响应式对象。

大概实现逻辑看起来就像这样：

```ts
class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined

  get value() {
    trackRefValue(this)
  }

  set value(newVal) {
    this._value = toReactive(v)
    triggerRefValue(this)
  }
}

const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value
```

让我们一边阅读源码一边实现一个 `ref` 方法吧。

源代码中还会有很多其他的 `class` 和 `function`，但是现在我们只关注 `ref` 和 `RefImpl` 类就行了。

当你可以正常运行下面这段代码的时候，基本上就差不多实现了。
(※ 注: `template` 模板中还不能使用 `ref` 变量，因为这需要模板编译器来单独处理 `ref`)

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = ref(0)

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['Increment']),
      ])
  },
})

app.mount('#app')
```

当前源代码位于: 
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/010_ref)

## shallowRef

现在，我们将开始实现与 `ref` 相关的其他 API。

之前，我们介绍了 `ref` 的一个特性，即 “当一个对象被赋值给 `.value` 属性时，`.value` 属性的值将成为一个反应对象”，但是 `shallowRef` 不具有这个特点。

> 和 `ref()` 不同，浅层 ref 的内部值将会原样存储和暴露，并且不会被深层递归地转为响应式。只有对 `.value` 的访问是响应式的。

(引用: https://cn.vuejs.org/api/reactivity-advanced.html#shallowref)

我们现在要做的事情非常简单，只需要通过 `RefImpl` 就可以实现，直接跳过 `toReactive` 部分即可。

大家一边阅读源码一边实现吧。只要能正常运行下面这段代码就好了。

```ts
import { createApp, h, shallowRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // 即使点击了这个按钮，页面也不会刷新
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),
      ])
  },
})

app.mount('#app')
```

### triggerRef

正如前文所讲的，`shallow ref` 的 `value` 不是一个响应式对象，因此这个值（是引用类型值的时候）内部发生任何改变都不会触发响应更新。

但是 `value` 本身是一个对象，它可能已经发生更改了（但是页面上观察不到）。

因此，我们需要一个 API 来强制触发更新，这就是 `triggerRef`。

https://cn.vuejs.org/api/reactivity-advanced.html#triggerref

```ts
import { createApp, h, shallowRef, triggerRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })
    const forceUpdate = () => {
      triggerRef(state)
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // 点击也不会触发画面更新
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),

        h(
          'button', // 将页面更新为当前 state.value.count 的值
          { onClick: forceUpdate },
          ['force update !'],
        ),
      ])
  },
})

app.mount('#app')
```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/020_shallow_ref)

## toRef

`toRef` 是一个可以将值（可以是静态的值也可以是响应式的）或者响应式对象的属性转换为一个 `Ref` 格式的响应式数据。

https://cn.vuejs.org/api/reactivity-utilities.html#toref

它经常用于将 `props` 的某些属性转换为 `ref`。

```ts
const count = toRef(props, 'count')
console.log(count.value)
```

`toRef` 创建的 `ref` 与原始 `reactive` 对象（的属性）同步。
对 `ref` 进行更改时，原始 `reactive` 对象也会更新；原始 `reactive` 对象发生更改时，`ref` 也一样会更新。

```ts
import { createApp, h, reactive, toRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const stateCountRef = toRef(state, 'count')

    return () =>
      h('div', {}, [
        h('p', {}, [`state.count: ${state.count}`]),
        h('p', {}, [`stateCountRef.value: ${stateCountRef.value}`]),
        h('button', { onClick: () => state.count++ }, ['updateState']),
        h('button', { onClick: () => stateCountRef.value++ }, ['updateRef']),
      ])
  },
})

app.mount('#app')
```

一样的，大家一边阅读源码一边实现吧！

※ 从 v3.3 开始，`toRef` 中添加了规范化功能。但是在 chibivue 中，我们没有实现这个功能。

更多详情请查看官方文档! (https://cn.vuejs.org/api/reactivity-utilities.html#toref)

当前源代码位于: 
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/030_to_ref)

## toRefs

为 `reactive` 响应式对象的所有属性生成 `ref` 引用并组成一个新普通对象。

https://cn.vuejs.org/api/reactivity-utilities.html#torefs

```ts
import { createApp, h, reactive, toRefs } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ foo: 1, bar: 2 })
    const stateAsRefs = toRefs(state)

    return () =>
      h('div', {}, [
        h('p', {}, [`[state]: foo: ${state.foo}, bar: ${state.bar}`]),
        h('p', {}, [
          `[stateAsRefs]: foo: ${stateAsRefs.foo.value}, bar: ${stateAsRefs.bar.value}`,
        ]),
        h('button', { onClick: () => state.foo++ }, ['update state.foo']),
        h('button', { onClick: () => stateAsRefs.bar.value++ }, [
          'update stateAsRefs.bar.value',
        ]),
      ])
  },
})

app.mount('#app')
```

我觉得这个功能使用 `toRef` 可以很快就实现。

当前源代码位于: 
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/040_to_refs)
