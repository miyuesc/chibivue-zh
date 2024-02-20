# 开篇

## 🎯 本书的目的

感谢您开始阅读这本书!
我非常高兴您能对这本书有一点点兴趣。
首先总结一下这本书的目的。

**☆ 目的**

- **加深对 Vue.js 的理解**  
  Vue.js 是什么？它是如何构建的？
- **Vue.js 的基本功能实现**  
  自己动手尝试实现 Vue.js 的基本功能
- **Vuejs/core 的源码阅读**  
  理解源码和效果实现之间的具体关系，并掌握它们是如何构建的

这里只是提供了几个大致的学习目标，但是并不会要求实现所有的内容，没有必要追求与 Vue.js 一样的完善。
您可以完整的阅读所有内容，也可以挑选您感兴趣的部分自由阅读。
如果本书能够对您提供任何参考和帮助，我都会感到非常高兴。

## 🤷‍♂️ 目标受众

- **接触或者使用过 Vue.js**
- **了解或者会使用 TypeScript**

只要满足上面的条件就可以自由阅读了，不再需要其他知识点。
本书可能会存在很多大家不是很熟悉的单词，但是我会尝试在本书中尽可能的避免这种情况，或者通过代码和文字来对其进行详细的说明。
（但是如果您还不是很了解 Vue.js 或者 TypeScript，我建议您先学习这两部分内容（只需要了解就可以了，不需要十分深入））

## 🙋‍♀️  (作者)写这本书的意图 (想做的事情)

この本を書く上で意識しておきたいことをいくつかまとめておくので、その心構えで読んでいただけると幸いです。
もしも、この点で欠けている点があればご指摘ください。

- **前程知識の排除**  
  前述の「想定する対象者」に関する説明と重複してしまいますが、この本では可能な限り前程知識は排除し、随時説明してこの本で完結できることを目指します。
  これはより多くの方々にとってわかりやすい説明を広めたいからです。
  ある程度、知識のある方にとっては冗長な説明に感じる部分が多くあるかもしれませんが、その辺はご了承ください

- **インクリメンタルな実装**  
  この本の目的の一つとして、Vue.js を自分の手で小さく実装するというのがあります。  
  つまりはこの本は実装ベースで説明をしていくのですが、その際はなるべく小さくインクリメンタルな実装を心がけます。  
  もう少し具体的にいうと、「動かない状態をなるべく減らす」ということです。  
  最後まで完成しないと動かないなどといった実装は避け、なるべく常に成果物が動いている状態を目指します。  
  これは筆者が個人的に何かを実装する上でかなり大切にしていることで、動かないコードを書き続けるのはやはり辛いです。  
  不完全ではあるものの、常に動いているような状況を作ることで楽しくやっていきましょう。  
  「やった! 次はここまで動くようになった！」というのを小さく繰り返していくようなイメージです！

- **特定のフレームワーク・ライブラリ・言語などの優劣をつけるような内容にはしない**  
  今回は Vue.js を主題として取り上げますが、昨今は他にも素晴らしいフレームワークやライブラリ・言語が多数あります。
  実際、著者も Vue.js 以外でも好きなライブラリ等はたくさんありますし、自分では書かないけれどそれらで作られたサービス・知見にとても助けられることも日常茶飯事です。
  本書の目的はあくまで、「Vue.js について理解する」であり、他の議論はその範囲を超えます。ついてはそれぞれの優劣をつけるような目的は含みません。

## 💡 このオンラインブックで取り上げることと流れ

本書はかなりボリューミーな感じになってしまっているので、各部門ごとに達成マイルストーンを立てて分割します。

- **Minimal Example 部門**  
  最小の構成で Vue.js を実装します。機能としても一番小さい部門ですが、 Virtual DOM, Reactivity System , コンパイラ, SFC の実装を行います。  
  とはいえ実用的なものからは程遠く、かなり簡略化した実装になっています。  
  しかし、Vue.js の全体像がどうなっているかのざっくりした理解をしたい方にとっては十分な達成率です。  
  入門の部門でもあるということで、説明も他の部門と比べて最も丁寧に行なっています。  
  この部門を終えてからは、ある程度 Vue.js 本家のソースコードが読めるようになっているかと思います。  
  機能的には概ね以下のようなコードが動くようになります。

  ```vue
  <script>
  import { reactive } from "chibivue";

  export default {
    setup() {
      const state = reactive({ message: "Hello, chibivue!", input: "" });

      const changeMessage = () => {
        state.message += "!";
      };

      const handleInput = (e) => {
        state.input = e.target?.value ?? "";
      };

      return { state, changeMessage, handleInput };
    },
  };
  </script>

  <template>
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage">click me!</button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>
    </div>
  </template>

  <style>
  .container {
    height: 100vh;
    padding: 16px;
    background-color: #becdbe;
    color: #2c3e50;
  }
  </style>
  ```

  ```ts
  import { createApp } from "chibivue";
  import App from "./App.vue";

  const app = createApp(App);

  app.mount("#app");
  ```

