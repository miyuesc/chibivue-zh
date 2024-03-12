# scheduler 调度程序

## effect 的调度

首先，我们来看一段代码。

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({
      message: 'Hello World',
    })
    const updateState = () => {
      state.message = 'Hello ChibiVue!'
      state.message = 'Hello ChibiVue!!'
    }

    return () => {
      console.log('😎 rendered!')

      return h('div', { id: 'app' }, [
        h('p', {}, [`message: ${state.message}`]),
        h('button', { onClick: updateState }, ['update']),
      ])
    }
  },
})

app.mount('#app')
```

当您单击该按钮时，`state.message` 将发生两次更新，因此 `render` 中的 `effect` 触发器将被执行两次。
这意味着虚拟 DOM 被计算两次，并被更新两次。

![non_scheduled_effect](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/non_scheduled_effect.png)

然而，实际上 `patch` 更新只需要在 `state.message` 的第二次时执行就可以了。

所以，我们需要实现一个 “调度器（调度程序）”。
从功能上来说，调度器就是一个用于管理和控制任务的执行顺序的程序。
Vue 里面的调度器的作用之一，就是管理队列中所有响应数据更新时触发的副作用函数，以及合并一些副作用。

## 使用队列管理进行调度

具体来说，我们会有一个队列来管理所有作业（`job`，实际上是一个副作用函数）。每个 `job` 有一个 `id`，当有新的 `job` 入队时，如果已经存在相同 `id` 的  `job`，则旧的 `job` 会被覆盖。

```ts
export interface SchedulerJob extends Function {
  id?: number
}

const queue: SchedulerJob[] = []

export function queueJob(job: SchedulerJob) {
  if (
    !queue.length ||
    !queue.includes(job, isFlushing ? flushIndex + 1 : flushIndex)
  ) {
    if (job.id == null) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }
    queueFlush()
  }
}
```

从上面可以看到最重要的就是每个作业的 `id` 属性。
但是这次我们希望能根据组件来对它们进行分组，所以我们给组件实例加上一个 `uid`，用它来作为 `job` 的 `id`。

`uid` 是一个递增的标识。

## ReactiveEffect 和调度器

目前，我们的 `ReactiveEffect` 具有以下结构（省略了一部分）。

```ts
class ReactiveEffect {
  public fn: () => T,
  run() {}
}
```

但是我们现在需要根据调度器的实现稍微修改一下。

目前，我们在 `fn` 中传递的是一个函数，作为需要执行的 “动作”。但是这一次，我们需要将它分成 “主动执行的动作” 和 “被动执行的动作” 两种函数。

响应式副作用（动作）可以由设置它的一方主动执行，也可以将其添加到 `dep` 中由外部的某些操作来触发执行（被动执行）。

对于后一种类型（被动执行），这个副作用（动作）可以被添加到多个 `depsMap` 中并由多个源触发，所以调度是必要的（另一方面，如果它被显式地主动调用，则这种调度就不需要了）。

我们来看一下这个具体的例子。现在我们在 `renderer` 中的 `setupRenderEffect` 函数中，有这样的实现逻辑：

```ts
const effect = (instance.effect = new ReactiveEffect(() => componentUpdateFn))
const update = (instance.update = () => effect.run())
update()
```

这里的 `effect` 就是一个 `reactiveEffect`，也就是响应式副作用。它会追踪 `setup` 中的响应式变量，而 `setup` 中很有可能不止一个响应式变量，所以这显然需要调度器来管理（因为有可能在不同的地方触发执行）。

但是第一次执行的时候是不需要调度的，直接执行 `update` 操作就可以了（这个过程实际上才开始收集依赖）。

你可能会想 “是吗？我们这里直接调用 `componentUpdateFn` 不也可以吗？” 但是请记住 `ReactiveEffect` 中 `run` 方法的实现，在这里直接调用 `componentUpdateFn` 是不会设置 `activeEffect` 变量的。

因此，我们需要将 “主动执行的动作” 和 “被动执行的动作（需要调度的动作）” 分开。

这一小节最终的代码实现如下：

```ts
// ReactiveEffect 的第 1 个参数是主动执行的动作, 第 2 个参数是被动执行的动作
const effect = (instance.effect = new ReactiveEffect(componentUpdateFn, () =>
  queueJob(update),
))
const update: SchedulerJob = (instance.update = () => effect.run())
update.id = instance.uid
update()
```

在实际的代码实现上，`ReactiveEffect` 还有一个与 `fn` 分开的 `scheduler` 调度函数，在 `trigger` 响应更新过程中，`scheduler` 优先执行。

```ts
export type EffectScheduler = (...args: any[]) => any;

