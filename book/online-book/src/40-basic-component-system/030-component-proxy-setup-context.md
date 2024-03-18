# 组件代理和组件上下文

## 组件代理

组件代理也是一个非常重要的概念。

它允许外部直接访问组件实例的公共数据属性。

这个代理封装了对 `setup` 的结果（状态和函数）、`data` 和 `props` 的访问，简化了对这些属性的访问。

我们可以思考一下下面这段代码（包含 Chibivue 中还没有实现的内容，可以把它看做是使用 Vue.js 的组件）。

```vue
<script>
export default defineComponent({
  props: { parentCount: { type: Number, default: 0 } },
  data() {
    return { dataState: { count: 0 } }
  },
  methods: {
    incrementData() {
      this.dataState.count++
    },
  },
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    return { state, increment }
  },
})
</script>

<template>
  <div>
    <p>count (parent): {{ parentCount }}</p>

    <br />

    <p>count (data): {{ dataState.count }}</p>
    <button @click="incrementData">increment (data)</button>

    <br />

    <p>count: {{ state.count }}</p>
    <button @click="increment">increment</button>
  </div>
</template>
```

这段代码是可以正常工作的，但是我们是怎么把数据绑定到 `template` 上的呢？

我再举一个例子。

```vue
<script setup>
const ChildRef = ref()

// 可以访问子组件具有的方法和数据
// ChildRef.value?.incrementData
// ChildRef.value?.increment
</script>

<template>
  <!-- Childは先ほどのコンポーネント -->
  <Child :ref="ChildRef" />
</template>
```

在这里，您也可以通过 `ref` 来访问子组件的信息。

实现这一功能的方法，是在 `ComponentInternalInstance` 中定义一个名为 `proxy` 的属性，存储用于数据访问的代理对象。

换句话说，`template`（`render` 函数）中和 `ref` 属性（对应的变量）实际上是引用了` instance.proxy`。

```ts
interface ComponentInternalInstance {
  proxy: ComponentPublicInstance | null
}
```

当然，这个 `proxy` 组件代理也是使用 `Proxy` 实现的，它的大致实现如下：

```ts
instance.proxy = instance.proxy = new Proxy(
  instance,
  PublicInstanceProxyHandlers,
)

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get(instance: ComponentRenderContext, key: string) {
    const { setupState, ctx, props } = instance

    //根据 key 依次检查 setupState -> props -> ctx，如果存在则返回
  },
}
```

让我们来尝试实现一下这个代理吧。

当我们实现完成，还需要尝试将这个代理传递给 `render` 函数和 `ref` 属性对应的变量。

当前源代码位于:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/030_component_proxy)

※ 此外，我们还实现了 `defineComponent` 函数和相关的类型化（这将使我们能够推断代理数据的类型）。

![infer_component_types](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/infer_component_types.png)

## 组件上下文（setup 上下文） setupContext

https://cn.vuejs.org/api/composition-api-setup.html#setup-context

Vue.js 中还有一个名为 `setupContext` 的概念。这是在 `setup` 函数内部公开的上下文，其中包括 `emit` 和 `expose` 等内容。

目前，我们的 `emit` 虽然可以使用，但功能实现上还比较粗糙。

```ts
const setupResult = component.setup(instance.props, {
  emit: instance.emit,
})
```

我们需要定义这个 `SetupContext` 类型接口，并且将它添加到组件实例的类型定义上。

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  setupContext: SetupContext | null // 追加
}

export type SetupContext = {
  emit: (e: string, ...args: any[]) => void
}
```

然后，在生成实例时创建 `setupContext` 上下文对象，并在执行 `setup` 函数时将该对象作为第二个参数传递进去。

## expose

现在，我们可以尝试实现除了 `emit` 之外的 `SetupContext` 的内容了。

这次我们可以试着实现 `expose`。

`expose` 的作用是用来明确表示组件的公共属性或者函数的一个函数（配合 TypeScript 非常好用）。

这次的目标就是让下面的代码可以正常运行。

```ts
const Child = defineComponent({
  setup(_, { expose }) {
    const count = ref(0)
    const count2 = ref(0)
    expose({ count })
    return { count, count2 }
  },
  template: `<p>hello</p>`,
})

const Child2 = defineComponent({
  setup() {
    const count = ref(0)
    const count2 = ref(0)
    return { count, count2 }
  },
  template: `<p>hello</p>`,
})