- **Basic Virtual DOM 部門**  
  ここではある程度実用的な Virtual DOM のパッチレンダリング機能の実装を行います。
  suspense などの機能や最適化の実装は行いませんが、基本的なレンダリングであれば問題なくできる程度の完成度です。
  スケジューラの実装などもここで行います。

- **Basic Reactivity System 部門**  
  Minimal Example 部門では reactive という API を実装しましたが、この部門ではその他の API を実装します。
  ref/watch/computed というベーシックな API をはじめ、effectScope や shallow 系などの応用的な API まで幅広く実装します。

- **Basic Component System 部門**  
  ここでは Component System 関する基本実装を行います。実は、Basic Virtual DOM 部門で Component System のベースは実装してしまうので、
  それ以外の部分の Component System を実装します。例えば props/emit や provide/inject、 Reactivity System の拡張、ライフサイクルフックなどです。

- **Basic Template Compiler 部門**  
  Basic Virtual DOM で実装した Virtual DOM システムに対応する機能のコンパイラに加え、v-on, v-bind, v-for 等のディレクティブなどの実装を行います。  
  基本的にはコンポーネントの template オプションを利用した実装で、SFC の対応はここではやりません。

- **Basic SFC Compiler 部門**  
  ここではある程度実用的な SFC コンパイラを実装します。  [00-introduction](..%2F..%2F00-introduction)
[10-minimum-example](..%2F..%2F10-minimum-example)
[20-basic-virtual-dom](..%2F..%2F20-basic-virtual-dom)
[30-basic-reactivity-system](..%2F..%2F30-basic-reactivity-system)
[40-basic-component-system](..%2F..%2F40-basic-component-system)
[50-basic-template-compiler](..%2F..%2F50-basic-template-compiler)
[60-basic-sfc-compiler](..%2F..%2F60-basic-sfc-compiler)
[90-web-application-essentials](..%2F..%2F90-web-application-essentials)
[bonus](..%2F..%2Fbonus)
  Basic Template Compiler 部門で実装した template のコンパイラを活用しつつ、ここでは主に script のコンパイラを実装します。  
  具体的には SFC の script(の default exports)や script setup の実装を行います。  
  ここまでくると触り心地としてはかなり普段の Vue に近づきます。

- **Web Application Essentials 部門**  
  Basic SFC Compiler 部門までで、ある程度実用的な Vue.js の機能が実装されます。  
  しかし、Web アプリケーションを開発するにはまだまだ不十分です。例えばグローバルなステートの管理であったり、router の管理であったりが必要です。  
  この部門ではそういった外部プラグインの実装を行って、「Web アプリケーションを開発する」という視点においてさらに実用的なものを目指します。  
  一部、Vue.js が行っている最適化の実装なども行います。

## 🧑‍🏫 この本に対する意見や質問について

この本に関する質問や意見については可能な限り対応しようと思っています。  
Twitter で声をかけてもらってもいいですし(DM でも TL でも)、リポジトリを公開しているのでそちらの issue 等で投げてもらっても、PR を出していただいても問題ないです。  
この本も自分自身の理解も完璧ではないと思っているので、随時ご指摘いただけると嬉しいのと、「この説明がわかりづらい！」などもあれば是非問い合わせて欲しいです。  
少しでも多くの方にわかりやすく、正しい説明を広めたいので、ぜひみなさんと一緒に作り上げていけたらなと思います 👍

Twitter(X): https://twitter.com/ubugeeei

## 🦀 Discord Server について

この本の Discord Server を作りました！ (2024/01/01)  
ここではこのオンラインブックに関するアナウンスや質問対応・Tips の共有などを行っています。  
その他雑談なども大歓迎なので、ぜひ chibivue ユーザー同士で楽しくコミュニケーションしましょう。  
日本語話者が多く会話も今の所は日本語が多いですが、日本語話者以外の方も大歓迎なのであまり気にせず参加してください！ (母語を使ってもらって全く問題ないです)

### ざっくりやっていること

- 自己紹介 (任意)
- chibivue に関するアナウンス (更新情報など)
- Tips の共有
- 質問対応
- 要望対応
- 雑談
- ubugeeei が chibivue に関する作業をしているときに独り言を呟いている (野次歓迎)

### どこから参加できるか

招待リンクはこちらです 👉 https://discord.gg/aVHvmbmSRy

この本のヘッダー右上の Discord ボタンからも参加できます。

### 参加資格

chibivue (もしくは ubugeeei, もしくはこのコミュニティ) に興味がある方！  
(宣伝目的のみでのご参加はご遠慮ください)

### 参加時にやって欲しいこと

必ず general/rules を一読していただきたいです。
あとは特にありません。
