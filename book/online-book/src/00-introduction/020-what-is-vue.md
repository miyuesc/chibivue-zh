# Vue.js 是什么

## 回顾 Vue.js

我们直接进入正题吧。

在此之前，我们先回顾一下 Vue.js。

## 什么是 Vue.js ?

Vue.js 是一个 “用于构建 Web 用户界面的友好、高性能且多功能的框架”。

这是 [Vue 官方文档](https://cn.vuejs.org/) 首页上的说明。

我觉得直接照官方的说法比自己的解释更加容易理解，所以下面引用一下。

> Vue (发音为 /vjuː/，类似 view) 是一款用于构建用户界面的 JavaScript 框架。它基于标准 HTML、CSS 和 JavaScript 构建，并提供了一套声明式的、组件化的编程模型，帮助你高效地开发用户界面。无论是简单还是复杂的界面，Vue 都可以胜任。

> **声明式渲染**：Vue 基于标准 HTML 拓展了一套模板语法，使得我们可以声明式地描述最终输出的 HTML 和 JavaScript 状态之间的关系。

> **响应性**：Vue 会自动跟踪 JavaScript 状态并在其发生变化时响应式地更新 DOM。

> 最简单的使用示例如下:
>
> ```ts
> import { createApp } from "vue";
>
> createApp({
>   data() {
>     return {
>       count: 0,
>     };
>   },
> }).mount("#app");
> ```
>
> ```html
> <div id="app">
>   <button @click="count++">Count is: {{ count }}</button>
> </div>
> ```

[引用自](https://cn.vuejs.org/guide/introduction.html#what-is-vue)

对于声明式渲染和响应性，我们将在各自的章节中详细深入探讨，目前有个大致的了解就可以了。

另外，这里出现了“框架”这个词，也就是 Vue.js 声称自己是一个“渐进式框架”。对此，我认为参考官方文档的这部分内容是最简洁、准确、容易理解的。

https://cn.vuejs.org/guide/introduction.html#the-progressive-framework

## 官方文档和本书的区别

官方文档重点介绍 “如何使用 Vue.js”，并配有丰富的教程和指南。

然而，在本书中，我们采取了稍微不同的方法，重点关注 “Vue.js 是如何实现的”，并在实际编写代码来实现 Vue.js 的简化版本。

另外，本书并非官方出版物，所以可能并不详尽。关于存在一些错误或遗漏，欢迎大家反馈或纠正。

