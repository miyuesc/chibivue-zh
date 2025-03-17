# 响应式系统的预备知识

## 本次要实现的开发者接口

从这里开始，我们将开始实现 Vue.js 的精髓 —— 响应式系统。
在此之前的实现，虽然外表看起来像 Vue.js，但那只是表面现象，功能上完全不是 Vue.js。
我们只是实现了最初的开发者接口，让它能够显示各种 HTML。

但是，保持这样的状态，一旦页面渲染完成后就不会再改变，作为 Web 应用程序来说只是一个静态网站。
接下来，为了构建更丰富的 UI，我们将实现状态管理，并在状态改变时更新渲染。

首先，让我们按照惯例考虑一下开发者接口应该是什么样的。
下面这样如何？

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

对于平时使用 SFC 开发的人来说，这种写法可能有点陌生。
这是一个使用 setup 选项来定义状态，并返回 render 函数的开发者接口。
实际上，Vue.js 中确实有这种写法。

https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

我们使用 reactive 函数定义状态，并实现一个名为 increment 的函数来修改它，然后将这个函数绑定到按钮的 click 事件上。
总结一下我们要做的事情：

- 执行 setup 函数，从返回值中获取用于生成 vnode 的函数
- 使用 reactive 函数使传入的对象变为响应式
- 点击按钮时，状态会更新
- 追踪状态的更新并重新执行 render 函数，更新屏幕

## 什么是响应式系统？

现在让我们回顾一下什么是响应式。
让我们参考官方文档：

> 响应式对象是 JavaScript Proxy，其行为与普通对象相同。不同之处在于 Vue 能够追踪响应式对象的属性访问和修改。

[引用来源](https://cn.vuejs.org/guide/essentials/reactivity-fundamentals.html)

> Vue 最独特的特性之一是其非侵入性的响应式系统。组件状态都是由响应式的 JavaScript 对象组成的。当更改它们时，视图会随即更新。

[引用来源](https://cn.vuejs.org/guide/extras/reactivity-in-depth.html)

总结一下就是，"响应式对象在发生变化时会更新屏幕"。
暂时不考虑如何实现这一点，让我们先实现前面提到的开发者接口。

## 实现 setup 函数

要做的事情非常简单。
接收 setup 选项并执行它，然后像之前的 render 选项一样使用它就可以了。

编辑 ~/packages/runtime-core/componentOptions.ts：

```ts
export type ComponentOptions = {
  render?: Function
  setup?: () => Function // 新增
}
```

然后修改相关代码以使用它：

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
    // 将来会在这里定义状态
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

就这么简单。
实际上，我们希望在状态改变时执行这个 `updateComponent`。

## Proxy 对象

这是本次的主题。我们需要想办法在状态改变时执行 updateComponent。

关键在于一个叫做 Proxy 的对象。

首先，让我们不谈响应式系统的实现方法，而是先解释一下各个部分。

https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy 是一个非常有趣的对象。

如下所示，我们可以通过传入一个对象并使用 new 来使用它：

```ts
const o = new Proxy({ value: 1 }, {})
console.log(o.value) // 1
```

在这个例子中，`o` 的行为与普通对象几乎相同。

有趣的是，Proxy 可以接受第二个参数，用于注册处理器。
这个处理器是用来处理对象操作的。请看下面的例子：

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

在这个例子中，我们为生成的对象编写了配置。
具体来说，当访问（get）这个对象的属性时，原始对象（target）和被访问的 key 名会被输出到控制台。
让我们在浏览器中实际确认一下其行为。

![proxy_get](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/proxy_get.png)

你可以看到，当我们从这个由 Proxy 生成的对象的属性中读取值时，设置的处理被执行了。

同样，我们也可以设置 set 处理器：

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

![proxy_set](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/proxy_set.png)

对 Proxy 的理解到这个程度就足够了。 