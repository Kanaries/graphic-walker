# Graphic Walker 双层 DSL 设计评估与重构方向（归档）

> 归档日期：2026-07-06
> 内容来源：对代码库的系统性摸查（UI 层 spec 类型与 Vega-Lite 编译管线 / 计算层 Workflow 与表达式系统 / 导入导出与版本迁移机制），以及后续关于状态耦合与渐进式 DSL 的讨论。
> 状态：讨论已收敛，工程实施中。
>
> **修订 2026-07-07**：第一阶段（Workflow conformance suite）已完成并验收（分支 `feat/workflow-conformance`）。§3.3 的决策 A/B 与 §4 行动清单根据"持久化 specification 兼容性优先"的约束修订——本项目为开源项目、无真实用户数据可扫，且企业用户依赖系统导入导出的 spec 做图表持久化与 dashboard 搭建，因此 canonical/持久化层本次迭代冻结（已有字段零改动，最多纯增量添加），所有改造收敛到新增的 terse 层。

---

## 0. 总纲：编译器视角

Graphic Walker 内部的两套私有 DSL（UI 层图表 spec 与计算层 Workflow）合起来，实际上构成了一个编译器的形态：

```
（缺失的 surface syntax / authoring format）
        │
        ▼
IChart —— canonical AST（内部唯一流通形态）
        │
        ├──► Workflow（数据查询 IR）──► JS 执行器（Web Worker）
        │                            └► gw-dsl-parser ──► SQL（DuckDB / 远程数据库）
        │
        └──► Vega-Lite spec（渲染 IR）──► vega-lite / observable-plot
             （地图走 leaflet、表格走 PivotTable，绕开渲染 IR）
```

**总体结论：现有系统拥有一个相当不错的 IR 层和 codegen 层，但缺两样东西：**

1. **一个人类可写的 surface syntax**（即"渐进式 DSL"/ TerseSpec）；
2. **一份"语义由规范定义而非由实现定义"的契约**（尤其是计算层，JS 执行器与 SQL 翻译器是两个独立实现，没有仲裁者）。

两层 DSL 的结构性决策基本都是对的，问题集中在**规范化程度**上。

---

## 1. UI 层 DSL（IChart）评估

### 1.1 核心结构现状

`IChart`（`packages/graphic-walker/src/interfaces.ts:695`）：

```typescript
export interface IChart {
    visId: string;
    name?: string;
    encodings: DraggableFieldState;   // 16 个 encoding 通道 + dimensions/measures 池
    config: IVisualConfigNew;         // 语义配置：5~6 个字段
    layout: IVisualLayout;            // 渲染/主题配置：约 28 个字段
}
```

- `DraggableFieldState`（`interfaces.ts:283`）：16 个通道 —— `dimensions` / `measures`（字段池）、`rows` / `columns`、`color` / `opacity` / `size` / `shape` / `theta` / `radius`、`longitude` / `latitude` / `geoId`、`details` / `filters` / `text`。其中 rows/columns/details 数量无上限（`CHANNEL_LIMIT` 为 `Infinity`）。
- `IVisualConfigNew`（`interfaces.ts:449`）：`defaultAggregated` / `geoms` / `coordSystem` / `limit` / `folds` / `timezoneDisplayOffset`。
- `IVisualLayout`（`interfaces.ts:409`）：格式化、scale、resolve、size、geo 数据（geojson/geoUrl/geoMapTileUrl）、stack、renderer 选择等约 28 个键。
- 字段级 `IViewField extends IField`：`fid` / `name` / `aggName` / `semanticType` / `analyticType` / `sort` / `timeUnit` / `computed` / `expression` / `offset` / `basename` / `path` / `geoRole` / `cmp` / `aggergated`（最后两个为死字段，见 1.3）。
- 整体配置面：config + layout 约 33 个顶层选项，加上 16 通道和字段级选项。

### 1.2 四个设计初衷逐条检验 —— 全部在代码中兑现

