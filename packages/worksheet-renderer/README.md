# Worksheet renderer

`@kanaries/worksheet-renderer` 是 Graphic Walker monorepo 中的自有工作表渲染库。它读取已经准备好的记录，负责成员表头、pane 布局、比例尺、图形几何和 Canvas/SVG 绘制。它不执行聚合、过滤、SQL、计算表达式或查询规划。

2026-11-06 状态：S0 候选已通过提交门禁，独立 [Sol 代码复审](../../docs/verification/s0/code-review.md) 和 [Terra 浏览器复验](../../docs/verification/s0/browser-acceptance.md) 均为 PASS，58 项测试通过。浏览器覆盖 Chromium 和 Playwright WebKit；后者不等同于 Safari 发布版，Firefox 因缺少本地缓存未验收。当前不是首版发布。批准的首版范围仍是全部 [R01–R17、A01–A16、B1–B5](../../docs/worksheet-renderer-requirements.md)，进展见 [实施记录](../../docs/worksheet-renderer-implementation.md)。[技术设计 v0.4](../../docs/worksheet-renderer-design.md) 和 [alignment v0.4](../../docs/worksheet-renderer-alignment.md) 是实施依据。

## 构建与预览

在已安装依赖的仓库根目录执行，Node.js 要求为 20 或更高版本：

```sh
yarn workspace @kanaries/worksheet-renderer typecheck
yarn workspace @kanaries/worksheet-renderer test
yarn workspace @kanaries/worksheet-renderer build
yarn workspace @kanaries/worksheet-renderer dev
```

`build` 生成 `dist/index.js`、source map 和 TypeScript 声明；包根入口导出 ESM。`test` 用 esbuild 打包 `tests/*.test.ts`，再通过 `node --test` 运行。`dev` 启动默认地址 `http://127.0.0.1:4178/`，可用 `PORT` 覆盖端口。

预览页有 U1 嵌套工作表、程序化超长窗口供数、Canvas/SVG 切换、首尾跳转和视口 SVG 下载。超长例子按需生成非空记录，用于核对滚动坐标和窗口读取；它不是 B3 的百万条真实输入记录基准。浏览器实测范围见 [S0 验收记录](../../docs/verification/s0/browser-acceptance.md)。

包根入口不导入 React、GW store、计算执行器、Vega 或 Plot。当前没有 `/react` 入口；React 封装和真实发布包消费验收仍在后续阶段。

## 独立接入

宿主先给容器一个实际尺寸，例如：

```html
<div id="worksheet" style="width: 100%; height: 600px"></div>
```

以下代码使用当前已经导出的 API，可用于 monorepo 内经过构建的包消费。`RenderPlan` 是库的临时显示参数；GW 用户继续保存 IChart，不需要编写或持久化这个对象。

```ts
import {
    createPreparedDataSource,
    createWorksheet,
    type RenderPlan,
} from '@kanaries/worksheet-renderer';

const records = [
    { id: 'east-chair', region: 'East', product: 'Chair', sales: 120 },
    { id: 'east-paper', region: 'East', product: 'Paper', sales: 35 },
    { id: 'west-chair', region: 'West', product: 'Chair', sales: -20 },
];

const plan: RenderPlan = {
    bindings: [
        {
            bindingId: 'region-column', fieldRef: 'region', columnKey: 'region',
            valueType: 'string', positionType: 'band', label: 'Region',
        },
        {
            bindingId: 'product-column', fieldRef: 'product', columnKey: 'product',
            valueType: 'string', positionType: 'band', label: 'Product',
        },
        {
            bindingId: 'sales-column', fieldRef: 'sales', columnKey: 'sales',
            valueType: 'number', positionType: 'linear',
            analyticType: 'measure', label: 'Sales',
        },
    ],
    rows: { facets: ['region'], positions: ['product'] },
    columns: { facets: [], positions: ['sales'] },
    mark: 'bar',
    barOrientation: 'horizontal',
    stack: 'none',
    domainPlanKey: 'sales-bars-v1',
    scales: { sales: { zero: true, scope: { mode: 'shared' } } },
    style: { color: '#2563eb', background: '#ffffff' },
};

const source = createPreparedDataSource({
    version: {
        sourceId: 'sales-results',
        snapshotId: 'results-1',
        presentationId: 'display-1',
    },
    plan,
    records,
    getDatumKey: (record) => String(record.id),
    identityScope: 'stable',
});

const host = document.querySelector<HTMLElement>('#worksheet')!;
const view = createWorksheet(host, { plan, source, backend: 'canvas' });
const unsubscribe = view.on('selectionChange', ({ targets }) => {
    console.log(targets.map(({ paneKey, datumKey, values }) => ({
        paneKey, datumKey, values,
    })));
});

const receipt = await view.ready;
if (receipt.status !== 'committed') throw new Error('Worksheet did not commit');

// Reuse the same source and plan when switching the drawing backend.
await view.update({ plan, source, backend: 'svg' });
const svgText = await view.export({ format: 'svg' });
console.log(svgText);

// Call these when the host removes the worksheet.
unsubscribe();
view.dispose();
```

