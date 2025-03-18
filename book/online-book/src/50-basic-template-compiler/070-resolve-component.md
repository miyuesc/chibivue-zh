# 解析组件

实际上，我们的chibivue模板目前还不能解析组件。  
本章我们将实现这个功能，但首先需要了解Vue.js中有几种组件解析方法。

让我们先回顾一下几种解析方法。

## 组件的解析方法

### 1. Components选项（局部注册）

这可能是最简单的组件解析方法。

https://vuejs.org/api/options-misc.html#components

```vue
<script>
import MyComponent from './MyComponent.vue'

export default {
  components: {
    MyComponent,
    MyComponent2: MyComponent,
  },
}
</script>

<template>
  <MyComponent />
  <MyComponent2 />
</template>
```

components选项中指定的对象的key名称就是可以在模板中使用的组件名。

### 2. 注册到app（全局注册）

通过使用创建的Vue应用的`.component()`方法，可以注册在整个应用中可用的组件。

https://vuejs.org/guide/components/registration.html#global-registration

```ts
import { createApp } from 'vue'

const app = createApp({})

app
  .component('ComponentA', ComponentA)
  .component('ComponentB', ComponentB)
  .component('ComponentC', ComponentC)
```

### 3. 动态组件 + is属性

使用is属性可以动态切换组件。

https://vuejs.org/api/built-in-special-elements.html#component

```vue
<script>
import Foo from './Foo.vue'
import Bar from './Bar.vue'

export default {
  components: { Foo, Bar },
  data() {
    return {
      view: 'Foo',
    }
  },
}
</script>

<template>
  <component :is="view" />
</template>
```

### 4. script setup中的import

在script setup中，可以直接使用导入的组件。

```vue
<script setup>
import MyComponent from './MyComponent.vue'
</script>

<template>
  <MyComponent />
</template>
```

---

除此之外，还有异步组件、内置组件、`component`标签等，但这次我们将主要实现上述两种方法（1和2）。

对于第3种方法，如果实现了1和2，只需扩展即可。第4种方法我们暂时不实现，因为我们还没有实现script setup。

## 基本思路

解析组件的基本流程如下：

- 在某处存储模板中使用的名称与组件的映射记录
- 使用辅助函数根据名称解析组件

无论是第1种形式还是第2种形式，注册位置略有不同，但本质上都只是保存名称和组件的映射记录。  
有了这些记录，在需要时就可以通过名称解析组件，所以两种实现方式很相似。

首先，让我们看看预期的代码和编译结果：

```vue
<script>
import MyComponent from './MyComponent.vue'

export default defineComponent({
  components: { MyComponent },
})
</script>

<template>
  <MyComponent />
</template>
```

```js
// 编译结果

function render(_ctx) {
  const {
    resolveComponent: _resolveComponent,
    createVNode: _createVNode,
    Fragment: _Fragment,
  } = ChibiVue

  const _component_MyComponent = _resolveComponent('MyComponent')

  return _createVNode(_Fragment, null, _createVNode(_component_MyComponent))
}
```

就是这样。

## 实现

### AST

为了生成解析组件的代码，我们需要知道"MyComponent"是一个组件。  
在解析阶段，我们需要处理标签名，在AST中区分普通Element和Component。

首先，思考AST的定义。  
ComponentNode与普通Element一样，有props和children。  
我们将这些共同部分作为`BaseElementNode`，将到目前为止的`ElementNode`重命名为`PlainElementNode`，  
然后将`ElementNode`定义为`PlainElementNode`和`ComponentNode`的联合类型。

```ts
// compiler-core/ast.ts

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
}

export type ElementNode = PlainElementNode | ComponentNode

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string
  tagType: ElementTypes
  isSelfClosing: boolean
  props: Array<AttributeNode | DirectiveNode>
  children: TemplateChildNode[]
}

export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT
  codegenNode: VNodeCall | SimpleExpressionNode | undefined
}

export interface ComponentNode extends BaseElementNode {
  tagType: ElementTypes.COMPONENT
  codegenNode: VNodeCall | undefined
}
```

目前内容没有太大变化，只是通过tagType进行区分，并将ast作为不同的实体对待。  
接下来，我们将使用它在transform中添加辅助函数等。

### Parser

接下来，我们需要实现生成上述AST的解析器。  
基本上只需要根据标签名确定tagType即可。

问题是，如何判断是Element还是Component？

基本思路很简单，就是判断"是否为原生标签"。

・  
・  
・

"等等，那么如何实现这个判断呢？"

这里我们采用直接方法：预先列举原生标签名，然后检查是否匹配。  
这些标签在规范中都有详细列出，我们可以信任并使用它们。

这里有一个问题："什么是原生标签取决于环境"。  
在我们的例子中，是浏览器环境。这意味着"compiler-core不应该依赖于特定环境"。  
我们之前将依赖DOM的实现放在compiler-dom中，这次也不例外。

