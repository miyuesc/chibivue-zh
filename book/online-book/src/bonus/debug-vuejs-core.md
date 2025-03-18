# 调试 Vue.js 源代码

有时候我们可能想要运行并验证 Vue.js 官方源代码的行为。
作为本书的方针，我们也非常希望你能够通过阅读官方源代码来加深理解，因此强烈推荐进行源代码阅读和测试。

在这里，我们将介绍一些在正文中没有涉及的官方源代码调试方法。

（按照简单程度的顺序介绍）

## 使用 SFC Playground

这是最简单的方法。这是一个在官方文档中也有链接的广为人知的方法。

https://play.vuejs.org

在这个 playground 中，你不仅可以编写 Vue 组件并确认其行为，还可以查看 SFC 的编译结果。
在浏览器中就能快速确认，非常方便。（当然也可以分享）

<video src="https://github.com/ubugeeei/ubugeeei/assets/71201308/8281e589-fdaf-4206-854e-25a66dfaac05" controls />

## 利用 vuejs/core 的测试

接下来是运行 [vuejs/core](https://github.com/vuejs/core) 测试的方法。
当然，这需要先克隆 [vuejs/core](https://github.com/vuejs/core) 的源代码。

```bash
git clone https://github.com/vuejs/core.git vuejs-core
# 注意：由于仓库名为 `core`，建议改成更容易理解的名称
```

然后，

```bash
cd vuejs-core
ni
nr test
```

这样就可以运行测试了。你可以适当修改感兴趣的源代码，然后运行测试。

除了 `test` 之外还有其他几个测试命令，感兴趣的话可以查看 `package.json`。

你可以通过阅读测试代码来理解，也可以实际修改代码并运行测试，或者添加测试用例，有多种使用方式。

<img width="590" alt="screenshot 2024-01-07 0 31 29" src="https://github.com/ubugeeei/ubugeeei/assets/71201308/3c862bd5-1d94-4d2a-a9fa-8755872098ed">

## 实际运行 vuejs/core 的源代码

接下来是一个不是最简单但很有必要的方法：实际修改和运行 vuejs/core 的源代码。

关于这一点，我们已经准备了一个可以使用 vite 进行 HMR 的项目，支持 SFC 和 standalone 模式，欢迎使用。
这个项目在 [chibivue](https://github.com/chibivue-land/chibivue) 仓库中，请克隆它。

```bash
git clone https://github.com/chibivue-land/chibivue.git
```

克隆完成后，运行项目创建脚本。

在这个过程中，你需要输入本地 vuejs/core 源代码的**绝对路径**。

```bash
cd chibi-vue
ni
nr setup:vue

# 💁 输入你的本地 vuejs/core 绝对路径：
#   例如：/Users/ubugeeei/oss/vuejs-core
#   >
```

这样就会在 chibivue 仓库中创建一个指向本地 vuejs/core 的 Vue 项目。

<video src="https://github.com/ubugeeei/work-log/assets/71201308/5d57c022-c411-4452-9e7e-c27623ec28b4" controls/>

之后，当你想要启动项目时，可以使用以下命令，然后就可以一边修改 vuejs/core 的源代码一边确认其行为：

```bash
nr dev:vue
```

playground 方面当然支持 HMR，

<video src="https://github.com/ubugeeei/work-log/assets/71201308/a2ad46d8-4b07-4ac5-a887-f71507c619a6" controls/>

修改 vuejs/core 的代码时也支持 HMR。

<video src="https://github.com/ubugeeei/work-log/assets/71201308/72f38910-19b8-4171-9ed7-74d1ba223bc8" controls/>

---

另外，如果想要在 standalone 模式下确认，可以通过修改 index.html 来加载 standalone-vue.js，这样也可以通过 HMR 进行确认。

<video src="https://github.com/ubugeeei/work-log/assets/71201308/c57ab5c2-0e62-4971-b1b4-75670d3efeec" controls/> 