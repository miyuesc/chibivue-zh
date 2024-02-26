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
      {
        icon: {
          svg: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-star-fill starred-button-icon d-inline-block mr-2">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path>
</svg>`,
        },
        ariaLabel: 'Star this repo',
        link: 'https://github.com/Ubugeeei/chibivue',
      },
      { icon: 'github', link: 'https://github.com/miyuesc/chibivue-zh' },
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