| 初衷 | 结论 | 代码证据 |
|---|---|---|
| **功能扩展**（Vega-Lite 原生不支持的场景） | **成立，是这层抽象最硬的价值** | 地图完全绕开 Vega-Lite：`components/leafletRenderer/index.tsx` 的 POI / choropleth 两条路径，由 `coordSystem === 'geographic'` 触发。Facet × Repeat：`lib/vega.ts` 中 `rowRepeatFields × colRepeatFields` 生成 M×N 个 Vega-Lite spec 数组再拼接，Vega-Lite 原生 repeat 表达不了 |
| **分析导向**（一图多 Dimension/Measure 的高维空间配置） | **成立** | rows/columns 通道无数量上限，"多维度 + 多度量同置一轴"的 shelf 代数比 Vega-Lite 更贴近 Tableau 式分析交互 |
| **兼容性与兜底**（超上限兜底、表格等非图形形态） | **成立** | `renderer/specRenderer.tsx:66`：`geoms[0] === 'table'` 走 PivotTable，完全不经过 Vega |
| **架构解耦**（可替换底层图表库） | **部分成立** | `layout.renderer: 'vega-lite' \| 'observable-plot'` 已证明可行性；但解耦不干净 —— `resolve`、`interactiveScale`、`useSvg`、`showActions` 是 Vega 概念直接泄漏进 spec 层；`encodeFid()`（`vis/spec/encode.ts:66`）是 Vega 的转义需求泄漏到 spec 层。若接入 ECharts 等，这些字段要么无意义要么需重新解释 |

**这层抽象值得保留**，判断依据很简单：三条渲染路径（Vega-Lite / Leaflet / 表格）共享同一份 spec；删掉这层直接用 Vega-Lite，地图和表格就没有归宿。

### 1.3 问题诊断：冗余的真实来源是三类结构性问题

**① 字段对象按值复制而非按引用（手写体验差距的最大单一来源）。**
一个字段在 `encodings.dimensions` 池里存一份完整 `IViewField`，拖到 `rows` 后又复制一份完整对象。手写时同一字段的 `fid/name/semanticType/analyticType/aggName` 要写多遍，且两处可能不一致。Vega-Lite 是 by-name 引用。

**② 死字段和平行表示。**

| 字段 | 问题 |
|---|---|
| `IField.cmp` | 无任何代码使用 |
| `IField.aggergated` | 拼写错误，且从未被读写 |
| `IField.computed` | 与 `expression !== undefined` 完全冗余 |
| `IField.timeUnit` | 与 `expression` 的 dateTimeDrill 是同一件事的两种平行表示 |
| `showTableSummary` | 旧 `IVisualConfig` 与新 `IVisualLayout` 各有一份 |

**③ 强制完整性。**
全部 16 个 encoding 通道必须存在（即使是 `[]`）；`PureRenderer` 对 partial 输入零容忍；嵌套对象（`size` / `format` / `resolve`）不做递归合并。

**手写难的根源是 fid 机制：**

- spec 中一切引用走 `fid` 而非 `name`，用户必须先知道 schema；
- 合成字段（`gw_count_fid`、`gw_mea_key_fid` / `gw_mea_val_fid`、`gw_paint_fid`，见 `constants.ts:1-20`）由 `newChart()` 自动注入，用户既不知道也控制不了；
- 特殊字符需要 `encodeFid()` 转义 —— 这本是 Vega 的实现细节，又泄漏了一层；
- 无版本戳：spec 里没有任何版本字段，新旧格式靠 `'layout' in x` 鸭子判断（`parseChart()`，`models/visSpecHistory.ts:721`），下次结构变更时会失控。

### 1.4 渐进式 DSL 评估：强烈支持，且成本低于预期

关键发现：**normalize 管线的零件已经存在约七成**，只是散落各处、没有统一入口：

| 已有机制 | 位置 | 作用 |
|---|---|---|
| `fillChart()` | `models/visSpecHistory.ts:608` | partial IChart → 完整 IChart（含默认值合并，size 有嵌套合并） |
| `visSpecDecoder()` / `forwardVisualConfigs()` | `utils/save.ts:124 / 134` | 补全稀疏 encodings / config |
| `parseChart()` + `convertChart()` | `models/visSpecHistory.ts:721 / 666` | v1 IVisSpec → v2 IChart 自动迁移 |
| `VegaliteMapper()` | `lib/vl2gw.ts` | Vega-Lite spec → IChart |
| `renderSpec()` + `Specification` | `store/visualSpecStore.ts:866`、`interfaces.ts:26` | 极简 spec 的雏形（但太弱：一半字段 unused、仍要求 fid、整体替换而非合并，建议废弃换新） |
| `algebraLint()` | store 内 | geom↔channel 合法性校验，可直接当 normalize 的校验 pass |
| 默认值池 | `emptyEncodings` / `emptyVisualConfig` / `emptyVisualLayout`（save.ts）、`GEOM_TYPES` / `CHANNEL_LIMIT`（config.ts） | normalize 的默认值来源 |

