# 实现 Provide/Inject

## Provide/Inject 的实现方式

`Provide` 和 `Inject` 的实现也非常简单。

基本思路就是在 `ComponentInternalInstance` 中有一个 `provides` 属性，用于存储 `provide` API 注入的数据以及保持父组件实例的数据传递。

需要注意的一点是，`provide` 有两种入口。

一种是在组件的 `setup` 中，这种情况比较容易理解；另一种是调用 App （根组件）的 `provide`。


```ts
const app = createApp({
  setup() {
    //.
    //.
    //.
    provide('key', someValue) // 这是从组件中提供的情况
    //.
    //.
  },
})

app.provide('key2', someValue2) // App 中的 provide
```

那么，`app` 中提供的数据应该存储在哪里呢？因为 `app` 对象并不是一个组件实例。

答案是，在 `app` 实例中引入一个名为 `AppContext` 的对象，并在其中保存 `provides` 对象。

`AppContext` 将来还会用于保存全局组件或自定义指令。

现在我们已经解释所有的核心部分逻辑，让我们尝试实现代码，确保下面的代码可以正常运行吧！

```ts
export interface InjectionKey<_T> extends Symbol {}

export function provide<T, K = InjectionKey<T> | string | number>(
  key: K,
  value: K extends InjectionKey<infer V> ? V : T,
)

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(key: InjectionKey<T> | string, defaultValue: T): T
```

```ts
const Child = {
  setup() {
    const rootState = inject<{ count: number }>('RootState')
    const logger = inject(LoggerKey)

    const action = () => {
      rootState && rootState.count++
      logger?.('Hello from Child.')
    }

    return () => h('button', { onClick: action }, ['action'])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ count: 1 })
    provide('RootState', state)

    return () =>
      h('div', {}, [h('p', {}, [`${state.count}`]), h(Child, {}, [])])
  },
})

type Logger = (...args: any) => void
const LoggerKey = Symbol() as InjectionKey<Logger>

app.provide(LoggerKey, window.console.log)
```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/020_provide_inject)
