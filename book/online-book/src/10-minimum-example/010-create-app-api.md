# 首次渲染和 createApp API

## Vue.js 开发者接口

## 我该从哪儿开始呢? 🤔

现在，让我们从这里开始一步步的实现 chibivue。
那么我们应该怎么开始呢？

这是我一直在注意的事情，就是在创建一个项目（库）时，首先应该考虑它如何使用。

为了方便起见，我们将“实际使用 chibivue 来进行 Web 应用开发时需要遵循的代码结构和语法等内容”称为“开发者接口”。

当然，这里的开发者并不是指 chibivue 的开发人员，而是指使用 chibivue 来进行 Web 应用开发的开发人员。

也就是说，我们在实现 chibivue 的时候，也可以参考 Vue.js 源码提供的开发者接口。

那么，我们就可以从使用 Vue.js 进行 Web 应用开发时是如何编写代码来开始了。

> 译者注：这里个人理解的开发者接口，实际上指的是我们开发的内容，在将这部分开发内容提供给其他开发者使用时应该遵循的格式。
> 例如使用 Vue.js SFC 开发时就必须要有一个 `template` 或者 `script` 标签一样。
>
> 为了方便翻译，后面的内容大部分情况下都不会对 “开发者接口” 这个做特殊说明，希望大家理解。


## 开发者接口的不同级别? 🤔

值得注意的是，Vue.js 为开发人员提供了很多个不同的开发者接口，并且这些接口都有不同的级别。
（这里的级别指的是与原生 JavaScript 的接近程度）
例如，下面是一个使用 Vue.js 编写 HTML 内容的不同开发者接口示例。

1. 单文件组件的写法

```vue
<!-- App.vue -->
<template>
  <div>Hello world.</div>
</template>
```

```ts
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

2. 使用 template 模板的写法

```ts
import { createApp } from 'vue'

const app = createApp({
  template: '<div>Hello world.</div>',
})

app.mount('#app')
```

3. 使用 render 选项与 h 渲染函数的写法

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

当然也还有其他的一些写法，但是我们这里主要只考虑这三种写法（接口）。
我们可以先思考其中哪一种方法最接近原生 JavaScript 的写法。
答案肯定是第三种“使用 render 选项与 h 渲染函数”。
第一种方式需要实现 SFC 编译器和数据绑定，第二种方式需要将 template 模板选项（HTML 字符串）进行转换成 JS 代码，不然的话也是无法工作的。

为图简便，我将其称为“**低级开发者接口**”，因为它更加接近于原生的 JS。
当然这也是最重要的一部分，需要“从最基础的低级接口的实现开始”。
因为在很多情况下，高级语法都需要被转化成低级语法。
也就是说，1 和 2 最终也会被转换成 3 的形式，这部分转化功能，被称为 **编译器**。

那么现在，就让我们从实现 3 这样的低级开发者接口开始吧

## createApp API 和元素渲染

## 方法

虽然是以第三种形式做为目标，但是目前我们关于 h 函数具体是怎么实现的还是不清楚。
不过这本书的目标就是 **增量开发**，一步一步的完善。
所以，我们在这里先不要追求完成的实现 3 的接口，而是尝试实现下面这样的简化形式，将 render 函数返回一个字符串然后我们在页面上将其显示出来。

例如 ↓

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

## 快速实现

首先在 `~/packages/index.ts` 中创建一个 `createApp` 方法。

※ helloChibivue 现在就不需要了，我们直接把它删除掉。

```ts
export type Options = {
  render: () => string
}

export type App = {
  mount: (selector: string) => void
}

export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render()
      }
    },
  }
}
```

这是不是很简单。
现在，让我们切换到 playground 去体验一下吧。

`~/examples/playground/src/main.ts`

```ts
import { createApp } from 'chibivue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

nice！ 现在我们就能在网页上显示一条消息了。

![hello_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/hello_createApp.png)

当前的源代码位于:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)

## 重构

也许你可能会疑惑“什么？已经实现了还需要重构它吗？”。但是毕竟本书的目的是为了让大家能够理解 Vue.js 的源码。
所以，除了实现基础功能之外，您也应该了解 Vue.js 的目录结构和文件组成。

所以，我们这里需要稍微重构以下

### Vue.js 的设计思路

#### runtime-core 与 runtime-dom