这与 Vega-Lite 内部的 normalize 机制（shorthand / unit spec → normalized spec，后续编译 pass 只处理 normalized 形态，源码 `normalize/` 目录）是同构的。

**落地路径（三步）：**

**第一步：确立 canonical form 契约（成本最低、收益最大）。**
声明"完整 IChart 是内部唯一流通形态，所有入口在边界 normalize"，提供单一入口：

```typescript
normalize(input: TerseSpec | PartialChart | IVisSpec | VLSpec, meta: IMutField[]): IChart
```

内部 dispatch 到上表已有函数，再加 `$schema` 版本戳。

**第二步：设计 TerseSpec，两个关键决策：**

- **by-name 引用 + shorthand。** 名称→fid 的解析在 normalize 时用 `IMutField[]` 查表解决。示例：

```jsonc
{
  "mark": "bar",
  "x": "Region",              // name 或 fid 均可
  "y": "sum(Sales)",          // agg shorthand，normalize 时展开
  "color": "Category",
  "filters": [{ "field": "Year", "oneOf": [2024, 2025] }]
}
```

- **不在 canonical 层消灭冗余，在 terse 层消灭。** 字段按值复制、16 通道强制存在这些问题，改 canonical 结构是伤筋动骨的 breaking change；但 terse 层用引用 + normalize 时展开，用户永远不用面对冗余。canonical 为机器优化，terse 为人优化。

**第三步（可选、major 版本时）：** 清理 `cmp` / `aggergated` / `computed` 死字段与冗余标记，`timeUnit` 收敛到 `expression`。

---

## 2. 计算层 Workflow 评估

### 2.1 核心结构现状

Workflow 类型（`interfaces.ts:616-644`）：

```typescript
type IDataQueryWorkflowStep = IFilterWorkflowStep | ITransformWorkflowStep | IViewWorkflowStep | ISortWorkflowStep;
// view 步骤内部：IAggQuery | IFoldQuery | IBinQuery | IRawQuery
// 聚合算子：sum | count | max | min | mean | median | variance | stdev | distinctCount | expr
```

表达式系统（`interfaces.ts:136-183`）：`IExpression`，op 包括 `bin / binCount / log / log2 / log10 / one / dateTimeDrill / dateTimeFeature / paint / expr`，参数 `IExpParameter` 支持 `type: 'expression'` 递归嵌套，`toWorkflow()` 用 `walkExpression()` 做依赖提取 + tree-shake 排序。

`toWorkflow()`（`utils/workflow.ts:127-370`）生成的管线：

```
[filter 明细] → [transform 计算字段] → [filter 计算字段] → [view: aggregate|raw] → [filter 聚合后] → [sort]
```

后端契约（`interfaces.ts:480`）：

```typescript
type IComputationFunction = (payload: IDataQueryPayload) => Promise<IRow[]>;
```

三个已验证的后端：客户端 JS 执行器（`computation/clientComputation.ts` + `lib/op/*`，Web Worker 并行）、duckdb-wasm（`packages/duckdb-wasm-computation`，经 `@kanaries/gw-dsl-parser` 转 SQL）、远程 SQL 服务。

### 2.2 总体判断：骨架是对的

这套设计本质上是**关系代数的一个受限子集，按图表渲染需求特化**。定位合理：可判定、可翻译成单条 SQL、覆盖 BI 图表约 95% 的需求。远好于"直接从图表状态生成 SQL"的方案。

具体做得好的地方：

