# SFC的script块编译

## 我们要做什么

首先，SFC中的script部分原本是这样的：

```ts
export default {
  setup() {},
}
```

我们希望将这部分与之前生成的render函数很好地混合并导出，但是能否只提取出：

```ts
{
  setup() {},
}
```

这部分呢？

如果我们能提取出这部分，那么就可以这样处理：

```ts
const _sfc_main = {
  setup() {},
}

export default { ..._sfc_main, render }
```

## 使用外部库

要实现上述目标，我们将使用以下两个库来简化实现：

- @babel/parser
- magic-string

### Babel

https://babeljs.io

[What is Babel](https://babeljs.io/docs)

经常使用JavaScript的人可能对它很熟悉。  
Babel是一个用于将JavaScript转换为向后兼容版本的工具链。  
简单来说，它是一个JS到JS的编译器(转译器)。

这次我们不仅将Babel作为编译器使用，还将其作为解析器使用。  
Babel作为编译器，其内部当然实现了将代码转换为AST的解析器。  
我们将使用这个解析器库。

刚才提到了AST这个术语，JavaScript当然也有AST表示。  
这里有AST的规范：(https://github.com/estree/estree)  
您可以查看上述GitHub中的md文件，但让我简单解释一下JavaScript的AST：  
首先，整个程序由一个名为Program的AST节点表示，它包含一个Statement数组。(为了方便理解，我用TS的interface表示)

```ts
interface Program {
  body: Statement[]
}
```

Statement在中文中是"语句"。JavaScript是语句的集合。  
具体来说，有"变量声明语句"、"if语句"、"for语句"、"块语句"等。

```ts
interface Statement {}

interface VariableDeclaration extends Statement {
  /* 省略 */
}

interface IfStatement extends Statement {
  /* 省略 */
}

interface ForStatement extends Statement {
  /* 省略 */
}

interface BlockStatement extends Statement {
  body: Statement[]
}
// 还有很多其他类型
```

而语句在大多数情况下包含"Expression(表达式)"。  
表达式可以理解为可以赋值给变量的东西。  
具体例子包括"对象"、"二元运算"、"函数调用"等。

```ts
interface Expression {}

interface BinaryExpression extends Expression {
  operator: '+' | '-' | '*' | '/' // 还有很多，但这里省略
  left: Expression
  right: Expression
}

interface ObjectExpression extends Expression {
  properties: Property[] // 省略
}

interface CallExpression extends Expression {
  callee: Expression
  arguments: Expression[]
}

// 还有很多其他类型
```

考虑if语句，它具有以下结构：

```ts
interface IfStatement extends Statement {
  test: Expression // 条件值
  consequent: Statement // 条件为true时执行的语句
  alternate: Statement | null // 条件为false时执行的语句
}
```

这样，JavaScript的语法会被解析为上述的AST。  
对于已经实现过chibivue模板编译器的各位来说，这应该很容易理解。(是同一个概念)

为什么要使用Babel？有两个原因：一是单纯因为自己实现太麻烦。  
虽然熟悉解析器实现的各位技术上可以参考estree自己实现JS解析器，  
但这会非常麻烦，而且对于我们的目标"深入理解Vue"来说不是特别重要。  
另一个原因是Vue官方在这部分也使用了Babel。

### magic-string

https://github.com/rich-harris/magic-string

还有一个我们想使用的库，这也是Vue官方使用的。  
这是一个让字符串操作更便捷的库。

```ts
const input = 'Hello'
const s = new MagicString(input)
```

像这样创建一个实例，然后使用实例上的便捷方法进行字符串操作。  
下面是一些例子：

```ts
s.append('!!!') // 在末尾添加
s.prepend('message: ') // 在开头添加
s.overwrite(9, 13, '你好') // 指定范围覆盖
```

虽然不是必须使用这个库，但为了与Vue官方保持一致，我们决定使用它。

无论是Babel还是magic-string，具体用法会在实现过程中一并解释，所以只需要有一个大致的了解即可。

## 重写script的default export

再次确认我们的目标：我们想将

```ts
export default {
  setup() {},
  // 其他选项
}
```

重写为

```ts
const _sfc_main = {
  setup() {},
  // 其他选项
}

export default { ..._sfc_main, render }
```

换句话说，我们需要从原始代码的export语句中提取出export对象，并将其赋值给一个名为_sfc_main的变量。

首先安装所需库：

```sh
pwd # ~
ni @babel/parser magic-string
```

创建一个rewriteDefault.ts文件：

```sh
pwd # ~
touch packages/compiler-sfc/rewriteDefault.ts
```

这个函数接收input（源代码）和as（最终要绑定的变量名）作为参数，并返回转换后的源代码。

`~/packages/compiler-sfc/rewriteDefault.ts`

```ts
export function rewriteDefault(input: string, as: string): string {
  // TODO:
  return ''
}
```

首先，我们处理不存在export声明的情况。
如果没有export，就绑定一个空对象并返回。

```ts
const defaultExportRE = /((?:^|\n|;)\s*)export(\s*)default/
const namedDefaultExportRE = /((?:^|\n|;)\s*)export(.+)(?:as)?(\s*)default/s

export function rewriteDefault(input: string, as: string): string {
  if (!hasDefaultExport(input)) {
    return input + `\nconst ${as} = {}`
  }

  // TODO:
  return ''
}

export function hasDefaultExport(input: string): boolean {
  return defaultExportRE.test(input) || namedDefaultExportRE.test(input)
}
```

现在是Babel解析器和magic-string登场的时候了。

```ts
import { parse } from '@babel/parser'
import MagicString from 'magic-string'
// .
// .
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  const s = new MagicString(input)
  const ast = parse(input, {
    sourceType: 'module',
  }).program.body
  // .
  // .
}
```

接下来，我们将基于Babel解析器生成的JavaScript AST(ast)对s进行字符串操作。  
虽然代码有些长，但我会在源代码注释中添加补充说明。  
基本上就是遍历AST，根据节点类型进行分支处理，然后使用magic-string的方法操作s。

```ts
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  ast.forEach(node => {
    // 处理default export的情况
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration') {
        // 如果是`export default class Hoge {}`，则替换为`class Hoge {}`
        s.overwrite(node.start!, node.declaration.id.start!, `class `)
        // 然后在末尾添加`const ${as} = Hoge;`这样的代码
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        // 其他default export情况，将声明部分替换为变量声明
        // 例1) `export default { setup() {}, }`  ->  `const ${as} = { setup() {}, }`
        // 例2) `export default Hoge`  ->  `const ${as} = Hoge`
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
      }
    }

    // 在named export的情况下，也可能在声明中出现default export
    // 主要有3种模式：
    //   1. `export { default } from "source";`这样的声明
    //   2. `export { hoge as default }` from 'source'这样的声明
    //   3. `export { hoge as default }`这样的声明
    if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          // 如果有`from`关键字
          if (node.source) {
            if (specifier.local.name === 'default') {
              // 1. 对于`export { default } from "source";`这样的声明
              // 将其提取为import语句并命名，然后绑定到最终变量
              // 例) `export { default } from "source";`  ->  `import { default as __VUE_DEFAULT__ } from 'source'; const ${as} = __VUE_DEFAULT__`
              const end = specifierEnd(input, specifier.local.end!, node.end!)
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              // 2. 对于`export { hoge as default }` from 'source'这样的声明
              // 先将所有specifier转换为import语句，然后将as default的变量绑定到最终变量
              // 例) `export { hoge as default } from "source";`  ->  `import { hoge } from 'source'; const ${as} = hoge
              const end = specifierEnd(
                input,
                specifier.exported.end!,
                node.end!,
              )
              s.prepend(
                `import { ${input.slice(
                  specifier.local.start!,
                  specifier.local.end!,
                )} } from '${node.source.value}'\n`,
              )

              // 3. 对于`export { hoge as default }`这样的声明
              // 简单地绑定到最终变量
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = ${specifier.local.name}`)
              continue
            }
          }
          const end = specifierEnd(input, specifier.end!, node.end!)
          s.overwrite(specifier.start!, end, ``)
          s.append(`\nconst ${as} = ${specifier.local.name}`)
        }
      }
    }
  })
  return s.toString()
}

// 计算声明语句的结束位置
function specifierEnd(input: string, end: number, nodeEnd: number | null) {
  // export { default   , foo } ...
  let hasCommas = false
  let oldEnd = end
  while (end < nodeEnd!) {
    if (/\s/.test(input.charAt(end))) {
      end++
    } else if (input.charAt(end) === ',') {
      end++
      hasCommas = true
      break
    } else if (input.charAt(end) === '}') {
      break
    }
  }
  return hasCommas ? end : oldEnd
}
```

现在我们可以重写default export了。  
让我们在插件中实际使用它：

```ts
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse, rewriteDefault } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")

      const { descriptor } = parse(code, { filename: id })

      // --------------------------- 从这里开始
      const SFC_MAIN = '_sfc_main'
      const scriptCode = rewriteDefault(
        descriptor.script?.content ?? '',
        SFC_MAIN,
      )
      outputs.push(scriptCode)
      // --------------------------- 到这里结束

      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { ...${SFC_MAIN}, render }`) // 这里

      return { code: outputs.join('\n') }
    },
  }
}
```

在此之前需要做一点修改：

`~/packages/runtime-core/component.ts`

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .
  // 将component的render选项添加到实例中
  const { render } = component
  if (render) {
    instance.render = render as InternalRenderFunction
  }
}
```

现在应该可以渲染出来了！！！

![render_sfc](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/render_sfc.png)

由于我们还没有处理样式，所以样式没有应用，但渲染功能已经实现了。 