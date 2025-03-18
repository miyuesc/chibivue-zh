# 事件修饰符

## 本章内容

在上一章我们实现了v-on指令，接下来我们将实现事件修饰符。

Vue.js提供了许多修饰符，如preventDefault和stopPropagation等。

https://ja.vuejs.org/guide/essentials/event-handling.html#event-modifiers

本章我们将实现如下的开发者接口：

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const inputText = ref('')

    const buffer = ref('');
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      buffer.value = target.value
    }
    const submit = () => {
      inputText.value = buffer.value
      buffer.value = ''
    };

    return { inputText, buffer, handleInput, submit }
  },

  template: `<div>
    <form @submit.prevent="submit">
      <label>
        Input Data
        <input :value="buffer" @input="handleInput" />
      </label>
      <button>submit</button>
    </form>
    <p>inputText: {{ inputText }}</p>
</div>`,
});

const app = createApp(App)

app.mount('#app')
```

请特别注意以下部分：

```html
<form @submit.prevent="submit"></form>
```

这里有一个`@submit.prevent`的写法。这表示在调用submit事件的处理程序时，执行`preventDefault`。

如果不添加`.prevent`，提交表单时页面会刷新。

## AST和Parser的实现

由于我们要添加模板的新语法，需要修改Parser和AST。

首先看看AST的修改。这非常简单，只需在`DirectiveNode`中添加一个`modifiers`属性（字符串数组）：

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[] // 新增此字段
}
```

然后实现相应的Parser部分。

实际上，我们从Vue官方借鉴的正则表达式中已经包含了这部分，所以实现也很简单：

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // .
  // .
  // .
  const modifiers = match[3] ? match[3].slice(1).split('.') : [] // 从match结果中提取修饰符
  return {
    type: NodeTypes.DIRECTIVE,
    name: dirName,
    exp: value && {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: value.content,
      isStatic: false,
      loc: value.loc,
    },
    loc,
    arg,
    modifiers, // 将修饰符包含在返回中
  }
}
```

这样，AST和Parser的实现就完成了。

## compiler-dom/transform

让我们回顾一下当前编译器的结构。

目前的结构如下：

![50-027-compiler-architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/50-027-compiler-architecture.drawio.png)

重新理解compiler-core和compiler-dom的各自角色：  
compiler-core提供不依赖DOM的编译器功能，生成AST并进行转换。

之前我们在compiler-core中实现了v-on指令，它只是将`@click="handle"`转换为`{ onClick: handle }`这样的对象，没有执行任何依赖DOM的处理。

看看我们现在要实现的功能：  
我们需要生成执行`e.preventDefault()`或`e.stopPropagation()`的代码。  
这些明显依赖于DOM。

因此，我们需要在compiler-dom中实现transformer。所有与DOM相关的转换都应该在这里实现。

我们希望在compiler-dom中实现`transformOn`，但需要考虑与compiler-core中已有的`transformOn`的协作。  
问题是："如何在执行compiler-core的transform的同时，实现compiler-dom中的transform？"

首先，我们需要修改compiler-core中的`DirectiveTransform`接口：

```ts
export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult, // 新增
) => DirectiveTransformResult
```

我们添加了一个augmentor参数。  
这实际上是一个回调函数，通过在`DirectiveTransform`接口中添加回调使得transform函数可以被扩展。

在compiler-dom中，我们将实现一个包装compiler-core中transformer的新transformer：

```ts
// 实现示例

// compiler-dom中的实现

import { transformOn as baseTransformOn } from 'compiler-core'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransformOn(dir, node, context, () => {
    /** 这里是compiler-dom特有的实现 */
    return {
      /** */
    }
  })
}
```

然后，将compiler-dom中实现的`transformOn`作为编译器选项传递即可。  
关系图如下：  
我们不需要从compiler-dom传递所有transformer，而是在compiler-core中实现默认实现，然后通过选项添加额外功能的模式。

![50-027-new-compiler-architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/50-027-new-compiler-architecture.drawio.png)

这样，compiler-core就不依赖DOM，而compiler-dom可以实现依赖DOM的处理并执行compiler-core的transformer。

## transformer的实现

现在，让我们实现compiler-dom中的transformer。

我们应该怎样进行transform呢？首先，"修饰符"有很多不同类型，考虑到未来的扩展，我们应该对它们进行分类。

我们要实现的是"事件修饰符"。
先从modifiers中提取出这些事件修饰符：

```ts
const isEventModifier = makeMap(
  // event propagation management
  `stop,prevent,self`,
)

const resolveModifiers = (modifiers: string[]) => {
  const eventModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]
    if (isEventModifier(modifier)) {
      eventModifiers.push(modifier)
    }
  }

  return { eventModifiers }
}
```

提取出eventModifiers后，如何使用它们呢？
我们将在runtime-dom中实现一个withModifiers辅助函数，然后将表达式转换为调用该函数。

```ts
// runtime-dom/runtimeHelpers.ts

export const V_ON_WITH_MODIFIERS = Symbol()
```

```ts
export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]
    const { eventModifiers } = resolveModifiers(modifiers)

    if (eventModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(eventModifiers),
      ])
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
    }
  })
}
```

这样，transform部分的实现基本完成。

接下来在compiler-dom中实现withModifiers函数。

## withModifiers的实现

在runtime-dom/directives/vOn.ts中进行实现。

实现非常简单。

我们只需实现事件修饰符的守卫函数，并为接收到的每个修饰符执行相应的守卫：

```ts
const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
}

export const withModifiers = (fn: Function, modifiers: string[]) => {
  return (event: Event, ...args: unknown[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event)) return
    }
    return fn(event, ...args)
  }
}
```

至此，实现完成。

让我们测试一下！  
如果点击按钮后页面不刷新，并且input的内容显示在屏幕上，那就成功了！

完整源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier)

## 其他修饰符

到这里，我们不妨也实现其他修饰符。

基本实现思路是相同的。

我们可以将修饰符分类如下：

```ts
const keyModifiers = []
const nonKeyModifiers = []
const eventOptionModifiers = []
```

然后创建必要的map，并在resolveModifiers中对它们进行分类即可。

有两点需要注意：

- 修饰符名称与实际DOM API名称的差异
- 为特定键事件实现新的辅助函数(withKeys)

关于这些细节，请边阅读代码边实现！  
走到这一步的你们应该能够做到。

完整源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier2) 