- **三阶段过滤**（明细 → 计算字段 → 聚合后）语义清晰；
- **表达式树 + tree-shake 依赖排序**，支持组合（如 `log(bin(x))`）；
- **双时区模型**：`offset`（数据时区）+ `displayOffset`（展示时区）；
- **fold/unfold 往返语义完整**（`MEA_KEY_ID` / `MEA_VAL_ID` 约定）；
- **后端无关**：`IComputationFunction` 契约极简，可插拔。

### 2.3 最大风险：语义由两个实现各自定义，没有仲裁者

**这是整套 Workflow 最大的问题，超过任何表达能力短板。** JS 执行器和 gw-dsl-parser（外部 Rust/WASM 包）是两个独立实现，而 `computation.md` 只是描述性文档不是规范。已知分歧点：

- null 在 filter 里按 falsy 处理（range 谓词直接失败），但在聚合里被计数（count / distinctCount）；无 IS NULL 类谓词；
- `regexp` 过滤规则 SQL 端未必支持；
- transform 级 `bin`（产出 `[min, max]` 元组）与 view 级 `IBinQuery` 产出结构不一致；
- `temporal range` 只接受毫秒时间戳，不支持 ISO-8601 字符串。

对一个"已有 SQL 转换机制在生产使用"的系统，同一 workflow 在客户端预览和服务端执行结果不同，是最隐蔽的一类 bug。

### 2.4 表达能力天花板：结构上有出路，只是 builder 没用

现状缺失：窗口函数（rank / lag / running sum）、多级聚合（sum of avg）、transform 引用聚合结果。这决定了它是"图表查询 DSL"而非通用计算 DSL —— 这个定位本身可以接受，但要明确。

值得注意：**`IDataQueryWorkflowStep[]` 本身是数组，客户端执行器就是顺序 fold，多个 view step 级联在数据结构和执行器层面已经支持**，只是 `toWorkflow()` 从不生成第二个 view step。未来做同比/环比/percent-of-total 时，扩展点是现成的：正式承认多 view step 级联 + 新增 window 类型的 view query op，不需要推翻管线设计。

### 2.5 其他设计债（按严重度排列）

1. **`expr` 原生 SQL 逃生舱破坏后端无关性**：`replaceFid()`（workflow.ts:379）做纯文本替换（有注入面），且客户端还有一套自己的 SQL 求值器（`lib/sql.ts`）—— 等于存在两个方言实现。建议：限定一个明确的表达式子集语法、共享 parser；或把 `expr` 显式标记为 backend capability，不支持的后端直接报错而非静默分歧。
2. **隐式约定缺乏类型保障**：`MEA_KEY_ID` magic string 触发 fold 重组（workflow.ts:138-149）；聚合后 filter/sort 依赖 `sum_Sales` 这类 `asFieldKey` 命名约定；sort 仅在 `limit && limit !== -1` 时生成（workflow.ts:277）。这些是 builder 与 executor 间的耦合，改动任何一端都可能悄悄破坏另一端。
3. **无校验 pass**：计算字段循环依赖会让 tree-shake 死循环（无 DAG 环检测）；字段不存在只在运行时暴露（无 schema 校验）。
4. **limit 不下推**：只在管线末端 slice（clientComputation.ts:47），只影响客户端执行器（SQL 端有数据库优化器），大数据集走客户端时中间结果全量物化。
5. **paint 操作**：仅支持 2D 空间哈希、异步且昂贵、与特定哈希算法紧耦合。
6. **时区逻辑无单一事实来源**：`displayOffset` 只注入 `dateTimeDrill` / `dateTimeFeature`；temporal range filter 自己另做一套偏移处理（lib/filter.ts:25）。

### 2.6 与 UI 层的联动：架构层面的定位

**可写性投资应该全部押在 UI 层的 TerseSpec 上，Workflow 保持为纯编译目标（IR），不追求人类可写。** 用户表达"我要什么图/什么分析"，由 canonical IChart 推导出 workflow；直接手写 workflow 的场景不应存在。由此两层 DSL 的分工完全清晰：

```
surface（terse，为人） → canonical（IChart，为状态管理） → IR（workflow + vega spec，为机器） → backend
```

---

## 3. 导出导入状态核实与"字段池耦合"问题

### 3.1 核实结论：两个粒度的导出都存在，且正好构成重复存储

