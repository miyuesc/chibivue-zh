# Hyper Ultimate Super Extreme Minimal Vue

## 项目设置 (0.5 分钟)

```sh
# 克隆本仓库并进入
git clone https://github.com/chibivue-land/chibivue
cd chibivue

# 使用 setup 命令创建项目
# 参数指定项目的根路径
nr setup ../my-chibivue-project
```

项目设置到此结束。

接下来让我们实现 packages/index.ts。

## createApp (1 分钟)

我们考虑一个可以指定 setup 函数和 render 函数的 create app 签名。
从用户的角度来看，使用方式如下：

```ts
const app = createApp({
  setup() {
    // TODO:
  },
  render() {
    // TODO:
  },
})

app.mount('#app')
```

让我们开始实现：

```ts
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
```

接收这个选项，然后返回一个实现了 mount 函数的对象就可以了。

```ts
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    // TODO: patch rendering
  },
})
```

好了，这部分完成了。

## h 函数和虚拟 DOM (0.5 分钟)

我们想要进行 patch 渲染，但为此需要虚拟 DOM 和用于生成它的函数。

虚拟 DOM 是用 JS 对象表示标签名、属性、子元素等信息的数据结构，
Vue 的渲染器基本上是通过处理这个虚拟 DOM 来更新实际的 DOM。
这次我们考虑实现一个包含名称、click 事件处理器和子元素（文本）的 VNode。

```ts
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })
```

好了，这部分完成了。

## patch rendering (2 分钟)

现在让我们实现渲染器。

这个渲染过程也被称为 patch 处理，顾名思义，

它通过比较新旧虚拟 DOM 来将差异更新到实际 DOM。

也就是说，函数签名应该是这样的：

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  // TODO:
}
```

这里 n1 是旧的 VNode，n2 是新的 VNode，container 是实际 DOM 的根元素。
在我们的例子中，`#app` 就是 container（在 createApp 中 mount 的元素）。

实现中需要考虑两种处理：

- mount  
  首次渲染。当 n1 为 null 时判断为首次渲染，执行挂载处理。
- patch  
  比较 VNode 之间的差异并更新到实际 DOM。
  不过，这次我们只更新 children，不进行差异检测。

让我们来实现：

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  const mountElement = (vnode: VNode, container: Element) => {
    const el = document.createElement(vnode.tag)
    el.textContent = vnode.children
    el.addEventListener('click', vnode.onClick)
    container.appendChild(el)
  }
  const patchElement = (_n1: VNode, n2: VNode) => {
    ;(container.firstElementChild as Element).textContent = n2.children
  }
  n1 == null ? mountElement(n2, container) : patchElement(n1, n2)
}
```

以上就是全部内容。

## Reactivity System (2 分钟)

接下来我们要实现追踪 setup 选项中设置的状态变化，

并触发 render 函数的处理。由于它追踪状态更新并执行特定作用，所以被称为"Reactivity System"。

这次我们考虑让用户使用 `reactive` 函数来定义状态。

```ts
const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
  // ..
  // ..
})
```

就是这样的感觉。
实际上，我们希望在通过 reactive 函数定义的状态发生变化时执行 patch 处理。

这是通过 Proxy 对象来实现的。
Proxy 可以实现对 get/set 的功能扩展。这次我们利用对 set 的扩展，在 set 时执行 patch 处理。

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      // ??? 这里想要执行 patch 处理
      return res
    },
  })
```

问题是在 set 中要触发什么。
本来应该通过 get 来追踪作用，但这次我们在全局作用域中定义 update 函数并引用它。

让我们使用之前实现的 render 函数来实现 update 函数。

```ts
let update: (() => void) | null = null // 为了在 Proxy 中引用而设置为全局
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup() // 只在初始化时执行 setup
    update = () => {
      // 通过闭包来实现 prevVNode 和 VNode 的比较
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})
```

好的。现在在 Proxy 的 set 中调用它：

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.() // 执行
      return res
    },
  })
