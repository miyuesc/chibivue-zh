# 生命周期钩子 (Basic Component System 基础组件系统章节开始啦)

## 实现生命周期钩子函数

实现生命周期钩子函数其实非常简单，只需要在 `ComponentInternalInstance` 组件实例中注册对应的钩子函数，并在渲染的时候在适当的时机执行即可。

我们将在 `runtime-core/apiLifecycle.ts` 中实现这些 API。

需要注意的一点是，在 `onMounted/onUnmounted/onUpdated` 中还需要考虑任务调度的问题。

我们希望注册的函数在完全完成挂载（`onMounted`）、卸载（`onUnmounted`）或更新（`onUpdated`）后才执行。

因此，在调度器中，我们将实现一个分类为 `Post` 的新任务队列(`pendingPostFlushCbs`)。这个队列会在现有队列 `flush` 全部执行完成后再执行。

想象一下：

```ts
const queue: SchedulerJob[] = [] // 现有实现
const pendingPostFlushCbs: SchedulerJob[] = [] // 我们新建的队列

function queueFlush() {
  queue.forEach(job => job())
  flushPostFlushCbs() // 在 queue 执行完后再执行
}
```

然后，我们需要实现一个将函数加入 `pendingPostFlushCbs` 队列的 API。

然后在 `renderer` 中使用这个 API 将 `enqueue` 加入 `pendingPostFlushCbs` 队列。

我们这次需要实现的生命周期钩子包括：

- `onMounted`
- `onUpdated`
- `onUnmounted`
- `onBeforeMount`
- `onBeforeUpdate`
- `onBeforeUnmount`

让我们尝试实现一下，确保下面的代码可以正常运行。

```ts
import {
  createApp,
  h,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  ref,
} from 'chibivue'

const Child = {
  setup() {
    const count = ref(0)
    onBeforeMount(() => {
      console.log('onBeforeMount')
    })

    onUnmounted(() => {
      console.log('onUnmounted')
    })

    onBeforeUnmount(() => {
      console.log('onBeforeUnmount')
    })

    onBeforeUpdate(() => {
      console.log('onBeforeUpdate')
    })

    onUpdated(() => {
      console.log('onUpdated')
    })

    onMounted(() => {
      console.log('onMounted')
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['increment']),
      ])
  },
}

const app = createApp({
  setup() {
    const mountFlag = ref(true)

    return () =>
      h('div', {}, [
        h('button', { onClick: () => (mountFlag.value = !mountFlag.value) }, [
          'toggle',
        ]),
        mountFlag.value ? h(Child, {}, []) : h('p', {}, ['unmounted']),
      ])
  },
})

app.mount('#app')
```

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/010_lifecycle_hooks)
