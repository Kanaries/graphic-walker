# Worksheet renderer

`@kanaries/worksheet-renderer` 是 Graphic Walker monorepo 中的自有工作表渲染库。它读取已经准备好的记录，负责成员表头、pane 布局、比例尺、图形几何和 Canvas/SVG 绘制。它不执行聚合、过滤、SQL、计算表达式或查询规划。

2026-11-06 状态：S0 已提交为 `feat(worksheet): establish native rendering and window contracts`。S1 已实现下述能力，候选已通过提交门禁，126 项测试、严格类型检查、构建和 diff 检查通过，独立 Sol 代码复审及 Terra 浏览器复验均为 PASS。所有阶段进入同一个 [draft PR #528](https://github.com/Kanaries/graphic-walker/pull/528)，当前不是首版发布。

批准范围仍是全部 [R01–R17、A01–A16、B1–B5](../../docs/worksheet-renderer-requirements.md)，进展见 [实施记录](../../docs/worksheet-renderer-implementation.md)。[技术设计 v0.4](../../docs/worksheet-renderer-design.md) 和 [alignment v0.4](../../docs/worksheet-renderer-alignment.md) 是实施依据。S0 的 [代码复审](../../docs/verification/s0/code-review.md) 和 [浏览器验收](../../docs/verification/s0/browser-acceptance.md) 均已通过；S1 的 [代码复审](../../docs/verification/s1/code-review.md) 和 [浏览器验收](../../docs/verification/s1/browser-acceptance.md) 也已通过。浏览器覆盖 Chromium 全面验收与 Playwright WebKit smoke，未代替正式 Safari/Firefox 验收。

## 构建与预览

在已安装依赖的仓库根目录执行，Node.js 要求为 20 或更高版本：

```sh
yarn workspace @kanaries/worksheet-renderer typecheck
yarn workspace @kanaries/worksheet-renderer test
yarn workspace @kanaries/worksheet-renderer build
yarn workspace @kanaries/worksheet-renderer dev
```

`build` 生成根入口、独立 `react.js` 入口、共享 ESM chunk、source map 和 TypeScript 声明。`test` 用 esbuild 打包 `tests/*.test.ts`，再通过 `node --test` 运行。`dev` 启动默认地址 `http://127.0.0.1:4178/`，可用 `PORT` 覆盖端口。

预览页包含 U1 嵌套工作表、五种 mark、分组/堆叠/区间柱、八层表头、作用域比较、受控双轴折叠与排序，以及程序化超长窗口供数。Domains 示例每个 Region 有 Local/Metro 两个不同值域的 pane，可区分 shared、prefix 和 pane。受控示例等待 host 550 ms 确认，父级用明确给定的常量；缺父级记录的槽位保持空白。超长例子用于核对坐标和窗口读取，不是 B3 的百万条真实输入基准。

包根入口不导入 React、GW store、计算执行器、Vega 或 Plot。内部只使用 `d3-format`、`d3-time-format` 做数值与 UTC 日期格式化；它们不是整图渲染器。`@kanaries/worksheet-renderer/react` 单独导出 React 组件，React 是可选 peer dependency。

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
    console.log(targets.map(({ kind, paneKey, datumKeys, values, hitPoint }) => ({
        kind, paneKey, datumKeys, values, hitPoint,
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

精确类型见 [runtime/types.ts](src/runtime/types.ts)。`WorksheetInput` 接受 `plan/source/backend?`、可选的匹配 `version`、`viewState` 与 `requestResults`。`createWorksheet` 的第三个参数是实例选项。

| 成员 | 当前行为 |
| --- | --- |
| `createWorksheet(host, input, options?)` | 默认 Canvas、自动观察容器尺寸；可配置 `autoResize`、`width/height/dpr`、`accessibleName`、`metrics`、`requestTimeoutMs` |
| `ready` / `update(input)` | 返回 `inputRevision/status/frameId?` receipt；状态为 `committed/superseded/rejected/disposed` |
| `on(name, handler)` | 订阅 ready、selectionChange、collapseRequest、sortRequest、requestStateChange、viewStateChange、loadStateChange、diagnostic、metrics；返回退订函数 |
| `scrollToPosition({ x?, y? })` | 按逻辑像素移动并夹取合法范围 |
| `scrollTo({ rowKey?, columnKey?, align? })` | 校验 source 的 locate 结果后定位；支持 `start/center/end/nearest`，隐藏成员定位到可见祖先 |
| `focus({ markId?, headerKey?, rowKey?, columnKey? })` | 按需定位后聚焦可见 mark 或表头；未找到可见目标返回 pending |
| `setSelection(targets)` | 设置结构化选择；当前不可见的目标保留 pending，进入窗口后重新验证 |
| `requestCollapse(target, expanded)` / `requestSort(target, direction)` | 产生受控请求及请求 ID；`direction` 为 ascending/descending |
| `rejectRequest(requestId, reason)` | 宿主明确拒绝当前 pending 请求 |
| `resize({ width, height, dpr? })` | 仅在 `autoResize: false` 时手动调整尺寸；自动模式使用 ResizeObserver 和 DPR 变化监听 |
| `getViewState()` | 返回深只读状态快照，含选择、pending 请求、版本、目标滚动与已显示画面 |
| `export({ format: 'svg' / 'png' })` | 仅导出完整已提交视口，返回 SVG 字符串或 PNG data URL；加载、错误或已销毁时拒绝 |
| `dispose()` | 幂等清理 DOM、监听、观察器、请求、绘制资源与缓存 |

事件通过 microtask 在当前状态事务完成后通知宿主，提交事件不会在半完成的 commit 中重入。除允许部分上下文的 diagnostic 外，事件带 `inputRevision/version/frameId`；loadStateChange 另含 `requestedVersion`。事件载荷与 `getViewState()` 是只读快照，不能用于修改运行时状态。

`getViewState().requestedVersion` 标识当前请求输入；`committedVersion/committedInputRevision` 标识最后成功提交。`displayedFrame/displayedScroll` 描述仍在屏幕上的已提交画面，`targetScroll` 描述目标偏移。加载或错误时，交互用 `frame` 不可用，即使保留了旧显示画面；失败候选不会覆盖已提交选择，也不能用旧画面冒充新结果导出。

选择目标使用 `kind: 'datum' | 'segment'`、`markId/paneKey/slotId`、`datumKeys[]`、可选 `seriesKey/rowKey/columnKey`，以及逐字段的 `{ fieldRef, value, raw, datumKey? }`。折线段选择包含两个端点身份，指针命中还带当前画面 CSS 像素坐标 `hitPoint`。库保留精确目标，不把多个 tuple 展开成维度笛卡尔积或查询谓词。受控输入可用 `viewState.selection/focus/scroll`；selectionChange 同时说明 operation 与 pointer/keyboard/input 来源。

指针支持 tooltip、点击、修饰键多选、空白清除，以及 Shift 拖动的可见区域框选。语义焦点代理支持方向键、Home/End、H 切换表头、Enter 激活、S 请求排序和 Escape；按需 Visible data 面板每页最多 100 个可见项，不为整张表创建逐格 DOM。完整屏幕阅读器与浏览器矩阵验收仍待完成。

## 受控顺序与折叠

`collapseRequest/sortRequest` 包含 `requestId/basePresentationId/target/kind/intent`。宿主准备新显示状态后调用 `update`，同时提交匹配的 `requestResults: [{ requestId, status: 'accepted' }]`；拒绝可提交 rejected 与 reason，或调用 `rejectRequest`。默认超时是 10,000 ms，可由实例选项覆盖。请求经历 pending、accepted、rejected、superseded 或 expired；仅发出请求不会在库内执行排序查询或生成父级汇总。

已准备 source 用 `memberOrder` 指定逐父成员顺序，用 `axisMembers` 指定当前可见路径，用 `getRecordPath` 声明记录的实际层级。可见父叶只读取与其路径完全匹配的现成父记录。隐藏子记录既不成为父值，也不参与父级域；没有父记录时保留完整空覆盖。两轴支持不等深叶。示例见 [demo/controlled.ts](demo/controlled.ts)，它保持 sourceId 与 snapshotId，只随折叠、展开和排序递增 presentationId。

## React 独立入口

```tsx
import { Worksheet } from '@kanaries/worksheet-renderer/react';

<Worksheet
    input={{ plan, source, backend: 'canvas' }}
    style={{ height: 600 }}
    onSelectionChange={(event) => console.log(event.targets)}
    onController={(controller) => console.log(controller)}
/>;
```

组件管理一个控制器的创建、输入更新和销毁；mark 不进入 React 树。支持 `onReady/onSelectionChange/onDiagnostic/onViewStateChange/onController`，其他事件可由控制器订阅；ref 的 `getController()` 返回当前控制器。改变实例 options 会重建控制器。根入口消费不需要加载 React；外部 strict NodeNext 消费、原生 Node ESM 导入及 pack dry-run 已通过；尚未发布包，React 真实宿主生命周期仍需后续验收。

## 外部窗口供数

可以自行实现 `RenderDataSource`。合同见 [core/types.ts](src/core/types.ts)，程序化例子见 [demo/main.ts](demo/main.ts)。请求只有版本、轴范围、逻辑矩形、稳定 key 和域身份，不携带聚合、过滤或 SQL 计划。

| 方法 | 当前要求 |
| --- | --- |
| `describe(signal)` | 同版本 manifest、准确叶数、identityScope 与当前 domainPlanKey |
| `readAxis({ version, axis, range }, signal)` | 完整半开区间、连续 rank、canonical key/typed path/slot、实际祖先跨度；并列度量遵循计划字段顺序 |
| `readPaneData({ version, windows }, signal)` | 返回非空 pane、完整记录和准确 coveredWindows；已覆盖空组合无需 pane 对象 |
| `readDomains({ version, fieldRefs, keys? }, signal)` | shared 域用 fieldRef，prefix/pane 位置域用 canonical DomainKey；返回完整作用域及需要的完整 joint series 元数据 |
| `locate({ version, axis, key, path? }, signal)` | 同版本 found/rank/leaf、hidden/ancestor 或 missing；found 必须匹配请求 key，hidden 必须是该路径的合法可见祖先 |

`domainRequestForWindow/domainKeyFor/domainStorageKey/getDisplayDomain` 统一请求与读取作用域，`axisLeafKey/headerKey/paneKey/toTypedValue` 统一身份。position scope 只作用于 x/y；即使同一字段也用于 color，颜色仍用 shared 域。完整固定 domain 或双固定数值端点可直接生成完整 fixed 域，不依赖源统计；只固定一端仍需要完整统计域。全部必需域均为 fixed 且 mark 不消费完整 series 时，运行时可跳过 readDomains；line、分组柱和零点堆叠仍须读取完整 series 元数据。

line、分组柱和零点堆叠使用完整 joint series 顺序。source 提供 `seriesKey/seriesOrdinal`、`seriesCount` 和完整 `DomainBatch.series`；完整输入 helper 自动准备这些元数据。`getOrdinal/seriesOrder/getSequenceOrder` 分别控制稳定记录序、完整系列顺序及折线序列；显式 sequenceOrder 必须覆盖该序列全部记录。所有排序仅改变显示，不合并记录。

提交前校验版本、覆盖、域完整性、rank/key/slot/路径、本 pane 所用列、raw 列、数值/时间/区间类型和分面归属。库仍只提交完整窗口：preview、部分 pane、nextCursor、缺失统计域或缺覆盖明确拒绝。`complete: false` 可做协议测试，但尚未实现预览和补页调度。

## S1 显示能力与边界

| 范围 | 已实现的子集 |
| --- | --- |
| mark | bar、point、line、rect、text；分组柱、正负零点堆叠、给定端点区间柱；折线不跨 pane/series，null 断线；rect/text 使用 band 单元或默认单元 |
| 位置与域 | band/linear/time；shared、prefix、pane、fixed；zero/nice/reverse、明确端点和静态 range；域取完整作用域，不按视口重算 |
| 通道 | 分类/连续 color、opacity；point 的面积 size 与离散 shape；line 的线宽 size；text 的给定文本值；details 参与系列身份 |
| 通道限制 | line 颜色必须常量或分类，size/opacity 在同一 series 内恒定；shape 仅 point，size 仅 point/line，text 仅 text mark；不支持的组合明确诊断 |
| 轴与图例 | title、format、grid、tickCount、hidden；颜色、大小、透明度、形状图例与 mark 共用编码域；接受明确的数字/UTC 时间格式子集，如 `,.1f`、`.2s`、`%Y-%m` |
| 静态样式 | color、background、palette、opacity、pointSize、lineWidth、barWidth、fontFamily、fontSize；共同测量、截断、clip 与焦点/选择绘制 |
| 布局与交互 | 实际成员树、并列度量槽、不等深可见叶、冻结头、双轴窗口、受控折叠/排序、tooltip、选择、框选和键盘焦点 |

`valueType: 'interval'` 使用宿主给定的两个有序有限端点，并明确对应 linear/time 位置；库不执行 bin 或 timeUnit。point 支持 circle、square、diamond、triangle-up、triangle-down、cross。未实现的多标记层、极坐标、交互缩放等不会静默模拟，准确准入以 [capabilities.ts](src/core/capabilities.ts) 为准。

完整输入最多 16,000,000 个记录到度量槽的索引条目；单次轴读取最多 100,000 叶、pane 请求最多 64 个窗口。控制器每窗口最多 20,000 条槽位记录，缓存最多 8 个窗口。SVG 限制 5,000 hits 和 10,000 元素预算，含 clip 定义；Canvas 有效 DPR 限制在 0.5 至 2，位图随视口分配。这些限制不证明 B2/B3/B5 的性能与内存目标已通过。

## GW 适配与后续阶段

[GW adapter](../graphic-walker/src/lib/native/adapter.ts) 的 `adaptChartToRenderPlan(chart, input)` 返回 `{ plan?, diagnostics, fieldRefs }`，以 `columns` 声明宿主结果列，复用 getMeaAggKey，不改变 IChart、不调用 toVegaSpec。展示参数支持 theme、host scales/resolvedScales 与 layout，显式 layout 覆盖 host，host 覆盖 theme。函数 scales 仅对完整已准备结果解析并缓存；windowed 宿主须提供静态 resolvedScales。

S1 候选已通过提交门禁。S2 尚需 preview/分页供数、范围/分页导出与取消、字节缓存预算、范围合并/去重/并发调度、正式 B1–B5 及生命周期报告。windowed 固定步长布局属于设计允许的基线，不把可变条带作为额外首版门槛。

S3 尚未接入产品的 native renderer 路由、字段正规化、保存/导入/undo/redo、公开 ref/callback 和旧后端兼容。当前 demo 消费纯 adapter，不能代表 GW 产品集成或首版发布完成。最终关闭条件仍是全部批准的 R/A/B 项与发布消费验证。
