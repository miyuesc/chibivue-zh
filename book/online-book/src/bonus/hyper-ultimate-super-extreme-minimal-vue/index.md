# chibivue？这哪里 chibi 了！？太大了，受不了了！？

## 太大了......

对那些这样想的人，我深表歉意。

在拿起这本书之前，你可能想象的是一个更小的项目。

让我稍微解释一下，其实我自己也没打算做得这么大。

只是在做的过程中太有趣了，不知不觉就想着"哦，接下来要不要试试添加这个功能"，结果就变成现在这样了。

## 好吧，那我们来设定一个时间限制。

项目变得太大的原因之一是"没有时间限制"。

所以，在这个附录中，我们将尝试在"**15分钟**"内完成实现。

当然，说明也只用一页就够了。

而且，我们的目标不仅是将页面限制在一页内，还要"将实现本身也限制在一个文件内"。

不过，虽说是一个文件，如果写了10万行代码那就失去意义了，所以我们的目标是在150行左右完成实现。

我们给它起名叫"**Hyper Ultimate Super Extreme Minimal Vue**"

::: info 关于名字的由来

很多人可能觉得这个名字很幼稚。

我也这么觉得。

不过，这个名字是有特定原因的。

我想要强调它的小巧，同时又想要一个缩写，所以就用了这个词序。

这个缩写就是"HUSEM Vue（气球 Vue）"。

我们接下来要进行一些非常粗糙的实现，这种粗糙程度就像"气球"一样。
就像气球一样，只要被针轻轻碰到就会破裂的那种感觉。

:::

## 反正就是简单实现一下响应式系统吧？

不，不是这样的。下面列举一下我们将在15分钟内实现的功能：

- create app api
- Virtual DOM
- patch rendering
- Reactivity System
- template compiler
- sfc compiler (vite-plugin)

我们会实现这些功能。

也就是说，SFC（单文件组件）是可以运行的。

作为源代码，我们期望能够运行如下代码：

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

```ts
import { createApp } from 'hyper-ultimate-super-extreme-minimal-vue'

// @ts-ignore
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
``` 