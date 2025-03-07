import { sharedConfig } from './shared.js'
import { zhCnConfig } from './zh-cn.js'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { defineConfig } from 'vitepress'

// The same situation as the issue below is occurring, so mermaid is rendered only during production build.
// https://github.com/iamkun/dayjs/issues/480
export default (process.env.NODE_ENV === 'production'
  ? withMermaid
  : defineConfig)({
  ...sharedConfig,
  vite: {
    ssr: {
      noExternal: [
        // 如果还有别的依赖需要添加的话，并排填写和配置到这里即可
        '@nolebase/vitepress-plugin-enhanced-readabilities',
      ],
    },
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/',
      ...zhCnConfig,
    },
    ja: {
      label: 'Japanese',
      lang: 'ja',
      link: 'https://book.chibivue.land/ja/',
    },
    en: {
      label: 'English',
      lang: 'en',
      link: 'https://book.chibivue.land/',
    },
  },
})
