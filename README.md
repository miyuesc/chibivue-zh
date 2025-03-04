> **Fork `chibivue` from [chibivue-land/chibivue](https://github.com/chibivue-land/chibivue)，请大家关注原作者！**

<p align="center">
  <img src="./book/images/logo/chibivue-img.png" width="600">
</p>

<div align="center">

### [**从"Hello, World"的开始，一步步地实现 Vue.js**](https://miyuesc.github.io/chibivue-zh/)

</div>

> **Japanese Source Repo: https://github.com/chibivue-land/chibivue**
>
> **online: https://book.chibivue.land/**
---

chibivue 是 [vuejs/core](https://github.com/vuejs/core) 的最小实现。  
（包括响应式系统、虚拟 DOM 和补丁渲染、组件系统、模板编译器、SFC 编译器）

"chibi" 在日语中意为"小"。

这个项目始于 2023 年 2 月，目标是简化对 Vue 核心实现的理解。

目前，我仍在实现过程中，但在实现完成后，我也计划发布解释性文章。

> （目前作者的计划先发布日语版本。）

[示例](https://github.com/chibivue-land/chibivue/tree/main/examples/app)

# 👜 包管理器

本项目使用 [pnpm](https://pnpm.io/) 作为包管理器。

并使用 [ni](https://github.com/antfu/ni)。

```sh
# 如果你还没有安装 ni
npm i -g @antfu/ni
```

# 📔 在线阅读

[![Pages Deploy](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml)

> 总计：370,000 字 ↑（日语）

### 书籍链接 (GitHub Pages)

English：https://book.chibivue.land/

日本語：https://book.chibivue.land/ja

中文：https://miyuesc.github.io/chibivue-zh/

### 本地运行

```sh
# 日文与英文
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ ni
$ nr book:dev

# 中文
$ git clone https://github.com/miyuesc/chibivue-zh
$ cd chibivue-zh
$ ni
$ nr book:dev
```

### 在 GitHub 上查看

[English](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src) | [日本語](https://github.com/chibivue-land/chibivue/tree/main/book/online-book/src/ja) | [中文](https://github.com/miyuesc/chibivue-zh/tree/main/book/online-book/src)
<br/>
<br/>

# 🎥 演示环境

```sh
$ git clone https://github.com/chibivue-land/chibivue
$ cd chibivue
$ ni

# 在 ~/example/playground 生成演示文件（git 已忽略）
$ nr setup:dev

# 监听本地主机
$ nr dev
```

# ⚠️ 编写状态

这本在线书籍目前正在编写中。

请参考以下信息了解进度状态。

### 响应式系统

| feature         | impl | book |
| --------------- | ---- | ---- |
| ref             | ✅   | ✅   |
| computed        | ✅   | ✅   |
| reactive        | ✅   | ✅   |
| readonly        | ✅   | ✅   |
| watch           | ✅   | ✅   |
| watchEffect     | ✅   | ✅   |
| isRef           | ✅   | ✅   |
| unref           | ✅   | ✅   |
| toRef           | ✅   | ✅   |
| toRefs          | ✅   | ✅   |
| isProxy         | ✅   | ✅   |
| isReactive      | ✅   | ✅   |
| isReadonly      | ✅   | ✅   |
| shallowRef      | ✅   | ✅   |
| triggerRef      | ✅   | ✅   |
| shallowReactive | ✅   | ✅   |
| customRef       | ✅   | ✅   |
| toRaw           | ✅   | ✅   |
| effectScope     | ✅   | ✅   |
| getCurrentScope | ✅   | ✅   |
| onScopeDispose  | ✅   | ✅   |
| template refs   | ✅   | ✅   |

### 虚拟 DOM 和渲染器

| feature         | impl | book |
| --------------- | ---- | ---- |
| h function      | ✅   | ✅   |
| patch rendering | ✅   | ✅   |
| key attribute   | ✅   | ✅   |
| scheduler       | ✅   | ✅   |
| nextTick        | ✅   | ✅   |
| ssr             |      |      |

### 组件系统

| feature                      | impl | book |
| ---------------------------- | ---- | ---- |
| Options API (typed)          | ✅   | ✅   |
| Composition API              | ✅   | ✅   |
| lifecycle hooks              | ✅   | ✅   |
| props / emit                 | ✅   | ✅   |
| expose                       | ✅   | ✅   |
| provide / inject             | ✅   | ✅   |
| slot (default)               | ✅   | ✅   |
| slot (named/scoped)          | ✅   | ✅   |
| async component and suspense |      |      |

### 模板编译器

| feature            | impl | book |
| ------------------ | ---- | ---- |
| v-bind             | ✅   | ✅   |
| v-on               | ✅   | ✅   |
| event modifier     | ✅   | ✅   |
| v-if               | ✅   | ✅   |
| v-for              | ✅   | ✅   |
| v-model            | ✅   |      |
| v-show             |      |      |
| mustache           | ✅   | ✅   |
| slot (default)     |      |      |
| slot (named)       |      |      |
| slot (scoped)      |      |      |
| dynamic component  |      |      |
| comment out        | ✅   | ✅   |
| fragment           | ✅   | ✅   |
| bind expressions   | ✅   | ✅   |
| resolve components | ✅   | ✅   |

### SFC 编译器

| feature                          | impl | book |
| -------------------------------- | ---- | ---- |
| basics (template, script, style) | ✅   | ✅   |
| scoped css                       |      |      |
| script setup                     | ✅   |      |
| compiler macro                   | ✅   |      |

### 扩展和其他内置功能

| feature    | impl | book |
| ---------- | ---- | ---- |
| store      | ✅   |      |
| router     | ✅   |      |
| keep-alive |      |      |
| suspense   |      |      |

# 🗓️ 重大计划

- 完成基础模板编译器
  - 插槽
- 完成基础 SFC 编译器
  - script setup
  - 编译器宏
- 整体重构
  - 修复错别字和错误
  - 审查英文版本文本
  - 使解释更容易理解
- SSR / SSG 的实现和解释
- 编译时优化的实现和解释  
  包括树扁平化和静态提升等
- 整合可能包含在 Vue.js 3.4 中的解析器重构    
  https://github.com/vuejs/core/pull/9674
- 整合可能包含在 Vue.js 3.4 中的响应式包重构    
  https://github.com/vuejs/core/pull/5912
- 🌟 **Vapor Mode** 的实现和解释    
  由于官方版本尚未发布，我们将基于预测进行实现。    
  https://github.com/vuejs/core-vapor/tree/main

# 🎉 额外章节

由于 chibivue 整体已经变得很大了，所以提供了一个 15 分钟内编写 Vue.js 的额外章节。

本章在仅仅 110 行源代码中实现了 createApp / 虚拟 dom / patch / 响应式系统 / 模板编译器 / sfc 编译器。

标题是 "**超究极迷你 Vue - 15 分钟编写 Vue.js**"

[在线书籍](https://book.chibivue.land/bonus/hyper-ultimate-super-extreme-minimal-vue) | [实际源码](https://github.com/chibivue-land/chibivue/blob/main/book/impls/bonus/hyper-ultimate-super-extreme-minimal-vue/packages/index.ts)

<img src="./book/images/hyper-ultimate-super-extreme-minimal-vue.png">

# 贡献

请查看 [contributing.md](https://github.com/chibivue-land/chibivue/blob/main/.github/contributing.md)。


<div align="center">

# 赞助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

如果您想支持我的工作，我将非常感激！

https://github.com/sponsors/ubugeeei

</div>

</div>