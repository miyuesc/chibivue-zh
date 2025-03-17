# SFC的style块实现

## 虚拟模块

现在我们来处理样式部分。在vite中，可以通过导入扩展名为css的文件来加载样式。

```js
import 'app.css'
```

我们将使用Vite的虚拟模块功能，从SFC创建虚拟CSS文件，并将其添加到输出的JS文件的import语句中。  
虚拟模块听起来可能有些复杂，但你可以理解为"在内存中保存实际上不存在的文件，使其看起来像是存在的"。  
在Vite中，可以使用`load`和`resolveId`选项来实现虚拟模块。

```ts
export default function myPlugin() {
  const virtualModuleId = 'virtual:my-module'

  return {
    name: 'my-plugin', // 必需的，会在警告和错误中显示
    resolveId(id) {
      if (id === virtualModuleId) {
        return virtualModuleId
      }
    },
    load(id) {
      if (id === virtualModuleId) {
        return `export const msg = "from virtual module"`
      }
    },
  }
}
```

通过在resolveId中设置要解析的模块id，并在load中处理该id，可以加载模块。  
在上面的例子中，文件`virtual:my-module`实际上并不存在，但是当你写：

```ts
import { msg } from 'virtual:my-module'
```

时，会加载`export const msg = "from virtual module"`。

[参考](https://ja.vitejs.dev/guide/api-plugin.html#%E4%BB%AE%E6%83%B3%E3%83%A2%E3%82%B7%E3%82%99%E3%83%A5%E3%83%BC%E3%83%AB%E3%81%AE%E8%A6%8F%E7%B4%84)

我们使用这个机制来加载SFC的style块作为虚拟的css文件。  
正如最开始说的，在vite中只需要导入扩展名为css的文件，所以我们考虑创建一个名为${SFC文件名}.css的虚拟模块。

## 使用SFC样式块内容实现虚拟模块

在这个例子中，当有一个"App.vue"文件时，我们考虑将其style部分实现为一个名为"App.vue.css"的虚拟模块。  
实现方法很简单，当加载`**.vue.css`名称的文件时，我们从去掉`.css`后的文件路径（即正常的Vue文件）使用`fs.readFileSync`获取SFC，  
解析它并获取style标签的内容，然后将其作为code返回。

```ts
export default function vitePluginChibivue(): Plugin {
  //  ,
  //  ,
  //  ,
  return {
    //  ,
    //  ,
    //  ,
    resolveId(id) {
      // 这个id实际上不存在，但我们在load中虚拟处理它，所以返回id（表示它可以被加载）
      if (id.match(/\.vue\.css$/)) return id

      // 对于这里没有返回的id，如果该文件实际存在，则该文件会被解析；如果不存在，则会报不存在的错误
    },
    load(id) {
      // 处理.vue.css被加载（import被声明并加载）的情况
      if (id.match(/\.vue\.css$/)) {
        const filename = id.replace(/\.css$/, '')
        const content = fs.readFileSync(filename, 'utf-8') // 正常获取SFC文件
        const { descriptor } = parse(content, { filename }) // 解析SFC

        // 将content合并为结果
        const styles = descriptor.styles.map(it => it.content).join('\n')
        return { code: styles }
      }
    },

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")
      outputs.push(`import '${id}.css'`) // 声明${id}.css的import语句
      //  ,
      //  ,
      //  ,
    },
  }
}
```

现在，让我们在浏览器中检查一下。

![load_virtual_css_module](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module.png)

看起来样式已经正确应用了。

在浏览器中，你可以看到css被导入，并且.vue.css文件被虚拟生成了。  
![load_virtual_css_module2](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module2.png)  
![load_virtual_css_module3](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module3.png)

现在我们可以使用SFC了！

到目前为止的源代码:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler4) 