`createPreparedDataSource` 不更改输入值，也不合并重复记录。一个记录可出现在多个度量槽中，但保留同一 `datumKey`。宿主应提供跨排序稳定的记录键；省略 `getDatumKey` 时只提供 `snapshot` 范围身份，不代表跨查询选择已经稳定。成员路径使用带类型的编码，区分 `null`、字符串、数字、布尔和明确的时间值。

`valueType: 'time'` 要求已经准备好的有限 epoch 数值，且在 JavaScript Date 范围内。时间字符串处理、时区和业务计算仍由宿主完成。若绑定声明了 `rawColumnKey`，本 pane 的记录必须同时包含该原值列；原值可为 `null`。

每个 source 固定一份 `ReadVersion`。结果变化时换 `snapshotId`，绑定、成员顺序、拓扑或域计划变化时换 `presentationId`，并创建新的 source。不能在同一个 source 上悄悄切换版本。`domainPlanKey` 标识当前 mark、堆叠和域解释；改变这些语义时也需要更新它。

## 当前控制器 API

这些是 S0 的实际接口，与设计文档中的完整控制器合同尚有差距。

| 成员 | 当前行为 |
| --- | --- |
| `createWorksheet(host, { plan, source, backend? })` | 创建一个控制器，默认 Canvas；版本取自 `source.version` |
| `ready` | 首次更新的 Promise，返回 `committed/superseded/rejected/disposed` receipt |
| `update({ plan, source, backend? })` | 异步替换输入，返回 `inputRevision/status/frameId?` |
| `on('ready' / 'selectionChange' / 'diagnostic', handler)` | 返回退订函数；当前选择目标为带 pane/datum 身份的命中记录 |
| `scrollToPosition({ x?, y? })` | 按逻辑像素移动；由运行时夹取合法范围 |
| `scrollTo({ rowKey?, columnKey? })` | 调用 source 的 `locate`，按稳定叶 key 定位 |
| `getViewState()` | 提供当前偏移、加载状态、已提交 Scene、manifest、选择和缓存窗口数，供 S0 宿主与验证使用 |
| `export({ format: 'svg' / 'png' })` | 仅导出完整已提交视口；分别返回 SVG 字符串和 PNG data URL；加载中或失败时拒绝 |
| `dispose()` | 幂等移除 DOM、监听、观察器、请求、绘制资源和缓存 |

容器尺寸由 `ResizeObserver` 读取。当前没有公开 `resize`、`focus`、`setSelection`、受控排序/折叠、范围导出、分页导出或导出取消接口。事件也尚未实现设计中完整的 `inputRevision/version/frameId` 协议。

## 外部窗口供数

可以用自行实现的 `RenderDataSource` 替代 `createPreparedDataSource`。当前合同在 [core/types.ts](src/core/types.ts)，实际例子在 [demo/main.ts](demo/main.ts)。请求只有版本、轴范围、逻辑矩形、稳定 key 和字段域，不携带聚合、过滤或 SQL 计划。

