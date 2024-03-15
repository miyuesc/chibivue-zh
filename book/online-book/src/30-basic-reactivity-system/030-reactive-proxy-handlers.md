# 各个响应式代理处理程序

::: warning
2023 年 12 月月底 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布了，其中包括了 [reactivity 的性能优化](https://github.com/vuejs/core/pull/5912) 部分。  
需要注意的是，本书参考的是 Vue.js 之前的实现方式。  
本章内容不会有太大改变，但是文件结构可能略有调整，代码也有部分改动。
我也会在日后对这本书进行相应的更新。  
:::

## 不想成为响应式对象（不希望被响应化处理）

现在，我们还需要解决一个响应式系统的问题。

首先，我们运行一下下面这段代码。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value)
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
      ])
  },
})

app.mount('#app')
```

打开浏览器控制台，我们可以看到这样的输出内容。

![reactive_html_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive_html_element.png)

现在，我们添加一个输入框的自动聚焦（`focus`）处理。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value)
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

但是很奇怪，浏览器这时候抛出了一个错误。

![focus_in_reactive_html_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/focus_in_reactive_html_element.png)

原因是在 `getRef` 的时候，`inputRef.value` 的值实际上一个根据 `document.getElementById` 得到的元素创建的 `Proxy` 对象。

这时我们再操作，调用的就是这个 `Proxy` 对象而不是原始的 `HTML` 元素对象，所以会导致一些方法和特性失效。

## 在生成响应式代理对象之前先确定是不是对象

判断方法也很简单，借助 `Object.prototype.toString` 就可以实现了。

在刚刚的代码中，让我们来看看 `Object.prototype.toString` 在遇到 `HTMLInputElement` 时是怎么样确定的。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value?.toString())
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

![element_to_string](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/element_to_string.png)

这样我们就可以确定一个对象的类型了，虽然看起来有点硬编码的样子，但是我们可以将这个方法进行一下优化。

```ts
// shared/general.ts
export const objectToString = Object.prototype.toString // 在 isMap 和 isSet 之前就已经出现的方法
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

// 这次我们添加的工具函数
export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1)
}
```

我们使用 `slice` 对 `toTypeString` 的结果进行了拆分，也是为了能直接从 `[Object hoge]` 这样的结果中拿到 `hoge` 这个字符串。

然后，我们可以在 `reactive` 中通过 `toRawType` 进行不同对象类型的分支判断。
对于 `HTMLInput` 这类元素就直接跳过代理生成。

在 `reactive.ts` 中，也是获取目标对象的 `rawType` 来确定 `reactive` 方法的返回数据类型。

```ts
const enum TargetType {
  INVALID = 0,
  COMMON = 1,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    default:
      return TargetType.INVALID
  }
}

function getTargetType<T extends object>(value: T) {
  return !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}
```

```ts
export function reactive<T extends object>(target: T): T {
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

这样的话，刚刚的设置输入框焦点的代码应该就可以正常执行了。

![focus_in_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/focus_in_element.png)

## 尝试实现 TemplateRefs

既然现在已经可以将 `HTML` 元素放置到 `Ref` 对象上，那么现在我们就来实现一下 `TemplateRefs` 吧。

通过给模板元素设置 `ref` 属性，我们可以在元素或者子组件挂载后得到它们的对象实例引用。

https://cn.vuejs.org/guide/essentials/template-refs.html

我们当前的目标就是能正确执行下面的代码。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { ref: inputRef }, []),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

对于已经完整的学习到了这个位置的人来说，我想大家应该已经知道了如何实现这个功能。

没错，只需要在 `VNode` 中添加一个 `ref` 属性定义，并且在 `render` 渲染过程中完成赋值即可。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  key: string | number | symbol | null
  ref: Ref | null // 这里
  // .
  // .
}
```

在 Vue.js 的源代码中，这是由一个名为 `setRef` 的函数来实现的。我们可以阅读一下这部分的源代码并尝试自己实现它。

源码中这个方法的实现是非常复杂的，它需要支持 `ref` 数组、或者通过 `$refs` 访问等各种各样的功能。

但是目前我们不需要完整的实现所有功能，只要能让上面的代码正常工作就行了。

顺便再说一下，如果这个 `ref` 绑定的是一个 `component` 组件，我们需要把这个组件的 `setupContext` 结果赋值给这个 `ref` 对应的变量。

※ 我们实际上应该传递组件的 `proxy` 代理对象，但由于它还没有实现，所以我们将其命名为 `setupContext`。

```ts
import { createApp, h, ref } from 'chibivue'