const app = createApp({
  setup() {
    const child = ref()
    const child2 = ref()

    const log = () => {
      console.log(
        child.value.count,
        child.value.count2, // cannot access
        child2.value.count,
        child2.value.count2,
      )
    }

    return () =>
      h('div', {}, [
        h(Child, { ref: child }, []),
        h(Child2, { ref: child2 }, []),
        h('button', { onClick: log }, ['log']),
      ])
  },
})
```

对于没有使用 `expose` 的组件，默认所有的属性和方法都是公开的。

我们实现 `expose` 的思路就是，在组件实例中定义一个 `exposed` 属性，如果这个属性有值的话，那么就把这个对象传递给之前的 `ref` 属性指定的变量。

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  exposed: Record<string, any> | null // 追加
}
```

然后，我们就可以实现 `expose` 函数了，以便我们可以在这里注册这个对象。

## ProxyRefs

在这一节之前的内容中，我们已经实现了组件代理和 `exposedProxy`。然而，实际上现在还存在一个和 Vue.js 不同的地方。

在 Vue.js 中，`ref` 变量是会被 `Unwrap` （展开）的（在 `proxy` 的情况下，`setupState` (`setup` 返回的状态对象) 比 `proxy` 具有这种性质）。

实现这部分功能的就是 `ProxyRefs`，它是通过 `shallowUnwrapHandlers` 这个 `proxy handler` 来实现的。

这样，我们就可以在 `template` 或者处理特殊的 `proxy` 代理时，省略冗余的 `.value`。

```ts
const shallowUnwrapHandlers: ProxyHandler<any> = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key]
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value
      return true
    } else {
      return Reflect.set(target, key, value, receiver)
    }
  },
}
```

```vue
<template>
  <!-- <p>{{ count.value }}</p>  就没必要这么写了 -->
  <p>{{ count }}</p>
</template>
```

如果到这里已经实现完成了的话，这段代码就可以正常运行了。

```ts
import { createApp, defineComponent, h, ref } from 'chibivue'

const Child = defineComponent({
  setup(_, { expose }) {
    const count = ref(0)
    const count2 = ref(0)
    expose({ count })
    return { count, count2 }
  },
  template: `<p>child {{ count }} {{ count2 }}</p>`,
})

const Child2 = defineComponent({
  setup() {
    const count = ref(0)
    const count2 = ref(0)
    return { count, count2 }
  },
  template: `<p>child2 {{ count }} {{ count2 }}</p>`,
})

const app = createApp({
  setup() {
    const child = ref()
    const child2 = ref()

    const increment = () => {
      child.value.count++
      child.value.count2++ // cannot access
      child2.value.count++
      child2.value.count2++
    }

    return () =>
      h('div', {}, [
        h(Child, { ref: child }, []),
        h(Child2, { ref: child2 }, []),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

## 和 template 模板绑定的 with 上下文

实际上由于这一结的修改，现在我们有了一个新的问题。

我们先运行这段代码：

```ts
const Child2 = {
  setup() {
    const state = reactive({ count: 0 })
    return { state }
  },
  template: `<p>child2 count: {{ state.count }}</p>`,
}
```

虽然代码看起来很简单，也没什么问题，但是实际上它是没有办法运行的。

这里会报一个错误：`state` 没有定义。

![state_is_not_defined](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/state_is_not_defined.png)

原因在于，当将 `Proxy` 对象作为 `with` 语句的的参数时，必须定义代理对象的 `has` 方法。

[Creating dynamic namespaces using the with statement and a proxy (MDN)](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/with#creating_dynamic_namespaces_using_the_with_statement_and_a_proxy)

因此，我们需要在 `PublicInstanceProxyHandlers` 中实现 `has` 方法。

如果 `key` 存在于 `setupState`、`propsOptions` 任一属性中，或者存在于 `ctx` 中，则返回 `true`。

```ts
export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  // .
  // .
  // .
  has(
    { _: { setupState, ctx, propsOptions } }: ComponentRenderContext,
    key: string,
  ) {
    let normalizedProps
    return (
      hasOwn(setupState, key) ||
      ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
      hasOwn(ctx, key)
    )
  },
}
```

这样修改后代码可以正常运行的话，就没有问题了。

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/040_setup_context)
