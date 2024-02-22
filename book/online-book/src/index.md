---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "chibivue"
  text: "一步一步，从一行 \"Hello, World\" 开始"
  tagline: 由 VitePress 构建
  image: https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/logo.png?raw=true
  actions:
    - theme: brand
      text: 深入本书 ->
      link: /00-introduction/010-about
    - theme: alt
      text: 日文源站
      link: https://ubugeeei.github.io/chibivue/
    - theme: alt
      text: Vue.js 官方网站
      link: https://v3.vuejs.org/

features:
  - title: 响应式系统
    details: 从最基础的响应式原理开始，我们将涵盖从 EffectScope 到 CustomRef 这类高级 API 等大部分内容的实现。
    icon: 🔆
  - title: 虚拟 DOM
    details: 我们将涵盖从虚拟 DOM 到补丁渲染和任务调度等大部分内容的实现。
    icon: ⛅
  - title: 模板编译
    details: 从模板编译器的基本实现开始，我们将涵盖从数据绑定到自定义指令的各个内容的实现。
    icon: 🔁
  - title: 单文件组件
    details: 从单文件组件的基本实现开始，我们会从 script setup 开始深入到宏编译（macros）及 scoped CSS 的实现。
    icon: 🎁
---
