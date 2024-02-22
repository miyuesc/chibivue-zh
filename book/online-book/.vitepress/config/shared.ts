import { defineConfig } from 'vitepress'

export const sharedConfig = defineConfig({
  title: 'The chibivue Book',
  appearance: 'dark',
  description: '一步一步，从一行 "Hello, World" 开始创建 Vue.js',
  lang: 'zh-cn',
  srcDir: 'src',
  srcExclude: ['__wip'],
  head: [
    [
      'link',
      {
        rel: 'icon',
        href: 'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/logo.png?raw=true',
      },
    ],

    // source og
    ['meta', { property: 'source_og:site_name', content: 'chibivue' }],
    [
      'meta',
      {
        property: 'source_og:url',
        content: 'https://ubugeeei.github.io/chibivue',
      },
    ],
    ['meta', { property: 'source_og:title', content: 'chibivue' }],
    [
      'meta',
      {
        property: 'source_og:description',
        content:
          'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
      },
    ],
    [
      'meta',
      {
        property: 'source_og:image',
        content:
          'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/chibivue-img.png?raw=true',
      },
    ],
    ['meta', { property: 'source_og:image:alt', content: 'chibivue' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Writing Vue.js: Step by Step, from just one line of "Hello, World".',
      },
    ],

    // translator og
    [
      'meta',
      { property: 'og:url', content: 'https://miyuesc.github.io/chibivue' },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content: '一步一步，从一行 "Hello, World" 开始创建 Vue.js',
      },
    ],
  ],
  themeConfig: {
    logo: 'https://github.com/Ubugeeei/chibivue/blob/main/book/images/logo/logo.png?raw=true',
    search: { provider: 'local' },
    outline: 'deep',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Ubugeeei/chibivue' },
      { icon: 'twitter', link: 'https://twitter.com/ubugeeei' },
      { icon: 'discord', link: 'https://discord.gg/aVHvmbmSRy' },
    ],
    editLink: {
      pattern:
        'https://github.com/miyuesc/chibivue-zh/blob/main/book/online-book/src/:path',
      text: '修改此页面',
    },
    footer: {
      copyright: `Copyright © 2023-${new Date().getFullYear()} miyuesc`,
      message: 'Released under the MIT License. Source is ubugeeei/chibivue',
    },
  },
})
