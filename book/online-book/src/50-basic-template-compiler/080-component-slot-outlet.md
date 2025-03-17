# 组件插槽

## 目标开发者接口

在Basic Component System的插槽实现中，我们已经有了运行时的实现。  
但是，我们还不能在模板中处理插槽。

我们希望能够处理以下SFC（单文件组件）：  
（虽然说是SFC，但实际上是模板编译器的实现。）

```vue
<!-- Comp.vue -->
<template>
  <p><slot name="default" /></p>
</template>
```

```vue
<!-- App.vue -->
<script>
import Comp from './Comp.vue'
export default {
  components: {
    Comp,
  },
  setup() {
    const count = ref(0)
    return { count }
  },
}
</script>

<template>
  <Comp>
    <template #default>
      <button @click="count++">count is: {{ count }}</button>
    </template>
  </Comp>
</template>
```

Vue.js的插槽有几种类型：

- 默认插槽
- 具名插槽
- 作用域插槽

但是，如果你了解运行时实现，就会明白这些都只是简单的回调函数。  
让我们回顾一下：

上面的组件会被转换为以下render函数：

```js
h(Comp, null, {
  default: () =>
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
})

```

在模板中可以省略`name="default"`，但在运行时它仍然是名为`default`的插槽。  
让我们在完成具名插槽的编译器实现后，再实现默认插槽的编译器。

## 实现编译器（插槽定义）

与往常一样，我们需要实现parse和codegen处理，但这次我们将同时实现插槽定义和插槽插入的处理。

首先是插槽定义部分。  
这是子组件中表示为`<slot name="my-slot"/>`的部分的编译。

在运行时方面，我们准备一个`renderSlot`辅助函数，并通过组件实例（通过`ctx.$slot`）传递插入的插槽及其名称作为参数。  
代码会编译成类似以下的形式：

```js
_renderSlot(_ctx.$slots, "my-slot")
```

在AST中，插槽定义表示为`SlotOutletNode`节点。  
在`ast.ts`中添加以下定义：

```ts
export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT, // [!code ++]
}

// ...

export type ElementNode = 
  | PlainElementNode 
  | ComponentNode 
  | SlotOutletNode // [!code ++]

// ...

export interface SlotOutletNode extends BaseElementNode { // [!code ++]
  tagType: ElementTypes.SLOT // [!code ++]
  codegenNode: RenderSlotCall | undefined // [!code ++]
} // [!code ++]

export interface RenderSlotCall extends CallExpression { // [!code ++]
  callee: typeof RENDER_SLOT // [!code ++]
  // $slots, name // [!code ++]
  arguments: [string, string | ExpressionNode] // [!code ++]
} // [!code ++]
```

接下来，我们实现parse处理来生成这个AST。

在`parse.ts`中，我们只需在解析标签时检查是否为`"slot"`，如果是则将`tagType`更改为`ElementTypes.SLOT`：

```ts
function parseTag(context: ParserContext, type: TagType): ElementNode {
  // ...
  let tagType = ElementTypes.ELEMENT
  if (tag === 'slot') { // [!code ++]
    tagType = ElementTypes.SLOT // [!code ++]
  } else if (isComponent(tag, context)) {
    tagType = ElementTypes.COMPONENT
  }
}
```

完成这部分后，我们实现转换器来生成codegenNode。  
我们需要使用辅助函数`JS_CALL_EXPRESSION`。

首先，在`runtimeHelper.ts`中添加`RENDER_SLOT`：

```ts
// ...
export const RENDER_LIST = Symbol()
export const RENDER_SLOT = Symbol() // [!code ++]
export const MERGE_PROPS = Symbol()
// ...

export const helperNameMap: Record<symbol, string> = {
  // ...
  [RENDER_LIST]: `renderList`,
  [RENDER_SLOT]: 'renderSlot', // [!code ++]
  [MERGE_PROPS]: 'mergeProps',
  // ...
}
```

接下来，我们实现一个新的转换器`transformSlotOutlet`。  
这个转换器的工作很简单：当节点是`ElementType.SLOT`时，从`node.props`中查找`name`，并生成`RENDER_SLOT`的`JS_CALL_EXPRESSION`。  
我们还需要考虑绑定形式，如`:name="slotName"`。

由于实现比较简单，以下是完整的转换器代码（请阅读）：

```ts
import { camelize } from '../../shared'
import {
  type CallExpression,
  type ExpressionNode,
  NodeTypes,
  type SlotOutletNode,
  createCallExpression,
} from '../ast'
import { RENDER_SLOT } from '../runtimeHelpers'
import type { NodeTransform, TransformContext } from '../transform'
import { isSlotOutlet, isStaticArgOf, isStaticExp } from '../utils'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { loc } = node
    const { slotName } = processSlotOutlet(node, context)
    const slotArgs: CallExpression['arguments'] = [
      context.isBrowser ? `$slots` : `_ctx.$slots`,
      slotName,
    ]

    node.codegenNode = createCallExpression(
      context.helper(RENDER_SLOT),
      slotArgs,
      loc,
    )
  }
}

interface SlotOutletProcessResult {
  slotName: string | ExpressionNode
}

function processSlotOutlet(
  node: SlotOutletNode,
  context: TransformContext,
): SlotOutletProcessResult {
  let slotName: string | ExpressionNode = `"default"`

  const nonNameProps = []
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.value) {
        if (p.name === 'name') {
          slotName = JSON.stringify(p.value.content)
        } else {
          p.name = camelize(p.name)
          nonNameProps.push(p)
        }
      }
    } else {
      if (p.name === 'bind' && isStaticArgOf(p.arg, 'name')) {
        if (p.exp) slotName = p.exp
      } else {
        if (p.name === 'bind' && p.arg && isStaticExp(p.arg)) {
          p.arg.content = camelize(p.arg.content)
        }
        nonNameProps.push(p)
      }
    }
  }

  return { slotName }
}
```

将来，我们可能会在这里添加作用域插槽的props查找等功能。

需要注意的一点是，`<slot />`元素也会在transformElement中被捕获，所以我们需要添加实现，在元素是`ElementTypes.SLOT`时跳过transformElement。

在`transformElement.ts`中：

```ts
export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode!

    if ( // [!code ++]
      !( // [!code ++]
        node.type === NodeTypes.ELEMENT && // [!code ++]
        (node.tagType === ElementTypes.ELEMENT || // [!code ++]
          node.tagType === ElementTypes.COMPONENT) // [!code ++]
      ) // [!code ++]
    ) { // [!code ++]
      return // [!code ++]
    } // [!code ++]

    // ...
  }
}
```

最后，在`compile.ts`中注册`transformSlotOutlet`，这样我们就可以编译了：

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [
      transformIf,
      transformFor,
      transformExpression,
      transformSlotOutlet, // [!code ++]
      transformElement,
    ],
    { bind: transformBind, on: transformOn },
  ]
}
```

我们还没有实现运行时函数`renderSlot`，所以最后来实现它，这样插槽定义的实现就完成了。

实现`packages/runtime-core/helpers/renderSlot.ts`：

```ts
import { Fragment, type VNode, createVNode } from '../vnode'
import type { Slots } from '../componentSlots'

export function renderSlot(slots: Slots, name: string): VNode {
  let slot = slots[name]
  if (!slot) {
    slot = () => []
  }

  return createVNode(Fragment, {}, slot())
}
```

至此，插槽定义的实现已经完成。  
接下来，我们将实现插槽插入部分的编译器！

到这里的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/080_component_slot_outlet)

## 插槽插入

待实现 