因此，我们将"是否为原生标签名"作为解析器选项从外部注入。

为了未来扩展方便，我们设计一个易于添加的选项结构：

```ts
type OptionalOptions = 'isNativeTag' // | TODO: 未来可能会增加

type MergedParserOptions = Omit<Required<ParserOptions>, OptionalOptions> &
  Pick<ParserOptions, OptionalOptions>

export interface ParserContext {
  // .
  // .
  options: MergedParserOptions // [!code ++]
  // .
  // .
}

function createParserContext(
  content: string,
  rawOptions: ParserOptions, // [!code ++]
): ParserContext {
  const options = Object.assign({}, defaultParserOptions) // [!code ++]

  let key: keyof ParserOptions // [!code ++]
  // prettier-ignore
  for (key in rawOptions) { // [!code ++]
    options[key] = // [!code ++]
      rawOptions[key] === undefined // [!code ++]
        ? defaultParserOptions[key] // [!code ++]
        : rawOptions[key]; // [!code ++]
  } // [!code ++]

  // .
  // .
  // .
}

export const baseParse = (
  content: string,
  options: ParserOptions = {}, // [!code ++]
): RootNode => {
  const context = createParserContext(
    content,
    options, // [!code ++]
  )
  const children = parseChildren(context, [])
  return createRoot(children)
}
```

接下来，我们在compiler-dom中列举原生标签名，并将其作为选项传递。

实际上，这些列举在shared/domTagConfig.ts中完成：

```ts
import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS =
  'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
  'header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
  'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
  'data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,' +
  'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
  'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
  'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
  'option,output,progress,select,textarea,details,dialog,menu,' +
  'summary,template,blockquote,iframe,tfoot'

export const isHTMLTag = makeMap(HTML_TAGS)
```

这看起来真的很壮观！

但这确实是正确的实现。

https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/shared/src/domTagConfig.ts#L6

创建compiler-dom/parserOptions.ts并传递给编译器：

```ts
// compiler-dom/parserOptions.ts

import { ParserOptions } from '../compiler-core'
import { isHTMLTag, isSVGTag } from '../shared/domTagConfig'

export const parserOptions: ParserOptions = {
  isNativeTag: tag => isHTMLTag(tag) || isSVGTag(tag),
}
```

```ts
export function compile(template: string, option?: CompilerOptions) {
  const defaultOption = { isBrowser: true }
  if (option) Object.assign(defaultOption, option)
  return baseCompile(
    template,
    Object.assign(
      {},
      parserOptions, // [!code ++]
      defaultOption,
      {
        directiveTransforms: DOMDirectiveTransforms,
      },
    ),
  )
}
```

准备工作已经完成，现在我们继续实现解析器的其余部分。

剩下的非常简单，只需要判断是否为组件并设置tagType：

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // .
  // .
  let tagType = ElementTypes.ELEMENT // [!code ++]
  // prettier-ignore
  if (isComponent(tag, context)) { // [!code ++]
    tagType = ElementTypes.COMPONENT;// [!code ++]
  } // [!code ++]

  return {
    // .
    tagType, // [!code ++]
    // .
  }
}

function isComponent(tag: string, context: ParserContext) {
  const options = context.options
  if (
    // 注意：在Vue.js中，首字母大写的标签被视为组件
    // 参考：https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/compiler-core/src/parse.ts#L662
    /^[A-Z]/.test(tag) ||
    (options.isNativeTag && !options.isNativeTag(tag))
  ) {
    return true
  }
}
```

这样parser和AST就完成了。现在我们使用它们来实现transform和codegen。

### Transform

transform的工作非常简单。

在transformElement中，当Node是ComponentNode时进行一些转换。

同时，将组件注册到context中。  
这是为了在codegen阶段统一解析组件。
如后所述，在codegen中，组件作为assets统一解析。

```ts
// compiler-core/transforms/transformElement.ts
export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    // .
    // .

    const isComponent = node.tagType === ElementTypes.COMPONENT // [!code ++]

    const vnodeTag = isComponent // [!code ++]
      ? resolveComponentType(node as ComponentNode, context) // [!code ++]
      : `"${tag}"` // [!code ++]

    // .
    // .
  }
}

function resolveComponentType(node: ComponentNode, context: TransformContext) {
  let { tag } = node
  context.helper(RESOLVE_COMPONENT)
  context.components.add(tag) // 将在后面详述
  return toValidAssetId(tag, `component`)
}
```

```ts
// util.ts
export function toValidAssetId(
  name: string,
  type: 'component', // | TODO:
): string {
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}
```

我们还需要在context中添加注册功能：

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  components: Set<string> // [!code ++]
  // .
}

export function createTransformContext(
  root: RootNode,
  {
    nodeTransforms = [],
    directiveTransforms = {},
    isBrowser = false,
  }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    // .
    components: new Set(), // [!code ++]
    // .
  }
}
```