const Child = {
  setup() {
    const action = () => alert('clicked!')
    return { action }
  },

  template: `<button @click="action">action (child)</button>`,
}

const app = createApp({
  setup() {
    const childRef = ref<any>(null)
    const childAction = () => {
      childRef.value?.action()
    }

    return () =>
      h('div', {}, [
        h('div', {}, [
          h(Child, { ref: childRef }, []),
          h('button', { onClick: childAction }, ['action (parent)']),
        ]),
      ])
  },
})

app.mount('#app')
```

当前源代码位于: 
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/110_template_refs)

## 对象属性的增加与减少

目前，我们的实现并不能支持对象的属性个数（对象的 `key` 的个数）变化的响应，也不能处理数组元素个数变化。

换而言之，下面这个组件就无法正常的工作。

```ts
const App = {
  setup() {
    const array = ref<number[]>([])
    const mutateArray = () => {
      array.value.push(Date.now()) // 即使数组变化也没有任何 effect 被触发 (此时 set 的 key 为 "0"，即 array.value[0] = Date.now()) 
    }

    const record = reactive<Record<string, number>>({})
    const mutateRecord = () => {
      record[Date.now().toString()] = Date.now() // 即使对象变化也没有任何 effect 被触发 (此时给对象设置了新的 key) 
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`array: ${JSON.stringify(array.value)}`]),
        h('button', { onClick: mutateArray }, ['update array']),

        h('p', {}, [`record: ${JSON.stringify(record)}`]),
        h('button', { onClick: mutateRecord }, ['update record']),
      ])
  },
}
```

我们该怎么解决这个问题呢?

### 针对数组的场景

因为数组也算是一个 “对象”，所以当添加一个新元素时，会将它的新索引作为 `key` 进入 `Proxy set` 的处理程序。

```ts
const p = new Proxy([], {
  set(target, key, value, receiver) {
    console.log(key) // ※
    Reflect.set(target, key, value, receiver)
    return true
  },
})

p.push(42) // 0
```

但是，我们不可能单独追踪数组中的每一个元素（应该是 `key`）。所以，我们将通过追踪数组长度来触发数组的变更。

虽然说是要实现追踪数组长度，但是实际上我们已经在追踪数组长度变化了。

如果您在浏览器中运行以下代码，可以看到当使用 `JSON.stringify` 将数组字符串化时，数组的 `length` 属性也会被读取。

```ts
const data = new Proxy([], {
  get(target, key) {
    console.log('get!', key)
    return Reflect.get(target, key)
  },
})

