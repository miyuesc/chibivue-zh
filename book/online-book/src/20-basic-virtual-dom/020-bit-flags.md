# VNode 类型的位表示

## 用位来表示 VNode 的类型

VNode 的类型实际上是有很多种的。例如我们之前实现的：

- component node
- element node
- text node
- 子元素是否是 Text 节点
- 子元素是否为数组

现在，我们将会看到更多 VNode 的类型的显示。  
例如 `slot`、`keep-alive`、`suspense` 和 `teleport`。  

到目前为止，我们使用的是 `type === Text` 和 `typeof type === "string"`、 `typeof type === "object"` 这样的条件来进行分支判断的。

但是，对这些类型逐一判断的效率是非常低的。所以，我们按照 Vue.js 的源码实现来用位来表示它们的类型。

在 Vue.js 中，这些位数据被称为 `ShapeFlags`。顾名思义，代表的是 VNode 的类型。

（严格地说，Vue 使用 `ShapeFlags` 和 `Text`、`Fragment` 等 `Symbol` 来确定 `VNode` 的类型，源码见：https://github.com/vuejs/core/blob/main/packages/shared/src/shapeFlags.ts ）

位标志，指的是将数字中的每一个位都视为一个特定的类型。

我们可以思考一下下面这个例子：

```ts
const vnode = {
  type: 'div',
  children: [
    { type: 'p', children: ['hello'] },
    { type: 'p', children: ['hello'] },
  ],
}
```

首先，标志的初始值为 0（为了简单起见，我们用 8 位进行说明）。

```ts
let shape = 0b0000_0000
```

在这里，因为这个 `VNode` 是 `element`，并且有一个子元素数组，所以有 `ELEMENT` 这个标志和 `ARRAY_CHILDREN` 这个标志。

```ts
shape = shape | ShapeFlags.ELEMENT | ELEMENT.ARRAY_CHILDREN // 0x00010001
```

通过这种方式，我们就可以用一个数字 `shape` 来表示 “它是一个元素，并且它有一个子元素数组” 的信息。

然后，你就可以在诸如 `renderer` 之类的分支条件中使用它来有效地判断 `VNode` 类型。

```ts
if (vnode.shape & ShapeFlags.ELEMENT) {
  // vnode 为 element 时的处理
}
```

这一次，我们暂时不需要实现所有的 `ShapeFlags` 的类型，只尝试实现一下下面这几种类型。

```ts
export const enum ShapeFlags {
  ELEMENT = 1,
  COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
}
```

大概需要这些步骤：

- 在 `shared/shapeFlags.ts` 中定义这些标志位
- 在 `runtime-core/vnode.ts` 中给 `vnode` 定义对应的 `shape`
  ```ts
  export interface VNode<HostNode = any> {
    shapeFlag: number
  }
  ```
  然后在 `createVNode` 等这类函数中添加类型 `flag` 的计算。
- 在 `renderer` 中，为不同的 `shape` 类型创建不同的判断分支。

好了!

这一章的说明到这里就先告一段落。让我们在下一章中去实现它!
