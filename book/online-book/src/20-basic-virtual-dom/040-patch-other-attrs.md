# 不支持的 Props 更新

在这一章当中，我们将着手实现那些当前还不支持的 `props` 属性的补丁更新。

以下是一些需要支持的目标属性示例，请大家阅读 Vue.js 的源代码然后自行实现！

这样，你就可以把 Chibivue 升级得更加完善了。

这里并没有什么特别新的内容，根据我们目前已经完成的功能就可以实现了。

其中最值得注意的是 `runtime-dom/modules` 中的内容的实现。

## 新旧属性对比

目前我们只能基于 `n2` 的 `props` 来进行页面的更新。

现在让我们根据 `n1` 和 `n2` 的区别进行更新。

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

如果 `n1` 中存在但是 `n2` 中不存在的 `props` 属性，说明需要进行删除。

但是如果一个 `props` 属性在 `n1` 和 `n2` 中都存在并且值一样，那说明不需要更新，直接略过就可以了。

## class / style (注意)

对于 `class` 和 `style`，Vue.js 提供了多种绑定方法。

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

要做到这样的效果，你需要了解 `transform`，但是这个东西我们会在 “基础模板编译器” 中讲解。

如果不用遵循 Vue.js 的源代码的设计思路的话，这个内容其实可以在任何地方进行实现，但是本书的出发点就是要和 Vue.js 的源码设计保持一致，所以这里也就先跳过它。

## innerHTML / textContent

与其他 `Props` 相比，`innerHTML` 和 `textContent` 有点特殊。这意味着，如果具有此 `Prop` 属性的元素还具有子元素的话，必须卸载掉所有子元素。

TODO: 后续更新