**① 应用级导出**：`DataStore.exportData()`（`store/dataStore.ts:69`）返回 `IStoInfoV2`（`interfaces.ts:1176`）：

```typescript
interface IStoInfoV2 {
    $schema: 'https://graphic-walker.kanaries.net/stoinfo_v2.json',
    metaDict: Record<string, IMutField[]>;    // 数据集 meta，按 metaId 存
    datasets: Required<IDataSource>[];         // 原始数据源
    specDict: Record<string, string[]>;        // 每个 metaId 下的图表（含 undo 历史的序列化串）
}
```

**② 图表级导出**：`visualSpecStore.exportCode()` 返回 `IChart[]`，每个 IChart 的 `encodings` 里带完整的 `dimensions` / `measures` 池。

**结论：IChart 不是应用状态的干净子状态，而是"图表状态 + 字段列表快照"的混合体。** 应用级的 `IStoInfoV2` 其实已经把 meta 单独抽离（`metaDict`），但 IChart 内部又把 meta 复制了一份 —— 同一份字段信息在导出文件里存在于两处。

左侧 Field List 确实直接读当前图表的池子（`store/visualSpecStore.ts:153`：`get dimensions() { return this.currentEncodings.dimensions }`），删掉池子左栏就空。

### 3.2 决定性证据：系统自己承认了池子的可分解性

旧格式迁移代码（`store/dataStore.ts:58`）：旧版导出没有 metaDict，导入时系统要猜每个图表属于哪个数据集，用的方法是把池子里**非 computed 的字段**哈希一下当数据集指纹：

```typescript
encodeMeta(x.encodings.dimensions.concat(x.encodings.measures).filter((x) => !x.computed))
```

这行代码等于系统自己承认了等式：

> **图表的 dimensions/measures 池 = 数据集 meta（非 computed 部分） + 每图表的转化增量（computed 字段、drill 字段等）**

既然池子可以被这样分解，它就是可推导的，不该作为第一性数据存两份。

### 3.3 解耦方案（2026-07-07 修订：受"持久化格式冻结"约束收敛）

> 修订背景：本项目为开源项目，无真实用户数据可扫；企业用户依赖系统导入导出的 spec（`exportCode()` 的 `IChart[]` 与应用级 `IStoInfoV2`）做图表持久化与 dashboard 搭建。因此确立硬约束：**canonical/持久化层本次迭代冻结——已有字段零改动，最多纯增量添加（如可选 `$schema`）；所有解耦收敛到新增的 terse 层。**

**决策 A（修订后）：池子在 canonical/持久化层原样保留，解耦只发生在 terse 层。**

- terse spec 不含 dimensions/measures 池；normalize 时由数据集 meta + spec 内联的 computed 字段定义重建池子供系统使用；
- 导出 terse 是一个**新增的投影能力**：遍历 channels、filters、folds 收集实际引用的 fid，只序列化这些字段的定义；现有 `exportCode()` 一字不动；
- **terse 是有损投影，持久化永远走 canonical**：未被图表使用的 computed 字段在 terse 投影中会被丢掉（设计意图，需在文档明示）；canonical 往返保持无损。

**决策 B（修订后）：推迟。** computed 字段维持现状的 per-chart 所有权；数据集级虚拟字段（Tableau calculated field 模型）留待未来 major 版本再议。理由：canonical 冻结后所有权迁移无从落地，且无用户数据支撑"per-chart analyticType/名字分歧"的频率判断。terse 层用"定义内联在使用处"解决人写体验，不需要动所有权模型。

原三层归属模型仍是长期方向，但本次迭代只落地 terse 侧的重建/投影规则：

```
terse → canonical：池子 = 数据集 meta + spec 内联的 computed 字段定义（重建）
canonical → terse：只带被 channels/filters/folds 引用的字段（投影，有损）
```

**关键细节 —— 内联保证自包含**：如果 terse spec 只存引用不存定义，它离开原 workspace 就失效。只要把**被引用的**虚拟字段定义内联进 spec（类似 Vega-Lite 的 transform 数组），spec 就是自包含、可跨环境粘贴的，同时未使用的字段不会泄漏进来。两头都占住。

**兼容性的三个方向（从"尽量"变成可执行的保证）**：