```

## template compiler (5 分钟)

到目前为止，我们已经让用户可以通过 render 选项和 h 函数来实现声明式 UI，
但实际上我们希望能够使用类似 HTML 的方式来编写。

因此，让我们实现一个将 HTML 转换为 h 函数的模板编译器。

目标是将：

```
<button @click="increment">state: {{ state.count }}</button>
```

这样的字符串转换为：

```
h("button", increment, "state: " + state.count)
```

这样的函数。

让我们分几个步骤：

- parse  
  解析 HTML 字符串，转换为称为 AST 的对象。
- codegen  
  基于 AST 生成目标代码（字符串）。

首先，让我们实现 AST 和 parse：

```ts
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
```

这就是我们要处理的 AST。虽然看起来和 VNode 很像，但它们是完全不同的东西，这个是用来生成代码的。
Interpolation 是指胡子语法。<span v-pre>`{{ state.count }}`</span> 这样的字符串会被解析为 <span v-pre>`{ content: "state.count" }`</span> 这样的对象（AST）。

接下来只需要实现将给定字符串转换为 AST 的 parse 函数就可以了。
这里我们暂时使用正则表达式和一些字符串操作来实现：

```ts
const parse = (template: string): AST => {
  const RE = /<([a-z]+)\s@click=\"([a-z]+)\">(.+)<\/[a-z]+>/
  const [_, tag, onClick, children] = template.match(RE) || []

  const parseChildren = (children: string) => {
    const RE = /(.+){{(.+)}}/
    const matched = children.match(RE)
    if (!matched) return [children]
    const [_, text, exp] = matched
    return [text, { content: exp.trim() }]
  }

  return {
    tag: tag!,
    onClick: onClick!,
    children: parseChildren(children!),
  }
}
```

接下来是 codegen。
我们需要实现一个从 AST 生成 h 函数的函数。

```ts
const codegen = (ast: AST): string => {
  const children = ast.children
    .map((child) =>
      typeof child === 'string' ? `"${child}"` : child.content,
    )
    .join(' + ')
  return `h("${ast.tag}", ${ast.onClick}, ${children})`
}
```

好了，template compiler 的实现到此完成。

## SFC compiler (4 分钟)

最后我们来实现 SFC。

SFC 是 Single File Component（单文件组件）的缩写，是 Vue 的一个特色功能。

```vue
<script>
import { reactive } from 'hyper-ultimate-super-extreme-minimal-vue'

export default {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
}
</script>

<template>
  <button @click="increment">state: {{ state.count }}</button>
</template>
```

如上所示，它允许我们在一个文件中同时编写 script 和 template。

要实现这个功能，我们需要实现一个 vite 插件。

```ts
import type { Plugin } from 'vite'

export const husemVue = (): Plugin => {
  return {
    name: 'vite:husem-vue',
    transform: (code, id) => {
      if (!id.endsWith('.vue')) return code
      const RE = /<script>(.+)<\/script>.+<template>(.+)<\/template>/s
      const [_, script, template] = code.match(RE) || []
      const ast = parse(template!)
      const render = codegen(ast)
      return script!.replace(
        'export default {',
        `export default { render: (ctx) => ${render},`,
      )
    },
  }
}
```

这样就完成了。

## 完成 (15 分钟)

现在所有的实现都完成了。

让我们来实际运行一下。

```ts
// packages/index.ts
export { createApp } from './createApp'
export { reactive } from './reactive'
export { h } from './h'
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { husemVue } from './packages/plugin'

export default defineConfig({
  plugins: [husemVue()],
})
```

```vue
<!-- App.vue -->
<script>
import { reactive } from 'hyper-ultimate-super-extreme-minimal-vue'

export default {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
}
</script>

<template>
  <button @click="increment">state: {{ state.count }}</button>
</template>
```

```ts
// main.ts
import { createApp } from 'hyper-ultimate-super-extreme-minimal-vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

<video src="https://github.com/ubugeeei/chibivue/assets/71201308/f0c0c0c4-c0c4-4c0c-a0c4-c0c0c0c4c0c4" controls />

以上就是全部内容。