export class ReactiveEffect<T = any> {
  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null
  );
}
```

```ts
function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    effect.scheduler()
  } else {
    effect.run() // 如果没有，执行常规操作
  }
}
```

---

现在，让我们在 Vue.js 阅读源码的同时，实际使用队列管理来实现动作的调度和分类！

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/20_basic_virtual_dom/040_scheduler)

## 我想实现 nextTick

在你阅读 Vue.js 的源代码和实现调度器时，你可能已经注意到了 `nextTick` 的出现，并想知道这里是否使用了它。

首先，我们来谈谈我们这次要完成的内容。

请看一下这个代码：

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({
      count: 0,
    })
    const updateState = () => {
      state.count++

      const p = document.getElementById('count-p')
      if (p) {
        console.log('😎 p.textContent', p.textContent)
      }
    }

    return () => {
      return h('div', { id: 'app' }, [
        h('p', { id: 'count-p' }, [`${state.count}`]),
        h('button', { onClick: updateState }, ['update']),
      ])
    }
  },
})

app.mount('#app')
```

单击此按钮并查看控制台的输出。

![old_state_dom](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/old_state_dom.png)

即使我们是在 `state.count` 状态发生改变之后再读取的页面内容，但是控制台输出的信息依旧是 “过时的”。

这是因为 DOM 在响应式数据的状态发生变化时，并不会立即更新 DOM，并且在执行控制台输出的时候，DOM 依旧处于没有更新的状态。

这就是 `nextTick` 的使用之处了。

https://vuejs.org/api/general.html#nexttick

`nextTick` 也是一个属于调度器的 API，它允许你等待 DOM 应用更新之后再执行相关操作。

实现 `nextTick` 的方法也很简单，只需要正在刷新过程中的 `job` 队列（`Promise`），并将 `nextTick` 中的任务添加到 `.then` 中执行。


```ts
export function nextTick<T = void>(
  this: T,
  fn?: (this: T) => void,
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}
```

这意味着，当所有任务完成时（`promise` 已经 `resolve`），它将执行传递给 `nextTick` 函数的回调函数（如果队列中没有作业，则将其连接到 `resolvedPromise` 中）。

当然，`nextTick` 本身也会返回一个 `Promise`，作为一个开发接口，开发者可以自行决定给它传递一个回调函数，还是使用 `await` 等待当前任务队列的执行结束。

```ts
import { createApp, h, reactive, nextTick } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({
      count: 0,
    })
    const updateState = async () => {
      state.count++

      await nextTick() // 等待
      const p = document.getElementById('count-p')
      if (p) {
        console.log('😎 p.textContent', p.textContent)
      }
    }

    return () => {
      return h('div', { id: 'app' }, [
        h('p', { id: 'count-p' }, [`${state.count}`]),
        h('button', { onClick: updateState }, ['update']),
      ])
    }
  },
})

app.mount('#app')
```

![next_tick](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/next_tick.png)

现在，让我们重写之前的调度器的实现，以保留 `currentFlushPromise` 并实现 `nextTick` 方法。

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/20_basic_virtual_dom/050_next_tick)