| 方法 | 当前 S0 要求 |
| --- | --- |
| `describe(signal)` | 返回同版本 manifest、准确叶数和当前 `domainPlanKey` |
| `readAxis({ version, axis, range }, signal)` | 返回完整半开区间、连续 rank、canonical 叶 key、typed path、slot 和全部可见祖先跨度 |
| `readPaneData({ version, windows }, signal)` | 返回本窗口非空 pane、准确覆盖矩形和完整记录；空组合不需要生成 pane 对象 |
| `readDomains({ version, fieldRefs }, signal)` | 返回完整作用域域；堆叠值域包含正负累计端点，或提供明确 fixed 域 |
| `locate({ version, axis, key, path? }, signal)` | 返回同版本 found/rank/leaf 或 missing；已准备 source 尚不实现折叠 hidden 状态 |

库导出的 `axisLeafKey`、`headerKey`、`paneKey`、`toTypedValue` 等 helper 用于一致的身份编码。外部 source 必须保持同一 rank、key、path、slot 与记录绑定相互一致。

S0 提交前会检查 manifest、轴、pane 和 domain 的版本、完整性、覆盖和身份，也会校验本 pane 所用列的存在性、连续值类型、时间范围和分面归属。`complete: false` 的已准备 source 可用于读取协议测试，但当前控制器明确拒绝预览、部分 pane、续页或未覆盖窗口，不能把它们当成完整图表或导出。后续阶段需要实现这些状态的调度与展示。

## S0 能力与限制

| 当前可用 | 仍需完成 |
| --- | --- |
| bar、point；bar 重叠和正负零点堆叠 | line、rect、text、分组柱、区间几何 |
| 实际嵌套成员、并列度量槽、typed key、空交叉槽 | 受控折叠与排序请求、完整锚点恢复和不等长层级布局 |
| band/linear/time、共享域、明确固定域与端点、zero/reverse | pane/prefix 域、nice、自定义 range、格式、统一图例 |
| 常量色或单个离散颜色字段、给定 details 身份 | 连续颜色、size/opacity/shape/text 通道及完整系列语义 |
| 单 Canvas、SVG 共用 Scene、冻结头、双轴窗口、超长逻辑坐标 | 严格字节预算、请求合并/去重、完整并发调度、正式性能验收 |
| 点击、修饰键多选、空白清除、后端切换保持选择 | tooltip、视口框选、完整受控选择、键盘焦点和按需可访问数据 |
| PNG/SVG 视口导出 | 未访问逻辑范围、分页、取消、导出内存预算 |
| GW IChart 纯 adapter 和 fixtures | 产品 renderer 路由、保存/导入/undo/redo、旧后端回归 |

S0 独立包会拒绝当前不支持的 mark、通道、scope、轴选项和样式配置。仅 `style.color/background` 已进入当前静态样式范围。不要因为 TypeScript 类型预留了某个选项，就假定运行时已支持。

当前临时容量边界是：完整输入最多 16,000,000 个记录到度量槽的索引条目，单次轴读取最多 100,000 叶位置，单次 pane 请求最多 64 个窗口，控制器每个读取窗口最多 20,000 条槽位记录，缓存最多 8 个窗口。缓存目前按窗口数量限制，未完成设计中的字节预算和统一导出预算。Canvas 有效 DPR 限制在 0.5 至 2，位图随视口分配。这些实现参数不证明 B2/B3/B5 的性能和内存目标已经达成。

## GW 适配状态与后续阶段

[GW adapter](../graphic-walker/src/lib/native/adapter.ts) 提供 `adaptChartToRenderPlan(chart, { columns })`，返回 `{ plan?, diagnostics, fieldRefs }`。它用既有 `getMeaAggKey` 绑定宿主声明的结果列，保持 IChart 不变，不调用 `toVegaSpec`。当前 demo 消费这个纯 adapter；产品中的 `layout.renderer: 'native'` 路由尚未接入，不能据此宣称 GW 已经完成切换、保存或历史兼容。

S1 补齐五种 mark、布局/域/图例、受控顺序折叠与统一交互。S2 完成窗口调度与内存预算、范围/分页导出以及 B1–B5 和生命周期验证。S3 接入 GW 的 renderer、输入、存储、历史和公开事件/ref，验证既有后端及局部兼容。最终发布条件仍以批准的需求文档为准。
