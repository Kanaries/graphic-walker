<img src="https://ch-resources.oss-cn-shanghai.aliyuncs.com/images/lang-icons/icon128px.png" width="22px" /> English | [简体中文](./README.zh-CN.md)

# graphic-walker
![](https://img.shields.io/github/license/Kanaries/graphic-walker)
![](https://img.shields.io/npm/v/@kanaries/graphic-walker)
![](https://img.shields.io/github/actions/workflow/status/kanaries/graphic-walker/auto-build.yml)
[![](https://img.shields.io/twitter/follow/kanaries_data?style=social)](https://twitter.com/kanaries_data)
[![](https://img.shields.io/discord/987366424634884096)](https://discord.gg/WWHraZ8SeV)

Graphic Walker is a different type of open-source alternative to Tableau. It allows data scientists to analyze data and visualize patterns with simple drag-and-drop operations. 

##### Why is it different?

It is extremely easy to embed in your apps just as a React component 🎉! The original purpose of graphic-walker is not to be a heavily BI platform, but easy to embed, lite, plugin or components.

##### Main features
+ A user friendly drag and drop based interaction for exploratory data analysis with visualizations.
+ A grammar of graphics-based visual analytic user interface where users can build visualizations from low-level visual channel encodings. (based on [vega-lite](https://vega.github.io/vega-lite/))
+ A Data Explainer which explains why some patterns occur / what may cause them.
+ Using webworker to handle computational tasks which allow you to use it as a pure front-end app.

## Usage

First, upload your CSV file, preview your data, and define the analytic type of columns (dimension or measure).

> We are developing more types of data sources. You are welcome to raise an issue telling us the types of sources you are using. If you are a developer, graphic-walker can be used as an embedding component, and you can pass your parsed data source to it. For example, [Rath](https://github.com/Kanaries/Rath) uses graphic-walker as an embeding components, and it supports many common data sources. You can load your data in [Rath](https://github.com/Kanaries/Rath)  and bring the data into graphic-walker. In this way, users can also benefit from data cleaning and transformation features in [Rath](https://github.com/Kanaries/Rath).

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/upload_data.png)

When the data is ready, click the 'Submit' button to use the data. On the left-hand side, `Field List` is all of your original columns in the table. You can drag them into visual channels (rows, columns, color, opacity, etc.) and make visualizations.

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/after_load_data.png)


Visualize your data with drag and drop operation. For measures, you can define the aggregation methods (sum, mean, count etc.)

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-barchart-01.png)


You can change the mark type into others to make different charts, for example a line chart.

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-line-02.png)


To compare different measures, you can create a concat view by adding more than one measure into rows/columns.

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-area-01.png)

To make a facet view of several subviews divided by the value in dimension, put dimensions into rows or columns to make a facets view. The rules are similar to Tableau.

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/vis-scatter-01.png)

When you finish exploration, you can save the result into a local file, which can be imported next time.

Sometimes you may have futher questions, such as why sales in Dec. is high. Graphic Walker provides a data explainer for these cases.

For example, in bike sharing dataset, ask why registered rents in Jan. is lower than expectation, the explainer will try to find some potential explanations: 

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/explain-data-start.png)

(percent of number of workingday is less than average)

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/explain-data-result.png)

## Deploy

If you want to use Graphic Walker as a data exploration tool without thinking about deployment details, you can use our online out-of-the-box version.

Use it here: [Graphic Walker Online](https://graphic-walker.kanaries.net)

### Method 1: use as an independent app.
```bash
yarn install

yarn workspace @kanaries/graphic-walker build
```

### Method 2: Use as an embedding component module 🔥
Using graphic walker can be extremely easy. It provides a single React component which allows you to easily embed it in your app.

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

### try local (dev mode)
```bash
# packages/graphic-walker
npm run dev
```


## I18n Support

Graphic Walker now support _English_ (as `"en"` or `"en-US"`) and _Chinese_ (as `"zh"` or `"zh-CN"`) with built-in locale resources. You can simply provide a valid string value (enumerated above) as `props.i18nLang` to set a language or synchronize your global i18n language with the component like the following example:

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

If you need i18n support to cover languages not supported currently, or to totally rewrite the content of any built-in resource(s), you can also provide your resource(s) as `props.i18nResources` to Graphic Walker like this.

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

Graphic Walker uses `react-i18next` to support i18n, which is based on `i18next`, so your translation resources should follow [this format](https://www.i18next.com/misc/json-format). You can simply fork and edit `/locales/en-US.json` to start your translation.

## What's next

Graphic Walker is basically manual data exploration software. When facing more complex datasets, manual exploration can cost a lot of time, [Rath](https://github.com/Kanaries/Rath) is software providing a different data analysis experience with automation enhancement.

## LICENSE

Please refer to [LICENSE](./LICENSE) file.
