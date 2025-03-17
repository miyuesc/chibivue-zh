# 开篇

## 🎯 本书的目的

感谢您阅读本书！  
如果您对本书有哪怕一点点兴趣，我都感到非常高兴。  
让我首先总结一下本书期望达到的目的。

**☆ 目的**

- **深入理解 Vue.js**  
  什么是 Vue.js？它是如何构建的？
- **能够实现 Vue.js 的基本功能**  
  实际动手实现 Vue 的基本功能。
- **阅读 vuejs/core 的源代码**  
  理解书中的代码实现与官方代码之间的关系，掌握它们实际是如何构建的。

我只是提供了几个大致的学习目标，但您没有必要完成所有目标，也不需要追求完美。  
无论您是从头到尾阅读，还是只选择感兴趣的部分，这都取决于您自己的偏好。  
只要您能从本书中找到哪怕一小部分有用的内容，我都会感到高兴！

## 🤷‍♂️ 目标读者

- **有 Vue.js 的使用经验**
- **会使用 TypeScript 编写代码**

只需满足这两个前提条件就可以开始阅读本书了，并不需要其他知识。  
虽然您可能会在本书中遇到不熟悉的术语，但我也会尽力避免这种需要预备知识的情况，并在讲解过程中提供必要的解释，使本书能够自成体系。  
当然，如果您现在还不是很了解 Vue.js 或者 TypeScript 的使用，我建议您先从相应的文档资源中学习相关的内容。  
（基本功能就足够了（不需要深入研究）！）

## 🙋‍♀️ 写这本书的意图 (作者想做的事情)

在开始之前，我想分享一些我在写这本书时特别注重的的几个方面。  
希望您在阅读时能记住这些内容；如果有任何我没有做好的地方，也请您能及时告诉我。

- **消除对预备知识的需求**  
  虽然这可能与前面提到的“目标读者”部分有所重叠，但我努力使本书尽可能自成体系，  
  最大限度地减少对预备知识的需求，并在需要时提供解释。  
  这是因为我希望向尽可能多的读者提供清晰的解释。  
  有丰富经验的读者可能会觉得一些解释有点冗长，但请理解。

- **增量实现**  
  本书的目标之一是手动增量实现 Vue.js。这意味着本书注重实践方法，  
  在实现方面，我强调以小步骤增量构建。  
  更具体地说，就是"最小化非工作状态"。  
  不是等到完成才能工作，而是在每个阶段都保持功能正常。  
  这反映了我个人的编码方法 - 持续编写不能运行的代码会让人沮丧。  
  即使不完美，始终保持代码运行也会让过程更加愉快。  
  这是关于体验小胜利，比如"太好了！现在它工作到这一步了！"

- **避免对特定框架、库或语言的偏见**  
  虽然本书专注于 Vue.js，但当今有无数优秀的框架、库和语言。  
  事实上，我在 Vue.js 之外也有自己喜欢的工具，并经常从它们的见解和服务中受益。  
  本书的目的纯粹是"理解 Vue.js"，不涉及对其他工具的排名或评判。

## 💡 本在线书籍的主题和结构

由于本书内容相当丰富，我设置了成就里程碑，并将其分为不同的部分。

- **最小示例部分**  
   在这里，Vue.js 以最基本的形式实现。  
   虽然本部分涵盖了最小的功能集，但将处理  
   虚拟 DOM、响应式系统、编译器和 SFC（单文件组件）支持。  
   然而，这些实现远非实用，且高度简化。  
   但对于想要对 Vue.js 有广泛了解的人来说，本部分提供了足够的见解。  
   作为入门部分，这里的解释比其他部分更详细。  
   到本部分结束时，读者应该能够较为舒适地阅读官方 Vue.js 源代码。从功能上讲，您可以期望代码大致执行以下操作...

  ```html
  <script>
  import { reactive } from 'chibivue'

  export default {
    setup() {
      const state = reactive({ message: 'Hello, chibivue!', input: '' })

      const changeMessage = () => {
        state.message += '!'
      }

      const handleInput = e => {
        state.input = e.target?.value ?? ''
      }

      return { state, changeMessage, handleInput }
    },
  }
  </script>

  <template>
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage">click me!</button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>
    </div>
  </template>

  <style>
  .container {
    height: 100vh;
    padding: 16px;
    background-color: #becdbe;
    color: #2c3e50;
  }
  </style>
  ```

  ```ts
  import { createApp } from 'chibivue'
  import App from './App.vue'

  const app = createApp(App)

  app.mount('#app')
  ```

