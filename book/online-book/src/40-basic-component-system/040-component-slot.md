# 插槽

## 实现默认插槽

在 Vue.js 中还有一个叫做 “插槽（`slot`）” 的功能，它一共分为三种类型: `default slot` 默认插槽、`named slot` 具名插槽和 `scoped slot` 作用域插槽。

关于它们的使用方式，大家可以参考官方文档：

https://cn.vuejs.org/guide/components/slots.html#slots

首先我们来实现默认插槽，它的使用方式大概是这样的。

https://cn.vuejs.org/guide/extras/render-function.html#passing-slots

```ts
const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () => h('div', {}, [slots.default()])
  },
})

const app = createApp({
  setup() {
    return () => h(MyComponent, {}, () => 'hello')
  },
})
```

这个实现逻辑也很简单。在定义 `slot` 插槽的组件中，我们将 `slots` 定义为一个 `setupContext` 对象。然后在使用该组件的组件中（也就是该具有插槽的组件的父组件），在通过 `h` 函数渲染组件时，将内容作为组件的 `children` 传递进去即可。

可能大家最熟悉的还是在 SFC 中使用 `slot`，将 `slot` 标签放置在 `template` 模板中。但是这种使用方式需要配合模板编译器，所以这次我们会省略这种用法（将会在后面的基础模板编译器中解析和实现）。

与上面的例子一样，我们在实例中添加了一个保存插槽内容的属性 `slots`，并且在 `createSetupContext` 方法中将其合并到 `SetupContext` 内部。

`h` 函数的第三个参数，不仅可以接收一个数组，也可以接收一个渲染函数。当其是渲染函数时，在生成组件实例的时候会默认将其设置为当前组件实例的默认插槽。

暂时我们就先实现到这里吧（随着 `normalize` 函数的实现，`ShapeFlags` 也有一些新的变更。）

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/050_component_slot)

## 实现具名插槽与作用域插槽

这部分属于默认插槽的扩展内容。

接下来，我们将会修改为使用对象而不是函数来传递插槽内容。

关于作用域插槽，只需定义渲染函数的参数即可。

和我们预想的一样，在使用渲染函数时，我们并不需要区分它是不是作用域函数。

这其实才是正确的，`slot` 插槽本身只是一个回调函数，而我们提供的的作用域插槽，只是为了让它可以定义参数。


这样做的好处是，在使用渲染函数时，不需要进行额外的区分，因为它们本身就是作用域插槽，而不是作为 API 提供的作用域插槽。

当然，我们将在后面 “基础模板编译器” 部分实现能够处理作用域插槽的编译器，但是它们实际上也是被转换为渲染函数那种形式的。

https://cn.vuejs.org/guide/components/slots.html#scoped-slots

```ts
const MyComponent = defineComponent({
  setup(_, { slots }) {
    return () =>
      h('div', {}, [
        slots.default?.(),
        h('br', {}, []),
        slots.myNamedSlot?.(),
        h('br', {}, []),
        slots.myScopedSlot2?.({ message: 'hello!' }),
      ])
  },
})

const app = createApp({
  setup() {
    return () =>
      h(
        MyComponent,
        {},
        {
          default: () => 'hello',
          myNamedSlot: () => 'hello2',
          myScopedSlot2: (scope: { message: string }) =>
            `message: ${scope.message}`,
        },
      )
  },
})
```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/060_slot_extend)