这里稍微解释一下 Vue.js 的源码的基本组成部分。
在这次重构中，我们将创建一个名为 `runtime-core` 的目录和一个名为 `runtime-dom` 的目录。

其中，`runtime-core` 包含了 Vue.js 的核心的运行时部分。

当然，即使这么说估计大家现在也很难理解，哪些才是核心部分，哪些又不是呢？

所以，如果我们看一下它和 runtime-dom 之间的关系，应该就更好理解了。

runtime-dom，顾名思义，是一个依赖 DOM 提供的 API 来实现的内容。可以简单理解为：内部的代码运行都需要依赖浏览器环境。
例如 `querySelector` 和 `createElement` 这样的 DOM 操作。

在 runtime-core 中并没有与 DOM 相关的操作，它的定位是通过纯粹的 TypeScript 语法来实现与 Vue.js 运行时相关的核心逻辑。
例如虚拟 DOM 和组件系统的实现。

当然，我想随着 chibivue 的不断更新和完善，大家对这部分内容的理解会更加的清晰。
所以，如果您现在还不是很理解这部分内容，那就继续跟着我一起完善下去就好了。

#### 内部各文件的作用和依赖关系

现在我们需要在 runtime-core 和 runtime-dom 中创建一些文件。

所需文件如下：

```sh
pwd # ~
mkdir packages/runtime-core
mkdir packages/runtime-dom

## core
touch packages/runtime-core/index.ts
touch packages/runtime-core/apiCreateApp.ts
touch packages/runtime-core/component.ts
touch packages/runtime-core/componentOptions.ts
touch packages/runtime-core/renderer.ts

## dom
touch packages/runtime-dom/index.ts
touch packages/runtime-dom/nodeOps.ts
```

对于这些文件所扮演的角色以及它们之间的依赖关系，我觉得用文字是很难解释的，所以我画了一张图：

![refactor_createApp!](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp.png)

#### renderer 渲染器的设计

正如之前提到的，Vue.js 将与 DOM 操作相关的部分与 Vue.js 的核心逻辑部分进行了拆分。
那么现在我想让大家先关注的部分是 `runtime-core` 的 renderer factory 渲染器构造函数和 `runtime-dom` 中的 nodeOps 部分。

在之前的例子中，我们是直接使用 `createApp` 方法返回的 app 对象中的 mount 方法来渲染的。

```ts
// 这是之前我们的代码
export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render() // レンダリング
      }
    },
  }
}
```

这里我们只写了很少的代码，逻辑也很简单，所以看起来基本上没什么问题。
但是以后这个方法（`mount`）将会变得非常复杂，因为我们需要在里实现虚拟 DOM 的补丁渲染（patch rendering）部分。

在 Vue.js 中，负责渲染的 `renderer` 部分被独立了出来，即 `runtime-core/renderer.ts` 这个文件里面的内容。

说到渲染，大家都能想到 SPA 都是依赖浏览器提供的 DOM 相关的 API 来完成渲染的（例如创建元素、设置文本等）。

所以，为了与 DOM 操作相关的逻辑进行拆分，我们需要再添加下面的内容：

- 在 `runtime-dom/nodeOps` 中实现一个新对象用来进行 DOM 操作
- `runtime-core/renderer` 中我们需要实现一个创建 renderer 渲染器的工厂函数，用来创建一个包含渲染逻辑的对象。但是这里需要注意的是，具体的渲染逻辑（依赖 DOM 的部分）需要作为这个函数的参数传递进去。
- 在 `runtime-dom/index.ts` 中完成依赖 DOM 提供的 API 实现的 nodeOps 操作函数对象以及 renderer 渲染器的创建。

也就是图中红色框的标注部分。
![refactor_createApp_render](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp_render.png)

这里需要对当前的源码进行说明。
此时我们并没有实现根据 Virtual DOM 进行渲染的功能，所以我们需要对它进行实现，并且保证和之前的功能一致。

首先，我们需要在 `runtime-core/renderer` 中实现一个基础的不依赖 DOM 的节点接口。

```ts
export interface RendererOptions<HostNode = RendererNode> {
  setElementText(node: HostNode, text: string): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}
```