- **基础虚拟 DOM 部分**  
  在本部分中，我们将为虚拟 DOM 实现相当实用的补丁渲染功能。虽然我们不会实现像 [Suspense](https://vuejs.org/guide/built-ins/suspense) 这样的功能或其他优化，但它将足以处理基本的渲染任务。我们还将在这里实现调度器。

- **基础响应式系统部分**  
  虽然我们在最小示例部分中实现了 reactive API，但在本部分中，我们将实现其他 API。从基本 API 如 ref、watch 和 computed 开始，我们还将深入研究更高级的 API，如 effectScope 和 shallow 系列。

- **基础组件系统部分**  
  在这里，我们将进行与组件系统相关的基本实现。实际上，由于我们已经在基础虚拟 DOM 部分中设置了组件系统的基础，这里我们将专注于组件系统的其他方面。这包括 props/emit、provide/inject、响应式系统的扩展和生命周期钩子等功能。

- **基础模板编译器部分**  
  除了为基础虚拟 DOM 部分中实现的虚拟 DOM 系统提供编译器外，我们还将实现 v-on、v-bind 和 v-for 等指令。通常，这将涉及组件的模板选项，我们不会在这里涵盖 SFC（单文件组件）。

- **基础 SFC 编译器部分**  
  在这里，我们将实现一个相当实用的 SFC 编译器，同时利用基础模板编译器部分中实现的模板编译器。  
  具体来说，我们将实现 script setup 和编译器宏。  
  在这一点上，体验将非常接近使用常规 Vue。

- **Web 应用程序基础部分**  
  当我们完成基础 SFC 编译器部分时，我们将拥有一组相当实用的 Vue.js 功能。然而，要开发 Web 应用程序，仍然缺少很多东西。例如，我们需要管理全局状态和路由器的工具。在本部分中，我们将开发这些外部插件，旨在从"Web 应用程序开发"的角度使我们的工具包更加实用。

## 🧑‍🏫 关于本书的意见和问题

我打算尽我所能回应关于本书的问题和反馈。请随时在 Twitter 上联系我（通过 DM 或直接在时间线上）。由于我已经公开了存储库，您也可以在那里发布问题。我知道我自己的理解并不完美，所以我感谢任何反馈。如果您发现任何解释不清楚或具有挑战性，请不要犹豫，尽管提问。我的目标是向尽可能多的人传播清晰和正确的解释，希望我们能一起构建这个项目 👍。

https://twitter.com/ubugeeei

## 🦀 关于 Discord 服务器

我们为本书创建了一个 Discord 服务器！(2024/01/01)  
~~在这里，我们分享公告，为与本在线书籍相关的问题和提示提供支持。~~ \
我们也欢迎随意交流，让我们一起与其他 chibivue 用户愉快地交流吧。  
目前，由于有很多日语使用者，大多数对话都是用日语进行的，但非日语使用者也欢迎毫不犹豫地加入！（使用您的母语完全没问题）

最近，我们不仅积极为 chibivue 做贡献，还作为 Vue.js 日本社区服务器的一部分做出贡献！

### 我们大致做什么

- 自我介绍（可选）
- 与 chibivue 相关的公告（如更新）
- 分享提示
- 回答问题
- 响应请求
- 随意交流

### 如何加入

这是邀请链接 👉 https://discord.gg/aVHvmbmSRy

您也可以从本书头部右上角的 Discord 按钮加入。

## 关于作者

**ubugeeei**

<img src="/ubugeeei.jpg" alt="ubugeeei" width="200">

[Vue.js](https://github.com/vuejs) 成员，[Vue.js Japan User Group](https://github.com/vuejs-jp) 核心工作人员。\
[chibivue land](https://github.com/chibivue-land) 的所有者。

https://ublog.dev/

<div align="center">

## 赞助商

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

如果您想支持我的工作，我将不胜感激！

https://github.com/sponsors/ubugeeei

</div>
