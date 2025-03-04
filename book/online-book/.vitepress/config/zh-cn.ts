import { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const zhCnConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  themeConfig: {
    nav: [
      { text: '主页', link: '/' },
      { text: '开始学习', link: '/00-introduction/010-about' },
      { text: '翻译计划', link: '/plan/milestones' },
      { text: '翻译进度：第五章第三节', link: '' },
    ],
    sidebar: [
      {
        text: '入门',
        collapsed: false,
        items: [
          { text: '开篇', link: '/00-introduction/010-about' },
          {
            text: 'Vue.js 是什么?',
            link: '/00-introduction/020-what-is-vue',
          },
          {
            text: 'Vue.js 的关键组成部分',
            link: '/00-introduction/030-vue-core-components',
          },
          {
            text: '如何继续阅读本书并搭建环境',
            link: '/00-introduction/040-setup-project',
          },
        ],
      },
      {
        text: '最简实现示例',
        collapsed: false,
        items: [
          {
            text: '首次渲染和 createApp API',
            link: '/10-minimum-example/010-create-app-api',
          },
          {
            text: '实现 HTML 元素的渲染',
            link: '/10-minimum-example/020-simple-h-function',
          },
          {
            text: '一个轻量的响应式系统',
            link: '/10-minimum-example/030-minimum-reactive',
          },
          {
            text: '简化的虚拟 DOM',
            link: '/10-minimum-example/040-minimum-virtual-dom',
          },
          {
            text: '如何面向组件化开发',
            link: '/10-minimum-example/050-minimum-component',
          },
          {
            text: '简易的模板编译器',
            link: '/10-minimum-example/060-minimum-template-compiler',
          },
          {
            text: '如何处理更加复杂的 HTML 模板',
            link: '/10-minimum-example/070-more-complex-parser',
          },
          {
            text: '数据绑定',
            link: '/10-minimum-example/080-template-binding',
          },
          {
            text: '希望用 SFC(单文件组件) 开发',
            link: '/10-minimum-example/090-minimum-sfc',
          },
          {
            text: '小节',
            link: '/10-minimum-example/100-break',
          },
        ],
      },
      {
        text: '基础虚拟 DOM',
        collapsed: false,
        items: [
          {
            text: 'key 属性和补丁渲染（Path Rendering）',
            link: '/20-basic-virtual-dom/010-patch-keyed-children',
          },
          {
            text: 'VNode 类型的位表示',
            link: '/20-basic-virtual-dom/020-bit-flags',
          },
          {
            text: 'Scheduler 调度程序',
            link: '/20-basic-virtual-dom/030-scheduler',
          },
          {
            text: '🚧 不支持的 Props 更新',
            link: '/20-basic-virtual-dom/040-patch-other-attrs',
          },
        ],
      },
      {
        text: '基础响应式系统',
        collapsed: false,
        items: [
          {
            text: 'ref API',
            link: '/30-basic-reactivity-system/010-ref-api',
          },
          {
            text: 'computed / watch API',
            link: '/30-basic-reactivity-system/020-computed-watch',
          },
          {
            text: '各个响应式代理处理程序',
            link: '/30-basic-reactivity-system/030-reactive-proxy-handlers',
          },
          {
            text: 'Effect 副作用清理和作用域',
            link: '/30-basic-reactivity-system/040-effect-scope',
          },
          {
            text: '其他的响应式 API',
            link: '/30-basic-reactivity-system/050-other-apis',
          },
        ],
      },
      {
        text: '基础组件系统',
        collapsed: false,
        items: [
          {
            text: '生命周期钩子函数',
            link: '/40-basic-component-system/010-lifecycle-hooks',
          },
          {
            text: '实现 Provide/Inject',
            link: '/40-basic-component-system/020-provide-inject',
          },
          {
            text: '组件代理和组件上下文',
            link: '/40-basic-component-system/030-component-proxy-setup-context',
          },
          {
            text: '插槽',
            link: '/40-basic-component-system/040-component-slot',
          },
          {
            text: '选项式 API 支持',
            link: '/40-basic-component-system/050-options-api',
          },
        ],
      },
      {
        text: '基础模板编译器',
        collapsed: false,
        items: [
          {
            text: 'Transformer 的实现和 Codegen 重构',
            link: '/50-basic-template-compiler/010-transform',
          },
          {
            text: '实现指令的解析 (v-bind)',
            link: '/50-basic-template-compiler/020-v-bind',
          },
          {
            text: 'template 内部的表达式处理',
            link: '/50-basic-template-compiler/022-transform-expression',
          },
          {
            text: 'v-on 对应的处理方法',
            link: '/50-basic-template-compiler/025-v-on',
          },
          {
            text: 'compiler-dom 处理事件修饰符',
            link: '/50-basic-template-compiler/027-event-modifier',
          },
          {
            text: 'Fragment 片段节点',
            link: '/50-basic-template-compiler/030-fragment',
          },
          {
            text: '处理注释节点',
            link: '/50-basic-template-compiler/035-comment',
          },
          {
            text: 'v-if 和结构指令',
            link: '/50-basic-template-compiler/040-v-if-and-structural-directive',
          },
          {
            text: 'v-for 对应的处理',
            link: '/50-basic-template-compiler/050-v-for',
          },
          {
            text: '解析组件',
            link: '/50-basic-template-compiler/070-resolve-component',
          },
          {
            text: '🚧 插槽的处理',
            link: '/50-basic-template-compiler/080-slot',
          },
          {
            text: '🚧 其他内置指令',
            link: '/50-basic-template-compiler/090-other-directives',
          },
          {
            text: '🚧 细节调整',
            link: '/50-basic-template-compiler/100-chore-compiler',
          },
          {
            text: '🚧 自定义指令',
            link: '/50-basic-template-compiler/500-custom-directive',
          },
        ],
      },
      {
        text: '🚧 基础 SFC 编译器',
        collapsed: true,
        items: [
          {
            text: '🚧 script setup 的处理',
            link: '/60-basic-sfc-compiler/010-script-setup',
          },
          {
            text: '🚧 defineProps 的处理',
            link: '/60-basic-sfc-compiler/020-define-props',
          },
          {
            text: '🚧 defineEmits 的处理',
            link: '/60-basic-sfc-compiler/030-define-emits',
          },
          {
            text: '🚧 Scoped CSS 的处理',
            link: '/60-basic-sfc-compiler/040-scoped-css',
          },
        ],
      },
      {
        text: '🚧 一个 Web 应用的其他必要内容',
        collapsed: true,
        items: [
          {
            text: '🚧 插件',
            collapsed: false,
            items: [
              {
                text: '🚧 路由',
                link: '/90-web-application-essentials/010-plugins/010-router',
              },
              {
                text: '🚧 预处理器',
                link: '/90-web-application-essentials/010-plugins/020-preprocessors',
              },
            ],
          },
          {
            text: '🚧 SSR 服务端渲染',
            collapsed: false,
            items: [
              {
                text: '🚧 createSSRApp API',
                link: '/90-web-application-essentials/020-ssr/010-create-ssr-app',
              },
              {
                text: '🚧 hydration 水合',
                link: '/90-web-application-essentials/020-ssr/020-hydration',
              },
            ],
          },
          {
            text: '🚧 内置组件',
            collapsed: false,
            items: [
              {
                text: '🚧 KeepAlive',
                link: '/90-web-application-essentials/030-builtins/010-keep-alive',
              },
              {
                text: '🚧 Suspense',
                link: '/90-web-application-essentials/030-builtins/020-suspense',
              },
              {
                text: '🚧 Transition',
                link: '/90-web-application-essentials/030-builtins/030-transition',
              },
            ],
          },
          {
            text: '🚧 优化方式',
            collapsed: false,
            items: [
              {
                text: '🚧 静态提升',
                link: '/90-web-application-essentials/040-optimizations/010-static-hoisting',
              },
              {
                text: '🚧 补丁标志',
                link: '/90-web-application-essentials/040-optimizations/020-patch-flags',
              },
              {
                text: '🚧 树结构扁平化处理',
                link: '/90-web-application-essentials/040-optimizations/030-tree-flattening',
              },
            ],
          },
        ],
      },
      {
        text: '附录',
        collapsed: false,
        items: [
          {
            text: '15 内创建一个 Vue',
            collapsed: true,
            items: [
              {
                text: 'chibivue 很大吗 ?',
                link: '/bonus/hyper-ultimate-super-extreme-minimal-vue/',
              },
              {
                text: '实现',
                link: '/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl',
              },
            ],
          },
          {
            text: '调试源代码',
            link: '/bonus/debug-vuejs-core',
          },
        ],
      },
    ],
  },
}
