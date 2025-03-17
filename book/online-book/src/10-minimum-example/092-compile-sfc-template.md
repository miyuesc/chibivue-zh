# SFC的template块编译

## 切换编译器

在解析结果的`descriptor.script.content`和`descriptor.template.content`中分别包含了它们的源代码。  
我们希望能够正确地编译这些内容。首先从template部分开始。  
我们已经有了模板编译器。  
但是，如果你看下面的代码：

```ts
export const generate = ({
  children,
}: {
  children: TemplateChildNode[]
}): string => {
  return `return function render(_ctx) {
  with (_ctx) {
    const { h } = ChibiVue;
    return ${genNode(children[0])};
  }
}`
}
```

这段代码是为了使用Function构造函数创建新函数的前提下编写的，所以前面有一个"return"。  
但在SFC编译器中，我们只想生成render函数，因此让我们通过编译器选项来处理这种分支情况。  
我们将使编译器接受第二个参数作为选项，并允许指定一个名为`isBrowser`的标志。  
当这个变量为true时，它会输出一个预期在运行时上被new调用的代码；当为false时，它只是生成代码。

```sh
pwd # ~
touch packages/compiler-core/options.ts
```

`packages/compiler-core/options.ts`

```ts
export type CompilerOptions = {
  isBrowser?: boolean
}
```

`~/packages/compiler-dom/index.ts`

```ts
export function compile(template: string, option?: CompilerOptions) {
  const defaultOption: Required<CompilerOptions> = { isBrowser: true }
  if (option) Object.assign(defaultOption, option)
  return baseCompile(template, defaultOption)
}
```

`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(
  template: string,
  option: Required<CompilerOptions>,
) {
  const parseResult = baseParse(template.trim())
  const code = generate(parseResult, option)
  return code
}
```

`~/packages/compiler-core/codegen.ts`

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
    ${option.isBrowser ? 'with (_ctx) {' : ''}
      const { h } = ChibiVue;
      return ${genNode(children[0], option)};
    ${option.isBrowser ? '}' : ''}
}`
}
```

我还添加了import语句。也将代码生成方式改为将源代码放入output数组。

```ts
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'\n")

      const { descriptor } = parse(code, { filename: id })
      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { render }`)

      return { code: outputs.join('\n') }
    },
  }
}
```

## 问题

现在我们应该能够编译render函数了。让我们在浏览器源代码中检查一下。

但实际上，这里有一个小问题。

在将数据绑定到模板时，我们使用了with语句，但由于Vite处理ESM的方式，它无法处理只在非严格模式（sloppy模式）下工作的代码，因此无法处理with语句。  
此前，我们没有在vite上处理代码，而是简单地将包含with语句的代码（字符串）传递给Function构造函数，在浏览器上将其变为函数，所以没有问题，但现在会出错。  
你应该会看到类似以下的错误：

> Strict mode code may not include a with statement

这个问题在Vite的官方文档中也有作为故障排除的说明。

[Syntax Error / Type Error 发生 (Vite)](https://ja.vitejs.dev/guide/troubleshooting.html#syntax-error-type-error-%E3%81%8B%E3%82%99%E7%99%BA%E7%94%9F%E3%81%99%E3%82%8B)

作为临时解决方案，我们将在非浏览器模式下生成不包含with语句的代码。

具体来说，对于绑定的数据，我们将不使用with语句，而是通过添加前缀`_ctx.`来控制。  
这只是临时解决方案，所以不是很严格，但总体上应该能正常工作。  
（我们将在后面的章节中进行更合适的处理。）

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  // 当isBrowser为false时，生成不包含with语句的代码
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
    ${option.isBrowser ? 'with (_ctx) {' : ''}
      const { h } = ChibiVue;
      return ${genNode(children[0], option)};
    ${option.isBrowser ? '}' : ''}
}`
}

// .
// .
// .

const genNode = (
  node: TemplateChildNode,
  option: Required<CompilerOptions>,
): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node, option)
    case NodeTypes.TEXT:
      return genText(node)
    case NodeTypes.INTERPOLATION:
      return genInterpolation(node, option)
    default:
      return ''
  }
}

const genElement = (
  el: ElementNode,
  option: Required<CompilerOptions>,
): string => {
  return `h("${el.tag}", {${el.props
    .map(prop => genProp(prop, option))
    .join(', ')}}, [${el.children.map(it => genNode(it, option)).join(', ')}])`
}

const genProp = (
  prop: AttributeNode | DirectiveNode,
  option: Required<CompilerOptions>,
): string => {
  switch (prop.type) {
    case NodeTypes.ATTRIBUTE:
      return `${prop.name}: "${prop.value?.content}"`
    case NodeTypes.DIRECTIVE: {
      switch (prop.name) {
        case 'on':
          return `${toHandlerKey(prop.arg)}: ${
            option.isBrowser ? '' : '_ctx.' // -------------------- 这里
          }${prop.exp}`
        default:
          // TODO: other directives
          throw new Error(`unexpected directive name. got "${prop.name}"`)
      }
    }
    default:
      throw new Error(`unexpected prop type.`)
  }
}

// .
// .
// .

const genInterpolation = (
  node: InterpolationNode,
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? '' : '_ctx.'}${node.content}` // ------------ 这里
}
```

![compile_sfc_render](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/compile_sfc_render.png)

看起来编译成功了。接下来我们需要做的是用同样的方法，提取script并将其插入到default exports中。

到目前为止的源代码:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler3) 