1. 旧 spec 进新系统：现有 `parseChart` / `forwardVisualConfigs` 迁移链保持不动，`normalize()` 只是把它们包进统一入口；
2. 新导出进旧系统（前向兼容）：canonical 只做增量添加；`IStoInfoV2` 本就有 `$schema` 字段，裸 `IChart[]` 上新增可选 `$schema` 需实测验证旧读者（对象展开为主）对未知字段的容忍，不得假设；
3. 兼容性 fixture 套件：收集旧版本导出 JSON 作为 golden fixtures，断言"导入 → normalize → 下游管线产物"不变，把兼容承诺变成 CI 硬约束。

### 3.4 术语约定：canonical 层与 terse 层

- **Canonical form（规范形式）**，标准术语：多种写法表达同一意思时，从每个等价类选定唯一标准代表。Canonical IChart = 系统内部唯一流通的完备形态 —— 所有可选项填上默认值、所有引用解析成 fid、16 通道全部存在、字段对象完整展开。**允许冗余，因为它为机器服务。** 配套纪律：内部代码只处理 canonical 形态，一切外部输入在边界过 `normalize()`。
- **Terse（精简形态）**，即 authoring format（书写格式）：面向人手写优化 —— 按名字引用、有 shorthand、一切可省略的都可省略。多个 terse 写法映射到同一 canonical 形态，方向单向：terse → normalize → canonical。
- 现成类比：CSS 的 `margin: 4px 8px`（authoring shorthand）→ 四个 longhand 属性（computed style 即 canonical）；Vega-Lite 的 `"y": "mean(price)"` → normalize 展开成完整 field def，源码 `normalize/` 目录之后的编译 pass 只见 normalized spec。
- **渐进式（progressive）**的确切含义：terse 和 canonical 不是两门语言，而是**同一 schema 的省略程度谱系**。用户可以只写 `{x: "Region", y: "sum(Sales)"}`，也可以叠加任何 canonical 字段做精细控制，normalize 都能接住 —— 不存在"简易模式/专家模式"的断崖。
- 与 3.3 的关系一句话：**dimensions/measures 池属于 canonical 形态（机器要用，normalize 时重建），不属于 authoring 形态（人不该写，导出时投影掉）。** 两个问题是同一个设计的两面。

---

## 4. 行动建议（2026-07-07 修订版）

修订说明：第 1 项已完成；原第 3 项"字段所有权模型决策"因持久化冻结约束而消解（见 §3.3 修订），其内容降格为第 3 项 TerseSpec 设计中的重建/投影规则；第 2 项范围扩大，纳入兼容性 fixture 套件与 TerseSpec schema 草案。

1. **Workflow conformance test suite + 语义规范化。—— ✅ 已完成（2026-07-07 验收）**
   分支 `feat/workflow-conformance`（提交 933d8d9 + 返工 893db12）。`computation.md` 已升级为规范；`packages/computation-conformance` 双后端一致性套件 49 passed / 2 skipped；12 条分歧记录于 `docs/computation-divergences.md`。遗留：paint 与 expr 方言契约未覆盖（规范 §8 已标注）；DVG-009（总体方差）、DVG-010（null 排序）两条定夺待版本节点复议；gw-dsl-parser 侧 9 条 `test.failing` 分歧待 parser 仓库修复。

2. **`normalize()` 统一入口 + `$schema` 版本戳 + 兼容性 fixture 套件。—— ✅ 已完成（2026-07-07，提交 3849b16 + 58b70c4，单一 subagent 复核通过）**
   确立 canonical form 契约：单一入口接收 `TerseSpec | PartialChart | IVisSpec | VLSpec`，内部 dispatch 到已有的 `fillChart` / `parseChart` / `VegaliteMapper` 等零件（约七成已存在），输出完整 IChart。**纯新增：现有导入导出路径字节级不变。** `$schema` 利用现有 `gen-schema` 管线（`scripts/create-json-schema.js` 已从类型生成 `public/chartinfo.json` / `stoinfo_v2.json`）；`IChart` 上加可选 `$schema` 前需实测旧读者容忍度。同步建兼容性 fixture 套件（golden 旧版 spec → 导入 → 断言下游产物不变）。TerseSpec 的 schema 设计文档随本阶段出草案（normalize 入口签名依赖它），实现放下一阶段。