然后，将context中收集的components全部注册到RootNode中：

```ts
export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: TemplateChildNode[]
  codegenNode?: TemplateChildNode | VNodeCall
  helpers: Set<symbol>
  components: string[] // [!code ++]
}
```

```ts
export function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options)
  traverseNode(root, context)
  createRootCodegen(root, context)
  root.helpers = new Set([...context.helpers.keys()])
  root.components = [...context.components] // [!code ++]
}
```

现在，我们只需要在codegen中使用RootNode.components。

### Codegen

如最初看到的编译结果，我们只需要生成将名称传递给辅助函数解析的代码。  
为了未来扩展考虑，我们使用assets这个抽象概念。

```ts
export const generate = (ast: RootNode, option: CompilerOptions): string => {
  // .
  // .
  genFunctionPreamble(ast, context) // 注意：将来会移到函数外部

  // prettier-ignore
  if (ast.components.length) { // [!code ++]
    genAssets(ast.components, "component", context); // [!code ++]
    newline(); // [!code ++]
    newline(); // [!code ++]
  } // [!code ++]

  push(`return `)
  // .
  // .
}

function genAssets(
  assets: string[],
  type: 'component' /* TODO: */,
  { helper, push, newline }: CodegenContext,
) {
  if (type === 'component') {
    const resolver = helper(RESOLVE_COMPONENT)
    for (let i = 0; i < assets.length; i++) {
      let id = assets[i]

      push(
        `const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(
          id,
        )})`,
      )
      if (i < assets.length - 1) {
        newline()
      }
    }
  }
}
```

### runtime-core方面的实现

到这里，目标代码已经生成，剩下的是runtime-core的实现。

#### 将component添加为组件选项

这很简单，只需添加到option中：

```ts
export type ComponentOptions<
  // .
  // .
> = {
  // .
  components?: Record<string, Component>
  // .
}
```

#### 将components添加为app选项

同样简单：

```ts
export interface AppContext {
  // .
  components: Record<string, Component> // [!code ++]
  // .
}

export function createAppContext(): AppContext {
  return {
    // .
    components: {}, // [!code ++]
    // .
  }
}

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    // .
    const app: App = (context.app = {
      // .
      // prettier-ignore
      component(name: string, component: Component): any { // [!code ++]
        context.components[name] = component; // [!code ++]
        return app; // [!code ++]
      },
    })
  }
}
```

#### 实现从上述两个位置解析组件的函数

这也没有特别需要解释的地方。  
我们分别在局部/全局注册的组件中搜索组件，并返回找到的组件。  
如果找不到，则将名称作为fallback返回。

```ts
// runtime-core/helpers/componentAssets.ts

export function resolveComponent(name: string): ConcreteComponent | string {
  const instance = currentInstance || currentRenderingInstance // 后面会详述
  if (instance) {
    const Component = instance.type
    const res =
      // 局部注册
      resolve((Component as ComponentOptions).components, name) ||
      // 全局注册
      resolve(instance.appContext.components, name)
    return res
  }

  return name
}

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
```

有一点需要注意的是`currentRenderingInstance`。

在resolveComponent中，为了追踪局部注册的组件，我们需要访问当前正在渲染的组件。  
（因为我们需要查找正在渲染的组件的components选项）

为此，我们准备了`currentRenderingInstance`，并在渲染时更新它：

```ts
// runtime-core/componentRenderContexts.ts

export let currentRenderingInstance: ComponentInternalInstance | null = null

export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null,
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  return prev
}
```

```ts
// runtime-core/renderer.ts

const setupRenderEffect = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const componentUpdateFn = () => {
    // .
    // .
    const prev = setCurrentRenderingInstance(instance) // [!code ++]
    const subTree = (instance.subTree = normalizeVNode(render(proxy!))) // [!code ++]
    setCurrentRenderingInstance(prev) // [!code ++]
    // .
    // .
  }
  // .
  // .
}
```

## 测试运行

辛苦了！到此为止，我们终于能够解析组件了。

让我们在playground中实际运行看看！

```ts
import { createApp } from 'chibivue'

import App from './App.vue'
import Counter from './components/Counter.vue'

const app = createApp(App)
app.component('GlobalCounter', Counter)
app.mount('#app')
```

App.vue

```vue
<script>
import Counter from './components/Counter.vue'

import { defineComponent } from 'chibivue'

export default defineComponent({
  components: { Counter },
})
</script>

<template>
  <Counter />
  <Counter />
  <GlobalCounter />
</template>
```

components/Counter.vue

```vue
<script>
import { ref, defineComponent } from 'chibivue'

export default defineComponent({
  setup() {
    const count = ref(0)
    return { count }
  },
})
</script>

<template>
  <button @click="count++">count: {{ count }}</button>
</template>
```

![resolve_components](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/resolve_components.png)

看起来正常运行了！太好了！

到这里的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/060_resolve_components) 