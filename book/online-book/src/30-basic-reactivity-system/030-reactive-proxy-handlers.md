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
ついでに、component だった場合は component の setupContext を ref に代入してあげましょう。  
(※ ここは本当はコンポーネントの proxy を渡すべきなんですが、まだ未実装のため setupContext ということにしています。)

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

## key が増減するオブジェクトに対応する

実は、今の実装では key が増減するオブジェクトに対応できていません。
この、「key が増減するオブジェクト」と言うのは配列も含みます。  
要するに、以下のようなコンポーネントが正常に動作しません。

```ts
const App = {
  setup() {
    const array = ref<number[]>([])
    const mutateArray = () => {
      array.value.push(Date.now()) // trigger しても何も effect がない (この時、set の key は "0")
    }

    const record = reactive<Record<string, number>>({})
    const mutateRecord = () => {
      record[Date.now().toString()] = Date.now() // trigger しても何も effect がない (key 新しく設定された key)
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

これを解決するにはどうしたら良いでしょうか?

### 配列の場合

配列もいってしまえばオブジェクトなので、新しい要素を追加するとその index が key として Proxy の set の handler に入ってきます。

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

しかしこれらの key をそれぞれ track するわけにはいきません。
そこで、length を track することで配列の変更をトリガーするようにします。

length を track すると言いましたが、実はすでに track されるようになっています。

以下のようなコードをブラウザなどで実行してみると JSON.stringify で配列を文字列化した際に length が呼ばれていることがわかります。

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

つまりすでに length には effect が登録されているので、あとは index が set された時に、この effect を取り出して trigger してあげれば良いわけです。

入ってきた key が index かどうかを判定して、index だった場合は length の effect を trigger するようにします。
他にも dep がある可能性はもちろんあるので、 deps という配列に切り出して、effect を詰めてまとめて trigger してあげます。

```ts
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  // これ
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

これで配列の場合は動くようになりました。

### オブジェクト(レコード)の場合

続いてはオブジェクトですが、配列とは違い length という情報は持っていません。

これは一工夫します。  
`ITERATE_KEY` というシンボルを用意してこれを配列の時の length のように使います。  
何を言っているのかよく分からないかもしれませんが、depsMap はただの Map なので、別に勝手に用意したものを key として使っても問題ありません。

配列の時と少し順番は変わりますが、まず trigger から考えてみます。
あたかも `ITERATE_KEY` というものが存在し、そこに effect が登録されているかのような実装をしておけば OK です。

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
    // 配列でない場合は、ITERATE_KEY に登録された effect を trigger する
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

問題は、この `ITERATE_KEY` に対してどう effect をトラックするかです。

ここで、 `ownKeys` と言う Proxy ハンドラを利用します。

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/ownKeys

ownKeys は `Object.keys()` や `Reflect.ownKeys()` などで呼ばれますが、実は `JSON.stringify` でも呼ばれます。

試しに以下のコードをブラウザなどで動かしてみるとそれを確認できます。

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

あとはこれを利用して `ITERATE_KEY` を track すれば良いわけです。
配列だった場合は、必要ないのでテキトーに length を track してあげます。

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

これでキーが増減するオブジェクトに対応でき多はずです！

## Collection 系の組み込みオブジェクトに対応する

今、reactive.ts の実装を見てみると、Object と Array のみを対象としています。

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

Vue.js では、これらに加え、Map, Set, WeakMap, WeakSet に対応しています。

https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/reactive.ts#L43C1-L56C2

そして、これらのオブジェクトは別の Proxy ハンドラとして実装されています。それが、`collectionHandlers`と呼ばれるものです。

ここでは、この collectionHandlers を実装し、以下のようなコードが動くことを目指します。

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

collectionHandlers では、add や set, delete といったメソッドの getter にハンドラを実装します。  
それらを実装しているのが collectionHandlers.ts です。  
https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/collectionHandlers.ts#L0-L1  
TargetType を判別し、collection 型の場合 h にはこのハンドラを元に Proxy を生成します。  
実際に実装してみましょう!

注意点としては、Reflect の receiver に target 自身を渡す点で、target 自体に Proxy が設定されていた場合に無限ループになることがある点です。  
これを回避するために target に対して生のデータも持たせておくような構造に変更し、Proxy のハンドラを実装するにあたってはこの生データを操作するように変更します。

```ts
export const enum ReactiveFlags {
  RAW = '__v_raw',
}

export interface Target {
  [ReactiveFlags.RAW]?: any
}
```

厳密には今までの通常の reactive ハンドラでもこの実装をしておくべきだったのですが、今までは特に問題なかったという点と余計な説明をなるべく省くために省略していました。  
getter に入ってきたの key が ReactiveFlags.RAW の場合には Proxy ではなく生のデータを返すような実装にしてみましょう。

それに伴って、target から再帰的に生データをとり、最終的に全てが生の状態のデータを取得する toRaw という関数も実装しています。

```ts
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
```

ちなみに、この toRaw 関数は API としても提供されている関数です。

https://ja.vuejs.org/api/reactivity-advanced.html#toraw

当前源代码位于:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/120_proxy_handler_improvement)
