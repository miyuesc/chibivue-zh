# 选项式 API 的支持

## Options API

到目前为止已经可以用 Composition API 实现相当多的事情了，现在试着实现对应的 Options API 吧。

目前，在本书中我们讨论了下面这些内容：

- props
- data
- computed
- method
- watch
- slot
- lifecycle
  - onMounted
  - onUpdated
  - onUnmounted
  - onBeforeMount
  - onBeforeUpdate
  - onBeforeUnmount
- provide/inject
- $el
- $data
- $props
- $slots
- $parent
- $emit
- $forceUpdate
- $nextTick

实现思路是在 `componentOptions.ts` 中提供一个名为 `applyOptions` 的函数，并在 `setupComponent` 函数的末尾运行它。

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .

  if (render) {
    instance.render = render as InternalRenderFunction
  }
  // ↑ 到目前为止我们实现的内容

  setCurrentInstance(instance)
  applyOptions(instance)
  unsetCurrentInstance()
}
```

在 Options API 中，还提供了一个 `this` 引用用来使用当前组件实例的内容。

```ts
const App = defineComponent({
  data() {
    return { message: 'hello' }
  },

  methods: {
    greet() {
      console.log(this.message) // 例如这样
    },
  },
})
```

`this` 在内部指向组件实例的 `proxy` 代理对象，并在应用选项（`applyOptions`）时绑定此 `proxy`。


实现如下 ↓

```ts
export function applyOptions(instance: ComponentInternalInstance) {
  const { type: options } = instance
  const publicThis = instance.proxy! as any
  const ctx = instance.ctx

  const { methods } = options

  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key]
      if (isFunction(methodHandler)) {
        ctx[key] = methodHandler.bind(publicThis)
      }
    }
  }
}
```

基本上我们都可以按照这种方式一个一个实现 Options API 中的所有内容。

如果您想使 `data` 中的数据变成响应式的，您可以在这里调用 `reactive` 函数，如果您想使用计算属性选项，`您可以在这里调用computed` 函数（`provide/inject` 也是一样的）。

由于 `setCurrentInstance` 在运行 `applyOptions` 之前设置了组件实例，因此可以像往常一样调用以前实现的 API（Composition API）。

以 `$` 开头的属性是 `componentPublicInstance` 实现的，由 `PublicInstanceProxyHandlers` 中的 `getter` 控制。

## Options API 的类型

从功能上讲，我们可以像上面描述的那样实现它，但是 Options API 在类型处理上有点复杂。

大体上，本书的实现也支持 Options API 的基础类型处理。

难点在于 `this` 的类型取决于用户对每个选项的定义。
如果使用 `data` 选项定义了一个名为 `count` 的 `number` 类型属性，那么在 `computed` 和 `method` 中，我们希望推导出的 `this.count` 依然也是 `number` 类型。


当然，这不仅适用于 `data`，也适用于 `computed` 和 `methods` 中定义的内容。

```ts
const App = defineComponent({
  data() {
    return { count: 0 }
  },

  methods: {
    myMethod() {
      this.count // number
      this.myComputed // number
    },
  },

  computed: {
    myComputed() {
      return this.count // number
    },
  },
})
```

这会涉及一些复杂的类型推断的实现（我们会使用泛型进行多次类型传递）。

我们将从为 `defineComponent` 添加类型开始，然后实现一些类型以传递到 `ComponentOptions` 和 `ComponentPublicInstance` 中。

在这里，我们将优先实现 `data` 和 `methods` 两个选项的类型处理。

首先，我们有常规的 `ComponentOptions` 类型。

现在我们将扩展这个类型，并使用泛型参数 `D` 和 `M` 来接收 `data` 和 `methods` 的类型。

```ts
export type ComponentOptions<
  D = {},
  M extends MethodOptions = MethodOptions
> = {
  data?: () => D;,
  methods?: M;
};

interface MethodOptions {
  [key: string]: Function;
}
```

这一点并不困难，就是定义传递给 `defineComponent` 的参数类型。

当然，在 `defineComponent` 方法中也会接受 `D` 和 `M`，这样就可以传递用户定义的数据类型了。

```ts
export function defineComponent<
  D = {},
  M extends MethodOptions = MethodOptions,
>(options: ComponentOptions<D, M>) {}
```

问题是如何将 `D` 与 `methods` 中的 `this` 混合（即我们该如何实现 `this.count` 这类数据的类型推理）。

首先，`D` 和 `M` 会被合并到 `PendentPublicInstance` 中（合并到代理中）。

我们可以这么理解（使用泛型进行扩展）：

```ts
type ComponentPublicInstance<
  D = {},
  M extends MethodOptions = MethodOptions,
> = {
  /** public instance 原本拥有的各种数据类型 */
} & D &
  M
```

ここまでできたら、ComponentOptions の this にインスタンスの型を混ぜ込みます。

```ts
type ComponentOptions<D = {}, M extends MethodOptions = MethodOptions> = {
  data?: () => D
  methods?: M
} & ThisType<ComponentPublicInstance<D, M>>
```

这样，我们可以从 `option` 中的 `this` 推论出 `data` 和 `method` 中定义的属性与类型。

在后面的实现中，我们还需要实现 `props`、`computed` 和 `inject` 的类型推断，但是原理都是差不多的。

乍一看，你可能会因为有许多泛型和类型转换（例如从 `inject` 中提取出 `key`）而感到困惑，但只要冷静下来，回归到基础原理然后实现，应该就没问题了。

在本书的代码中，受到 Vue.js 源代码的启发，我们引入了一个抽象层 `CreateComponentPublicInstance`，并实现了一个名为 `ComponentPublicInstanceConstructor` 的类型，但请不必太在意这些细节。（如果感兴趣的话，也可以看看那部分内容！）

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/070_options_api)
