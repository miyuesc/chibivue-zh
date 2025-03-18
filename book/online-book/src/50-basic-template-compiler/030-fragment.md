# 实现 Fragment

## 当前实现的问题

让我们在playground中运行以下代码：

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

我们会看到以下错误：

![fragment_error.png](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/fragment_error.png)

从错误信息来看，错误发生在Function构造函数中。

这意味着codegen过程基本成功，让我们看看实际生成了什么代码：

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode } = ChibiVue

    return _createVNode("header", null, "header")"\n  "_createVNode("main", null, "main")"\n  "_createVNode("footer", null, "footer")
   }
}
```

return语句出现了问题。当前的codegen实现无法处理根节点是数组（而非单一节点）的情况。  
现在我们来修复这个问题。

## 我们应该生成什么样的代码

那么，我们应该生成什么样的代码呢？

答案是这样的代码：

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode, Fragment: _Fragment } = ChibiVue

    return _createVNode(_Fragment, null, [
      [
        _createVNode('header', null, 'header'),
        '\n  ',
        _createVNode('main', null, 'main'),
        '\n  ',
        _createVNode('footer', null, 'footer'),
      ],
    ])
  }
}
```

这里的`Fragment`是Vue中定义的一个symbol。  
也就是说，Fragment不是作为FragmentNode这样的AST节点表示，而只是ElementNode的一个特殊tag。

然后，我们需要在renderer中实现处理tag为Fragment的情况。  
这与Text节点的处理方式类似。

## 开始实现

fragment的symbol定义在runtime-core/vnode.ts中。

我们需要将其添加为VNodeTypes的新类型：

```ts
export type VNodeTypes =
  | Component; // 原来是`object`，顺便修正一下
  | typeof Text
  | typeof Fragment  // 新增
  | string

export const Fragment = Symbol(); // 新增
```

接下来实现renderer部分。

在patch函数中添加处理fragment的分支：

```ts
if (type === Text) {
  processText(n1, n2, container, anchor)
} else if (shapeFlag & ShapeFlags.ELEMENT) {
  processElement(n1, n2, container, anchor, parentComponent)
} else if (type === Fragment) {
  // 这里
  processFragment(n1, n2, container, anchor, parentComponent)
} else if (shapeFlag & ShapeFlags.COMPONENT) {
  processComponent(n1, n2, container, anchor, parentComponent)
} else {
  // do nothing
}
```

需要注意的是，元素的插入和移除基本上都需要基于anchor来实现。

anchor就是用来标记fragment开始和结束位置的标记。

开始位置由VNode中现有的`el`属性表示，但目前还没有表示结束位置的属性，所以我们需要添加：

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  anchor: HostNode | null // fragment anchor // 新增
  // .
  // .
}
```

在mount阶段设置anchor，并在mount/patch过程中将fragment的结束位置作为anchor传递：

```ts
const processFragment = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
  const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

  if (n1 == null) {
    hostInsert(fragmentStartAnchor, container, anchor)
    hostInsert(fragmentEndAnchor, container, anchor)
    mountChildren(
      n2.children as VNode[],
      container,
      fragmentEndAnchor,
      parentComponent,
    )
  } else {
    patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent)
  }
}
```

在更新时，也需要注意fragment元素发生变化的情况：

```ts
const move = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const { type, children, el, shapeFlag } = vnode

  // .
  // .

  if (type === Fragment) {
    hostInsert(el!, container, anchor)
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], container, anchor)
    }
    hostInsert(vnode.anchor!, container, anchor) // 插入anchor
    return
  }
  // .
  // .
  // .
}
```

在unmount时也要依靠anchor来删除元素：

```ts
const remove = (vnode: VNode) => {
  const { el, type, anchor } = vnode
  if (type === Fragment) {
    removeFragment(el!, anchor!)
  }

  // .
  // .
  // .
}

const removeFragment = (cur: RendererNode, end: RendererNode) => {
  let next
  while (cur !== end) {
    next = hostNextSibling(cur)! // ※ 需要在nodeOps中添加！
    hostRemove(cur)
    cur = next
  }
  hostRemove(end)
}
```

## 测试效果

之前的代码现在应该能正常工作了：

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

当前由于还不支持v-for指令，我们无法在template中使用fragment并动态改变元素数量，

因此，我们可以编写模拟编译后的代码来测试功能：

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

// const App = defineComponent({
//   template: `<header>header</header>
//   <main>main</main>
//   <footer>footer</footer>`,
// });

const App = defineComponent({
  setup() {
    const list = ref([0])
    const update = () => {
      list.value = [...list.value, list.value.length]
    }
    return () =>
      h(Fragment, {}, [
        h('button', { onClick: update }, 'update'),
        ...list.value.map(i => h('div', {}, i)),
      ])
  },
})

const app = createApp(App)

app.mount('#app')
```

看起来工作正常！

完整源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/030_fragment) 