3. **TerseSpec 实现（渐进式 DSL 的核心交付物）。—— ✅ 已完成（2026-07-08，提交 d80afb2→a046d70，单一 subagent 三轮复核最终 PASS 无未决发现）**
   by-name 引用 + agg shorthand（`sum(Sales)`）+ 全字段可省略；不含 dimensions/measures 池（normalize 时由数据集 meta + 内联定义重建，投影导出时按 channels/filters/folds 的实际引用收集）；被引用的 computed 字段定义内联进 spec 保证自包含（含递归依赖链）；明示 terse 为有损投影、持久化走 canonical；输出前过 `algebraLint` 校验。废弃现有 `Specification` 接口（`interfaces.ts:26`），不做兼容。设计定稿与残留边界见 docs/terse-spec-design.md。

4. **Workflow validate pass。—— ✅ 已完成（2026-07-08，`src/utils/workflowValidate.ts`）**
   字段存在性校验（判定域 = 池子 ∪ 数据集 meta，仅在提供 meta 时执行——存在性只能相对数据集判定，computed 表达式引用池子外的原始数据列是合法的）+ 计算字段依赖 DAG 环检测 + 重复 fid 检测；`normalize()` 作为严格入口始终执行内在结构检查。**事实修正**：`treeShake` 遇环并不死循环（工作队列严格收缩必然终止），实际危害是产出无法满足的 transform 顺序导致静默算出错误数据——validator 的价值是在执行前抓住这一类静默损坏,已有特征化测试钉住此行为。

5. **（major 版本时）Canonical 层清理与深水区决策。**
   删除 `IField.cmp`、`aggergated`（拼写错误的死字段）、`computed`（与 `expression` 冗余）；`timeUnit` 收敛到 `expression`；`showTableSummary` 去重；明确 `expr` 的 backend capability 边界；复议 DVG-009/010；届时再议数据集级虚拟字段所有权（§3.3 决策 B）。

---

## 附：关键代码索引

| 主题 | 位置 |
|---|---|
| 核心类型（IChart / DraggableFieldState / IVisualConfigNew / IVisualLayout / IField） | `packages/graphic-walker/src/interfaces.ts:48-470, 695-709` |
| Workflow / 表达式类型 | `packages/graphic-walker/src/interfaces.ts:136-183, 616-644` |
| 应用级导出格式（IStoInfoOld / IStoInfoV2） | `packages/graphic-walker/src/interfaces.ts:1167-1183` |
| 合成字段常量（gw_count_fid 等） | `packages/graphic-walker/src/constants.ts:1-20` |
| Vega-Lite 编译（repeat 拼接） | `packages/graphic-walker/src/lib/vega.ts` |
| 单视图编译 / fid 转义 | `packages/graphic-walker/src/vis/spec/view.ts` / `encode.ts:66` |
| Workflow 构建（toWorkflow / processExpression / replaceFid） | `packages/graphic-walker/src/utils/workflow.ts:127-451` |
| 客户端执行器 | `packages/graphic-walker/src/computation/clientComputation.ts`、`lib/op/*`、`workers/*` |
| SQL 后端接入（gw-dsl-parser） | `packages/duckdb-wasm-computation/src/index.ts:129-155` |
| 迁移/normalize 零件（fillChart / parseChart / convertChart / visSpecDecoder） | `packages/graphic-walker/src/models/visSpecHistory.ts:572-723`、`utils/save.ts:69-142` |
| Vega-Lite → IChart | `packages/graphic-walker/src/lib/vl2gw.ts` |
| 旧 Specification 接口 / renderSpec | `packages/graphic-walker/src/interfaces.ts:26-38`、`store/visualSpecStore.ts:866` |
| DataStore（metaDict / visDict / encodeMeta 指纹） | `packages/graphic-walker/src/store/dataStore.ts` |
| 地图渲染（绕开 Vega） | `packages/graphic-walker/src/components/leafletRenderer/index.tsx` |
| 表格模式 | `packages/graphic-walker/src/renderer/specRenderer.tsx:66` |
