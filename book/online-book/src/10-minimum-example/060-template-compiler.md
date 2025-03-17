# 模板编译器

## 实际上到目前为止我们已经实现了所有必要的部分 ( ? )

到目前为止，我们已经实现了响应式系统、虚拟DOM和组件等功能。  
虽然这些都是非常小型的实现，尚不实用，但可以说我们已经理解了运行所需的全部基本构成要素。  
虽然每个部分的功能还不够完善，但我们已经非常浅显地完成了一轮实现。

从本章开始，我们将实现模板功能，使我们的框架更接近Vue.js。但这些功能主要是为了改善开发体验(DX)，并不会影响运行时的核心功能。(严格来说，编译器优化会产生影响，但这不是主要内容，所以我们可以暂时认为没有影响)  
更具体地说，为了提高开发体验，我们将扩展开发者接口，并"最终将其转换为我们已经创建的内部实现"。

## 我们想要实现的开发者接口

目前，我们的开发者接口是这样的：

```ts
const MyComponent: Component = {
  props: { someMessage: { type: String } },

  setup(props: any, { emit }: any) {
    return () =>
      h('div', {}, [
        h('p', {}, [`someMessage: ${props.someMessage}`]),
        h('button', { onClick: () => emit('click:change-message') }, [
          'change message',
        ]),
      ])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(
          MyComponent,
          {
            'some-message': state.message,
            'onClick:change-message': changeMessage,
          },
          [],
        ),
      ])
  },
})
```

在当前状态下，视图部分是使用h函数构建的。为了使其更接近原生HTML，我们希望能够在template选项中编写模板。  
不过，一次性实现所有功能会很困难，所以我们将缩小功能范围逐步实现。  
暂时，我们将任务分为以下几个步骤：

1. 能够渲染简单的标签、消息和静态属性

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

2. 能够渲染更复杂的HTML

```ts
const app = createApp({
  template: `
    <div>
      <p>hello</p>
      <button> click me! </button>
    </div>
  `,
})
```

3. 能够使用setup函数中定义的内容

```ts
const app = createApp({
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }

    return { count, increment }
  },

  template: `
    <div>
      <p>count: {{ count }}</p>
      <button v-on:click="increment"> click me! </button>
    </div>
  `,
})
```

我们会将每个步骤进一步细分，但大致上我们将分为这三个步骤。  
让我们从第一步开始。

## 编译器的作用

首先，我们计划实现的开发者接口是这样的：

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

这里先简单介绍一下什么是编译器。  
在编写软件时，你可能会经常听到"编译器"这个词。  
"编译"意味着翻译，在软件领域，这个词通常用于将高级语法转换为低级语法的过程。  
还记得本书开头提到的这句话吗？

> 在这里，为了方便起见，我们称越接近原生JS的接口为"低级开发者接口"。  
> 而这里的重要点是，"开始实现时，从低级部分开始实现"。  
> 为什么呢？因为在大多数情况下，高级语法最终会被转换为低级语法来运行。  
> 也就是说，形式1和2最终在内部都会转换为形式3。  
> 这种转换的实现被称为"编译器（翻译器）"。

那么，为什么需要编译器呢？一个主要目的是"提高开发体验"。  
如果我们已经有了能够运行的最低限度的低级接口，功能上我们已经可以用这些进行开发了。  
但是，如果描述复杂难懂，或者需要考虑与功能无关的部分，这会变得很麻烦，所以考虑到使用者的感受，我们需要重新开发接口部分。

在这方面，Vue.js的目标是"像编写原生HTML一样，并利用Vue提供的功能（如指令）方便地编写视图"。
而这条路的终点可能就是SFC（单文件组件）了。  
近年来，jsx/tsx也很流行，Vue当然也将它们作为开发者接口的选择提供。但在这里，我们将尝试实现Vue独有的模板语法。

长篇大论地解释了很多，但归根结底，我们这次想要做的是，

将这样的代码：

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

翻译（编译）成这样：

```ts
const app = createApp({
  render() {
    return h('p', { class: 'hello' }, ['Hello World'])
  },
})
```

更具体地说，就是这部分：

```ts
`<p class="hello">Hello World</p>`
// ↓
h('p', { class: 'hello' }, ['Hello World'])
```

让我们分几个阶段，逐步实现这个功能。 