当然，目前这里只有一个 `setElementText` 函数。但是我们最终还是会实现 `createElement`、`removeChild` 这些函数。
这里也不要担心 RendererNodes 和 RendererElements 的类型定义，因为这部分内容最终不会依赖于 DOM，只需要定义一个节点对象 Node 的大概类型（可以视为对象泛型）就行了。
renderer 对象的工厂函数接收一个 RendererOptions 形式的对象参数。

```ts
export type RootRenderFunction<HostElement = RendererElement> = (
  message: string,
  container: HostElement,
) => void

export function createRenderer(options: RendererOptions) {
  const { setElementText: hostSetElementText } = options

  const render: RootRenderFunction = (message, container) => {
    hostSetElementText(container, message) // 今回はメッセージを挿入するだけなのでこういう実装になっている
  }

  return { render }
}
```

然后，我们需要实现 `runtime-dom/nodeOps`。

```ts
import { RendererOptions } from '../runtime-core'

export const nodeOps: RendererOptions<Node> = {
  setElementText(node, text) {
    node.textContent = text
  },
}
```

我觉得到这里为止都非常容易。

现在，就需要在 `runtime-dom/index.ts` 中根据这些内容来实现一个 renderer 渲染器了。

```ts
import { createRenderer } from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
```

这样，我们就完成了 renderer 部分的重构。

#### DI（依赖注入）和 DIP（依赖反转）

根据上面 renderer 部分的设计与代码实现，我们可以重新整理一下：

- runtime-core/renderer：实现创建 renderer 对象的工厂函数
- runtime-dom/nodeOps：依赖 DOM 提供的 API 来实现的节点操作对象
- runtime-dom/index：根据 runtime-core/renderer 提供的工厂函数和 runtime-dom/nodeOps 提供的操作对象来创建一个 renderer 实例

就是这样的实现方式。
一般我们称为根据“DIP”模式实现的“DI”。

首先，关于 DIP（Dependency inversion principle，依赖反转）中的依赖反转实现，是通过我们在 renderer.ts 中实现的这个 `RendererOptions` 的接口。
我们实现的 renderer 的工厂函数以及 nodeOps 对象，都是为了保护这个 `RendererOptions` 类型的参数。
然后，我们就可以利用这几个来实现 DI。
DI（Dependency Injection，依赖注入）是 **通过从外部参数传递（注入）一个或者多个依赖对象，来减少对象本身的依赖** 的设计模式。
这次我们通过 renderer 依赖传递的 RendererOptions（类型定义，需要实现一个这种类型的对象，也就是本例中实现的 nodeOps）参数，而不是直接在 renderer 中实现这个依赖，从而使得 renderer 可以独立于 DOM 之外。

当然，如果您现在还不是很了解 DI 和 DIP，或者还不理解他们的概念。我希望您能私下多多研究，毕竟这是经常使用并且非常重要的一种实现模式。

### 完成 createApp 方法

现在回到应用创建。此时我们的 renderer 渲染器已经实现完成了，接下来就需要考虑图中红色区域标注的另外一部分了。

![refactor_createApp_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/refactor_createApp_createApp.png)

话虽如此，要做的事情还是简单的的，只要将刚才制作的 renderer 交给 `createApp` 这个工厂函数即可。

```ts
// ~/packages/runtime-core apiCreateApp.ts

import { Component } from './component'
import { RootRenderFunction } from './renderer'

export interface App<HostElement = any> {
  mount(rootContainer: HostElement | string): void
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
) => App<HostElement>

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const message = rootComponent.render!()
        render(message, rootContainer)
      },
    }

    return app
  }
}
```

```ts
// ~/packages/runtime-dom/index.ts

import {
  CreateAppFunction,
  createAppAPI,
  createRenderer,
} from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
const _createApp = createAppAPI(render)

export const createApp = ((...args) => {
  const app = _createApp(...args)
  const { mount } = app
  app.mount = (selector: string) => {
    const container = document.querySelector(selector)
    if (!container) return
    mount(container)
  }

  return app
}) as CreateAppFunction<Element>
```

我将一部分类型移动到了 `~/packages/runtime-core/component.ts` 里面（为了和 Vue.js 的结构对齐），但是这并不影响我们阅读这部分的源代码。

到目前为止，我们这部分已经和 Vue.js 的源码很接近了，那么我们来测试以下，如果上面的那条信息任然显示的话，就说明我们成功了。

这部分源码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/010_create_app2)
