# 包的设计

## 重构

你可能会想："什么？才实现这么点东西就要重构了？"，但请记住，这本书的目标之一是"能够阅读 Vue.js 的源代码"。
为此，我们也希望文件和目录结构始终与 Vue.js 保持一致。
所以，请让我稍微重构一下...

### Vue.js 的设计

#### runtime-core 和 runtime-dom

这里我们来解释一下 Vue.js 本身的结构。
在这次重构中，我们将创建 `runtime-core` 和 `runtime-dom` 两个目录。

那么它们分别是什么呢？runtime-core 包含了 Vue.js 运行时功能中最核心的部分。
不过在现阶段，可能很难理解什么是核心，什么不是核心。

所以，我们可以通过看它与 runtime-dom 的关系来更好地理解。
runtime-dom 顾名思义，是存放依赖 DOM 的实现的目录。简单理解为"依赖浏览器的处理"就可以了。
例如，它包含 querySelector 和 createElement 等 DOM 操作。

而 runtime-core 不包含这些处理，它只在纯 TypeScript 的世界中描述 Vue.js 运行时的核心逻辑。
例如，虚拟 DOM 的实现和组件相关的实现等。
随着 chibivue 的开发进展，这些概念会变得更加清晰，所以如果现在不太理解，只要按照本书的指示进行重构就可以了。

#### 各个文件的角色和依赖关系

我们将在 runtime-core 和 runtime-dom 中创建几个文件。需要的文件如下：

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

关于这些文件的角色，一开始用文字解释可能不太容易理解，所以请看下面的图：

![refactor_createApp!](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/refactor_createApp.png)

#### renderer 的设计

如前所述，Vue.js 将依赖 DOM 的部分和纯 Vue.js 核心功能部分分离开来。
首先，请注意 `runtime-core` 中的 renderer factory 和 `runtime-dom` 中的 nodeOps。
在之前的实现中，createApp 返回的 app 的 mount 方法直接进行渲染。

```ts
// 这是之前的代码
export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render() // 渲染
      }
    },
  }
}
```

到目前为止，代码很少，一点也不复杂，看起来似乎没有问题。
但是，随着我们将来要实现虚拟 DOM 的补丁渲染逻辑等，代码会变得相当复杂。
Vue.js 将这个负责渲染的部分作为 `renderer` 分离出来。
这就是 `runtime-core/renderer.ts`。
说到渲染，在 SPA 中很容易想到它依赖于浏览器的 DOM API (document)。
（比如创建 element 或设置 text 等）
为了将这个依赖 DOM 的部分与 Vue.js 的核心渲染逻辑分离，做了一些设计上的工夫：

- 在 `runtime-dom/nodeOps` 中实现用于 DOM 操作的对象
- 在 `runtime-core/renderer` 中只实现生成纯渲染逻辑对象的工厂函数。
  这时，处理 Node（不限于 DOM）的对象作为工厂函数的参数传入。
- 在 `runtime-dom/index.ts` 中使用 nodeOps 和 renderer 的工厂函数来完成 renderer

这就是图中红色框起来的部分。
![refactor_createApp_render](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/refactor_createApp_render.png)

让我们用代码来解释。现在我们还没有实现虚拟 DOM 的渲染功能，所以先用与之前相同的功能来实现。

首先，在 `runtime-core/renderer` 中实现 Node（不限于 DOM）操作对象的接口：

```ts
export interface RendererOptions<HostNode = RendererNode> {
  setElementText(node: HostNode, text: string): void
}

export interface RendererNode {
  [key: string]: any
}

export interface RendererElement extends RendererNode {}
```

这里现在只有 setElementText 函数，但将来会实现 createElement、removeChild 等函数，请保持这个印象。

关于 RendererNode 和 RendererElement，现在暂时不用太在意。（这里的实现不能依赖于 DOM，所以只是定义了一个可以作为 Node 的东西，并使用泛型。）
我们将在这个文件中实现一个接收 RendererOptions 的 renderer 工厂函数：

```ts
export type RootRenderFunction<HostElement = RendererElement> = (
  message: string,
  container: HostElement,
) => void

export function createRenderer(options: RendererOptions) {
  const { setElementText: hostSetElementText } = options

  const render: RootRenderFunction = (message, container) => {
    hostSetElementText(container, message) // 现在只是插入消息，所以是这样的实现
  }

  return { render }
}
```

接下来是 `runtime-dom/nodeOps` 的实现：

```ts
import { RendererOptions } from '../runtime-core'

export const nodeOps: RendererOptions<Node> = {
  setElementText(node, text) {
    node.textContent = text
  },
}
```

这部分应该不难理解。

然后，让我们在 `runtime-dom/index.ts` 中完成 renderer：

```ts
import { createRenderer } from '../runtime-core'
import { nodeOps } from './nodeOps'

const { render } = createRenderer(nodeOps)
```

这样 renderer 部分的重构就完成了。

#### DI 和 DIP

我们看了 renderer 的设计。让我们再次整理一下：

- 在 runtime-core/renderer 中实现生成 renderer 的工厂函数
- 在 runtime-dom/nodeOps 中实现用于 DOM 操作的对象
- 在 runtime-dom/index 中结合工厂函数和 nodeOps 生成 renderer

这种设计一般称为使用"DIP"的"DI"。
首先，关于 DIP（Dependency inversion principle，依赖倒置原则），通过实现接口来实现依赖性的倒置。
需要注意的是 renderer.ts 中实现的 `RendererOptions` 接口。
工厂函数和 nodeOps 都要按照这个 `RendererOptions` 来实现。（依赖于 RendererOptions 接口）
利用这个来进行 DI。DI（Dependency Injection，依赖注入）是通过从外部注入对象所依赖的对象来降低依赖度的技术。
在这个例子中，renderer 依赖于 RendererOptions（实现了该接口的对象，在这里是 nodeOps）。
我们避免在 renderer 中直接调用这个依赖，而是通过工厂函数的参数（从外部注入）来接收它。
通过这些技术，我们实现了让 renderer 不依赖于 DOM 的设计。

如果不熟悉，DI 和 DIP 可能是比较难理解的概念，但这是经常出现的重要技术，所以希望大家能自己研究一下来理解。

### 完成 createApp

回到实现，现在我们已经生成了 renderer，接下来只需要考虑下图中红色区域的部分：

![refactor_createApp_createApp](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/refactor_createApp_createApp.png)

其实很简单，只需要实现 createApp 的工厂函数，让它能接收我们刚才创建的 renderer：

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

虽然我们把一些类型移到了 `~/packages/runtime-core/component.ts` 等文件中，但这些细节不太重要，你可以参考源代码。
（这只是为了与 Vue.js 本身保持一致。）

现在我们的代码更接近 Vue.js 的源代码了，让我们来测试一下。如果消息仍然能正常显示，那就说明一切正常。

到目前为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/015_package_architecture) 