JSON.stringify(data)
// get! length
// get! toJSON
```

也就是说，现在 `length` 属性实际上已经注册了对应的 `effect`，之后只要在 `index` 索引被更新时提取这个 `effect` 然后触发它就可以了。

首先我们检查当前设置的属性的 `key` 是不是 `index` 索引，如果是则触发 `length` 对应的 `effect`。

当然，这些索引可能还有其他的依赖关系，所以我们将它的依赖全部提取到一个 `deps` 数组中，然后统一触发。

```ts
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  // 这里
  if (isIntegerKey(key)) {
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

```ts
// shared/general.ts
export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key
```

这样，应该就可以正常响应数组的变化了。

### 针对对象的场景

接下来就是处理对象了。对数组不同的是，对象是没有 `length` 属性的。

我们需要进行一些修改。

既然对象没有 `length` 这样的属性，那么我们可以增加一个 `ITERATE_KEY` 这样的 `Symbol` 值来起到和 `length` 一样的效果。

这里可能理解起来有点儿复杂。但是你只要知道 `depsMap` 本身是一个 `Map` 对象，所以我们可以用自己定义的数据来作为 `key` 使用。

与之前的数组的处理顺序不一样，我们需要先思考 `trigger` 触发器怎么定义。只要我们实现了一个名为 `ITERATE_KEY` 的 `Symbol` 常量，当 `targetMap` 中能获取到这个对象的 `ITERATE_KEY` 对应的 `deps` 数据时，执行它的副作用函数就可以了。

```ts
export const ITERATE_KEY = Symbol()

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  if (!isArray(target)) {
    // 如果不是数组，则触发注册的 `ITERATE_KEY` 对应的 effect。
    deps.push(depsMap.get(ITERATE_KEY))
  } else if (isIntegerKey(key)) {
    // new index added to array -> length changes
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

但是现在的问题是怎么样去追踪 `ITERATE_KEY` 对应的 `effect` 副作用。

这里，我们可以使用 `proxy` 提供的 `ownKeys` 代理处理函数。

https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/ownKeys

`ownKeys` 除了会被 `Object.keys()` 和 `Reflect.ownKeys()` 这样的函数调用，实际上 `JSON.stringify` 也会触发。

您可以尝试一下再浏览器控制台执行下面的代码，就可以看到打印结果了。

```ts
const data = new Proxy(
  {},
  {
    get(target, key) {
      return Reflect.get(target, key)
    },
    ownKeys(target) {
      console.log('ownKeys!!!')
      return Reflect.ownKeys(target)
    },
  },
)

JSON.stringify(data)
```

然后，我们就可以在这里使用 `ITERATE_KEY` 进行追踪了。

当然，如果是数组的话是不需要这样的，我们直接追踪它的 `length` 就可以了。

```ts
export const mutableHandlers: ProxyHandler<object> = {
  // .
  // .
  ownKeys(target) {
    track(target, isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
}
```

这样就可以处理对象的键的增减了！

## 支持 Connection 集合类的内置对象

目前，我们的 `reactive.ts` 的实现还只支持 `Object` 和 `Array` 这两种数据。

```ts
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    default:
      return TargetType.INVALID
  }
}
```

在 Vue.js 中，除了这些之外，还支持 `Map`、 `Set`、 `WeakMap` 和 `WeakSet`。

https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/reactive.ts#L43C1-L56C2

这些对象是作为另一组 `Proxy` 处理程序实现的。它们被称为 `collectionHandlers`。

在这里，我们的目标就是实现这个 `collectionHandlers`，并且让以下代码能够正常工作。

```ts
const app = createApp({
  setup() {
    const state = reactive({ map: new Map(), set: new Set() })

    return () =>
      h('div', {}, [
        h('h1', {}, [`ReactiveCollection`]),

        h('p', {}, [
          `map (${state.map.size}): ${JSON.stringify([...state.map])}`,
        ]),
        h('button', { onClick: () => state.map.set(Date.now(), 'item') }, [
          'update map',
        ]),

        h('p', {}, [
          `set (${state.set.size}): ${JSON.stringify([...state.set])}`,
        ]),
        h('button', { onClick: () => state.set.add('item') }, ['update set']),
      ])
  },
})

app.mount('#app')
```

在 `collectionHandlers` 中，我们实现了对 `add`、`set`、`delete` 等方法的 `getter` 进行处理。

这些实现在 `collectionHandlers.ts` 文件中。

https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/collectionHandlers.ts

然后，则是对 `TargetType` 进行判断，如果是 `collection` 类型（即 `TargetType.COLLECTION`），则根据这组处理程序生成一个 `Proxy` 代理对象。

需要注意的是，要将 `target` 自身传递给 `Reflect` 的 `receiver` 方法，这样做是为了避免如果 `target` 本身已经设置了 `Proxy`， 会导致无限循环的情况。

为了避免发生这种情况，我们需要对 `target` 进行结构化处理，以便在实现 `Proxy` 处理程序时对这些原始数据进行操作。

```ts
export const enum ReactiveFlags {
  RAW = '__v_raw',
}

export interface Target {
  [ReactiveFlags.RAW]?: any
}
```

严格来说，即便是之前实现的常规数据的 `reactive` 响应式处理程序中，也应该实现这个功能，但是由于以前没有遇到这个问题，为了尽量减少不必要的解释，我们就省略了这一点。

现在让我们再尝试实现一种情况，当进入 `getter` 过程的 `key` 为 `ReactiveFlags.RAW` 时，我们应该返回原始数据而不是 `Proxy` 代理对象。

并且，我们还需要实现了一个名为 `toRaw` 的函数，它从目标（`Proxy` 代理对象）中递归地获取原始数据，并最终返回获取的所有数据的原始状态（也就是响应式对象对应的原始数据）。

```ts
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
```

顺便说一下，`toRaw` 函数也是 Vue.js 提供的一个 API。

https://cn.vuejs.org/api/reactivity-advanced.html#toraw

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/120_proxy_handler_improvement)
