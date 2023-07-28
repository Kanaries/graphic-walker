<img src="https://ch-resources.oss-cn-shanghai.aliyuncs.com/images/lang-icons/icon128px.png" width="22px" /> [English](./README.md) | 简体中文 | [日本語](./README.ja-JP.md)

# graphic-walker
![](https://img.shields.io/github/license/Kanaries/graphic-walker)
![](https://img.shields.io/npm/v/@kanaries/graphic-walker)
![](https://img.shields.io/github/actions/workflow/status/kanaries/graphic-walker/auto-build.yml)


Graphic Walker 是一个非常规的tableau的开源替代，它可以帮助数据科学家或分析师们使用简单的拖拉拽操作就可以探索数据并制作可视化图表。

##### 为什么是非常规的？

因为`graphic-walker`在诞生之初并不想作为一个重型的BI系统或应用。而是作为一个轻量级的可嵌入式的插件而开发的。将他集成在自己的应用中如同安装一个插件/组件一样简单。


##### 主要特性

+ 一个简单易用的只需拖拉拽即可生成可视化的图形交互界面。
+ 一个基于图形语法的可视化搭建系统，相比于传统的基于图表的搭建工具，能够更好的支持数据分析的场景，并在可视化探索中更加灵活。
+ 一个提供数据中异常模式的归因解释器（tableau数据解释器/salesforce einstein）。
+ 极其简单的嵌入方式，你可以像引入一个react组件一样简单的将graphic-walker嵌入到你的应用中。
+ graphic-walker将重型计算放入web-worker中，充分利用客户端算力，使得其可以支持纯客户端部署。

> Graphic Walker 是一个轻量级的可嵌入的可视化分析组件。 如果你对更未来的数据分析工具感兴趣，可以了解我们在做的另一个开源工具 [RATH](https://github.com/Kanaries/Rath), 一个增强分析BI应用，支持全自动的数据洞察发现，因果分析和智能可视化生成。


## 使用

首先，上传你的CSV文件，预览数据，并根据需求对数据的分析类型进行调整（列属于维度还是度量）

> 我们正在开发更多的数据源支持类型，欢迎在issue中提出你希望支持的数据源类型，或参与开发贡献。如果你是一位开发者，由于Graphic Walker可以被当做嵌入系统直接使用，所以你可以通过参数传递的方式为Graphic Walker直接传递数据源，这样就无需单独为gw适配您自己的数据源类型，而是直接与当前的系统集成。

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-ds-02.png)


当数据准备好后，点击确认按钮。进入分析界面。在分析界面的左侧，字段列表中列出来所有的可选字段类型，这些字段都来源于数据源中的列。你可以通过简单的拖拉拽来将他们拖入你想要的视觉通道中（如行、列、颜色、大小等）来通过可视化的方式分析他们。

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/after_load_data.png)


通过简单的拖拉拽来快速可视化你的数据并进行分析，对于度量，你可以自由的选择适合的聚合类型（如求和、平均等）。

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-bar-01.png)

你可以调整标记类型来尝试不同的展示形式，如折线图等。

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-line-01.png)


如果你想比对多个不同的度量，你可以将他们都拖到行或列中来创建拼接视图。这种视图可以将不同的度量平行的展示来获得更清晰的视觉比对。

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-area-01.png)


你也可以为一张图表拖入额外的维度作为行或列，这样可以生成分面视图：根据维度的不同成员值将视图划分为若干的子视图，以方便更清晰的比对不同维度成员的表现情况。

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-scatter-01.png)

当你完成探索，可以选择将结果导出到文件，这样你下次在分析时，可以快速的导入之前分析的结果。

有时你可能会有更深的问题，比如为什么12月份的销量会高，等等。

下面是一个例子，在共享单车数据集中，为什么注册用户在1月份的租用量会低于预期。数据解释器会给出潜在的解释（比如一月份的假期占比高）

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/explain-data-start.png)

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/explain-data-result.png)

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

const YourEmbeddingApp: React.FC = props => {
    const { dataSource, fields } = props;
    return <GraphicWalker
        dataSource={dataSource}
        rawFields={fields}
        spec={graphicWalkerSpec}
        i18nLang={langStore.lang}
    />
}

export default YourEmbeddingApp;
```

If you have a configuration of GraphicWalker chart, you can use the `PureRenderer` component to make a single chart without controls UI.

```typescript
import { PureRenderer } from '@kanaries/graphic-walker';

const YourChart: React.FC = props => {
    const { rawData, visualState, visualConfig } = props;
    return <GraphicWalker
        rawData={rawData}
        visualState={visualState}
        visualConfig={visualConfig}
    />
}

export default YourChart;
```

### 本地测试
```bash
# packages/graphic-walker
npm run dev
```


## I18n 多语言支持

GraphicWalker 现在支持 _英语_ (as `"en"` or `"en-US"`) and _中文_ (as `"zh"` or `"zh-CN"`) 。其内置了多语言模块，你可以简单的通过一个语言参数来控制整个组件界面展示的语言`props.i18nLang`。具体实现可以参考下面的案例

```typescript
const YourApp = props => {
    // ...

    const curLang = /* 这里是你的语言标签 */;

    return <GraphicWalker
        dataSource={dataSource}
        rawFields={fields}
        i18nLang={curLang}
    />
}
```

### 自定义语言

如果你想要自定义组件的语言标签，可以按照对应的标签结构传入一个你的语言配置项`props.i18nResources`。如下所示

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

`graphic-walker` 使用了 `react-i18next`作为多语言模块，其是基于`i18next`实现的，所以建议参考其文档[格式](https://www.i18next.com/misc/json-format)。或者你也可以fork或clone此项目后，直接怼
GraphicWalker uses `react-i18next` to support i18n, which is based on `i18next`, so your translation resources `/locales/en-US.json`进行复制并修改。

## LICENSE

请参考 [LICENSE](./LICENSE) 和 [LICENSE2](./LICENSE2) 文件.
