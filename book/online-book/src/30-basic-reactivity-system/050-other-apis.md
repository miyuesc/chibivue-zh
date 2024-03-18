# 其他的响应式 API

::: warning
2023 年 12 月月底 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布了，其中包括了 [reactivity 的性能优化](https://github.com/vuejs/core/pull/5912) 部分。  
需要注意的是，本书参考的是 Vue.js 之前的实现方式。  
本章内容不会有太大改变，但是文件结构可能略有调整，代码也有部分改动。
我也会在日后对这本书进行相应的更新。  
:::

## 现在让我们来实现一下其他的响应式 API 吧

- customRef
- readonly
- shallowReactive
- unref
- isProxy
- isReactive
- isReadonly

我相信已经阅读到这个位置的人应该都可以一边阅读源代码一边自己实现了。

当前源代码位于: [chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/150_other_apis)
