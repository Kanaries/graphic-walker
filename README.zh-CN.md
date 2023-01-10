<img src="https://ch-resources.oss-cn-shanghai.aliyuncs.com/images/lang-icons/icon128px.png" width="22px" /> [English](./README.md) | 简体中文

# graphic-walker
![](https://img.shields.io/github/license/Kanaries/graphic-walker)
![](https://img.shields.io/npm/v/@kanaries/graphic-walker)
![](https://img.shields.io/github/actions/workflow/status/kanaries/graphic-walker/auto-build.yml)


Graphic Walker 是一个tableau的开源替代，它可以帮助数据科学家或分析师们使用简单的拖拉拽操作就可以探索数据并制作可视化图表。


主要特性
+ 一个简单易用的只需拖拉拽即可生成可视化的图形交互界面。
+ 一个基于图形语法的可视化搭建系统，相比于传统的基于图表的搭建工具，能够更好的支持数据分析的场景，并在可视化探索中更加灵活。
+ 一个提供数据中异常模式的归因解释器（tableau数据解释器/salesforce einstein）。
+ 极其简单的嵌入方式，你可以像引入一个react组件一样简单的将graphic-walker嵌入到你的应用中。
+ graphic-walker将重型但计算放入web-worker中，充分利用客户端算力，使得其可以支持纯客户端部署。


## 使用

首先，上传你的CSV文件，预览数据，并根据需求对数据的分析类型进行调整（列属于维度还是度量）

> 我们正在开发更多的数据源支持类型，欢迎在issue中提出你希望支持的数据源类型，或参与开发贡献。如果你是一位开发者，由于Graphic Walker可以被当做嵌入系统直接使用，所以你可以通过参数传递的方式为Graphic Walker直接传递数据源，这样就无需单独为gw适配您自己的数据源类型，而是直接与当前的系统集成。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/upload_data.png)


当数据准备好后，点击确认按钮。进入分析界面。在分析界面的左侧，字段列表中列出来所有的可选字段类型，这些字段都来源于数据源中的列。你可以通过简单的拖拉拽来将他们拖入你想要的视觉通道中（如行、列、颜色、大小等）来通过可视化的方式分析他们。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/after_load_data.png)


通过简单的拖拉拽来快速可视化你的数据并进行分析，对于度量，你可以自由的选择适合的聚合类型（如求和、平均等）。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-barchart-01.png)

你可以调整标记类型来尝试不同的展示形式，如折线图等。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-line-02.png)


如果你想比对多个不同的度量，你可以将他们都拖到行或列中来创建拼接视图。这种视图可以将不同的度量平行的展示来获得更清晰的视觉比对。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-area-01.png)


你也可以为一张图表拖入额外的维度作为行或列，这样可以生成分面视图：根据维度的不同成员值将视图划分为若干的子视图，以方便更清晰的比对不同维度成员的表现情况。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-scatter-01.png)

当你完成探索，可以选择将结果导出到文件，这样你下次在分析时，可以快速的导入之前分析的结果。

## 部署


如果你想将graphic-walker作为分析工具直接使用，那可以使用我们为你构建好的在线版本。[点击这里](https://graphic-walker.kanaries.net)

如果你是一位工程师，想要继承graphic-walker，可以根据情况选择适合你的方式
### 方法一：作为独立应用使用

按照应用的构建步骤依次执行。

```bash
yarn install

yarn workspace @kanaries/graphic-walker build:app
```

###  方法二：作为嵌入模块使用

`graphic-walker`提供了非常简单易用的集成方式，你只需要像引入react组件一样，将其引入，即可立即开始使用。

```bash
yarn add @kanaries/graphic-walker

# or

npm i --save @kanaries/graphic-walker
```

In your app:
```typescript
import { GraphicWalker } from '@kanaries/graphic-walker';

const YourEmbeddingTableauStyleApp: React.FC = props => {
    const { dataSource, fields } = props;
    return <GraphicWalker
        dataSource={dataSource}
        rawFields={fields}
        spec={graphicWalkerSpec}
        i18nLang={langStore.lang}
    />
}

export default YourEmbeddingTableauStyleApp;
```

### 本地测试
```bash
# packages/graphic-walker
npm run dev
```


## I18n 多语言支持

GraphicWalker now support _English_ (as `"en"` or `"en-US"`) and _Chinese_ (as `"zh"` or `"zh-CN"`) with built-in locale resources. You can simply provide a valid string value (enumerated above) as `props.i18nLang` to set a language or synchronize your global i18n language with the component like the example given as follow.

```typescript
const YourApp = props => {
    // ...

    const curLang = /* get your i18n language */;

    return <GraphicWalker
        dataSource={dataSource}
        rawFields={fields}
        i18nLang={curLang}
    />
}
```

### Customize I18n

If you need i18n support to cover languages not supported currently, or to totally rewrite the content of any built-in resource(s), you can also provide your resource(s) as `props.i18nResources` to GraphicWalker like this.

```typescript
const yourResources = {
    'de-DE': {
        'key': 'value',
        ...
    },
    'fr-FR': {
        ...
    },
};

const YourApp = props => {
    // ...

    const curLang = /* get your i18n language */;

    return <GraphicWalker
        dataSource={dataSource}
        rawFields={fields}
        i18nLang={curLang}
        i18nResources={yourResources}
    />
}
```

GraphicWalker uses `react-i18next` to support i18n, which is based on `i18next`, so your translation resources should follow [this format](https://www.i18next.com/misc/json-format). You can simply fork and edit `/locales/en-US.json` to start your translation.
