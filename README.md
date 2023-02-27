<img src="https://ch-resources.oss-cn-shanghai.aliyuncs.com/images/lang-icons/icon128px.png" width="22px" /> English | [简体中文](./README.zh-CN.md) | [日本語](./README.ja-JP.md)

# graphic-walker
![](https://img.shields.io/github/license/Kanaries/graphic-walker?style=flat-square)
![](https://img.shields.io/npm/v/@kanaries/graphic-walker?style=flat-square)
![](https://img.shields.io/github/actions/workflow/status/kanaries/graphic-walker/auto-build.yml?style=flat-square)
[![](https://img.shields.io/badge/twitter-kanaries_data-03A9F4?style=flat-square&logo=twitter)](https://twitter.com/kanaries_data)
[![](https://img.shields.io/discord/987366424634884096?color=%237289da&label=Discord&logo=discord&logoColor=white&style=flat-square)](https://discord.gg/WWHraZ8SeV)
[![](https://img.shields.io/badge/YouTube-red?style=flat-square&logo=youtube&logoColor=white)](https://www.youtube.com/@kanaries_data)
[![](https://img.shields.io/badge/Medium-grey?style=flat-square&logo=medium&logoColor=white)](https://medium.com/@observedobserver)
[![](https://img.shields.io/badge/LinkedIn-blue?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/kanaries-data/)

Graphic Walker is a different type of open-source alternative to Tableau. It allows data scientists to analyze data and visualize patterns with simple drag-and-drop operations. 

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-dark-scatter.png)

### Why is it different?

It is extremely easy to embed in your apps just as a React component 🎉! The original purpose of graphic-walker is not to be a heavy BI platform, but a easy to embed, lite, plugin.

### Main features
+ A user friendly drag and drop based interaction for exploratory data analysis with visualizations.
+ A grammar of graphics based visual analytic user interface where users can build visualizations from low-level visual channel encodings. (based on [vega-lite](https://vega.github.io/vega-lite/))
+ A Data Explainer which explains why some patterns occur / what may cause them (like salesforce einstein).
+ Using web workers to handle computational tasks which allow you to use it as a pure front-end app.
+ Graphic Walker now supports Dark Theme! 🤩

> Graphic Walker is a lite visual analytic component. If you are interested in more advanced data analysis software, check our related project [RATH](https://github.com/Kanaries/Rath), an augmented analytic BI with automated insight discovery, causal analysis and visualization auto generation based on human's visual perception.

## Usage

First, upload your CSV file, preview your data, and define the analytic type of columns (dimension or measure).

> We are developing more types of data sources. You are welcome to raise an issue telling us the types of sources you are using. If you are a developer, graphic-walker can be used as an embedding component, and you can pass your parsed data source to it. For example, [Rath](https://github.com/Kanaries/Rath) uses graphic-walker as an embedding components, and it supports many common data sources. You can load your data in [Rath](https://github.com/Kanaries/Rath)  and bring the data into graphic-walker. In this way, users can also benefit from data cleaning and transformation features in [Rath](https://github.com/Kanaries/Rath).

![graphic walker dataset upload](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-ds-02.png)

When the data is ready, click the 'Submit' button to use the data. On the left-hand side, `Field List` is all of your original columns in the table. You can drag them into visual channels (rows, columns, color, opacity, etc.) and make visualizations.

![](https://foghorn-assets.oss-cn-hangzhou.aliyuncs.com/graphic-walker/doc_images/after_load_data.png)

You can also view raw data any time or edit the meta data.

![](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/dark-theme-gw-data.png)


Visualize your data with drag and drop operation. For measures, you can define the aggregation methods (sum, mean, count etc.)

![graphic walker bar chart](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-bar-01.png)


You can change the mark type into others to make different charts, for example a line chart.

![graphic walker line chart](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-line-01.png)


To compare different measures, you can create a concat view by adding more than one measure into rows/columns.

![graphic walker area chart](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-area-01.png)

To make a facet view of several subviews divided by the value in dimension, put dimensions into rows or columns to make a facets view. The rules are similar to Tableau.

![graphic walker scatter chart](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/gw-scatter-01.png)

When you finish exploration, you can save the result into a local file, which can be imported next time.

Sometimes you may have further questions, such as why sales in Dec. is high. Graphic Walker provides a data explainer for these cases.

For example, in bike sharing dataset, ask why registered rents in Jan. is lower than expectation, the explainer will try to find some potential explanations: 

![graphic walker explain data button](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/explain-data-start.png)

(percent of number of working days is less than average)

![graphic walker explain data result](https://docs-us.oss-us-west-1.aliyuncs.com/images/graphic-walker/explain-data-result.png)

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

## Share with Open Source Community
> Please consider sharing your experience or thoughts about [graphic walker](https://github.com/Kanaries/graphic-walker) with the border Open Source community If you like this project.

[![GitHub Repo stars](https://img.shields.io/badge/share%20on-twitter-03A9F4?style=flat-square&logo=twitter)](https://twitter.com/share?url=https://github.com/Kanaries/graphic-walker&text=Graphic-Walker:%20A%20different%20type%20of%20open-source%20alternative%20to%20Tableau)
[![GitHub Repo stars](https://img.shields.io/badge/share%20on-facebook-1976D2?style=flat-square&logo=facebook)](https://www.facebook.com/sharer/sharer.php?u=https://github.com/Kanaries/graphic-walker)
[![GitHub Repo stars](https://img.shields.io/badge/share%20on-linkedin-3949AB?style=flat-square&logo=linkedin)](https://www.linkedin.com/shareArticle?url=https://github.com/Kanaries/graphic-walker&title=Graphic-Walker:%20A%20different%20type%20of%20open-source%20alternative%20to%20Tableau)
[![GitHub Repo stars](https://img.shields.io/badge/share%20on-hacker%20news-orange?style=flat-square&logo=ycombinator)](https://news.ycombinator.com/submitlink?u=https://github.com/Kanaries/graphic-walker)
[![GitHub Repo stars](https://img.shields.io/badge/share%20on-reddit-red?style=flat-square&logo=reddit)](https://reddit.com/submit?url=https://github.com/Kanaries/graphic-walker&title=Graphic-Walker:%20A%20different%20type%20of%20open-source%20alternative%20to%20Tableau)


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

## API

Graphic Walker Props interface

```ts
export interface IGWProps {
	dataSource?: IRow[];
	rawFields?: IMutField[];
	spec?: Specification;
	hideDataSourceConfig?: boolean;
	i18nLang?: string;
	i18nResources?: { [lang: string]: Record<string, string | any> };
	keepAlive?: boolean;
}
```

property description

+ `dataSource`, type `Array<{[key: string]: any}>`, array of key-value object data.
+ `rawFields`, type [IMutField](./packages/graphic-walker/src/interfaces.ts).  array of fields(columns) of the data.
+ `spec`, type [Specification](./packages/graphic-walker/src/interfaces.ts). visualization specification
+ `hideDataSourceConfig` at the top of graphic walker, you can import or upload dataset files. If you want to use graphic-walker as a controlled component, you can hide those component by setting this prop to `true`
+ `i18nLang`, type `string`. lang label
+ `i18nResources` custom lang config
+ `keepAlive`, type `boolean`. whether to keep the component state when it is unmounted. If `true`, after you unmount the graphic-walker component, the state will still be store, and will be restore when the component is mount again.

## What's next

Graphic Walker is basically manual data exploration software. When facing more complex datasets, manual exploration can cost a lot of time, [Rath](https://github.com/Kanaries/Rath) is software providing a different data analysis experience with automation enhancement.

## LICENSE

Please refer to [LICENSE](./LICENSE) file.
