# Explain Data 重构方案

> 状态：设计提案（待评审）
> 日期：2026-07-07
> 关联：[dsl-design-review.md](./dsl-design-review.md)、[internal_docs/explain-data-explained/README.md](../internal_docs/explain-data-explained/README.md)（Tableau Explain Data 原理参考）

## 1. 背景与现状复盘

Explain Data 模块允许用户点击图表中的一个标记（mark），由系统给出该标记"为什么值得注意"的解释。当前实现的调用链：

- 触发：右键标记 → 嵌入菜单 `data_interpretation`（`components/embedMenu.tsx`）→ 选中标记的维度值存入 `selectedMarkObject`（`renderer/index.tsx`）→ 打开 `components/explainData/index.tsx` 对话框。
- 算法：`lib/insights/explainBySelection.ts`。对每个「未可视化维度 × 视图度量」组合跑两次聚合查询（总体分布、选中标记分布），归一化后用 Jensen–Shannon 散度变体打分（`utils/normalization.ts#compareDistributionJS`），按分数降序展示。

按 Tableau 的四分类，现状只覆盖了 **unique about this mark**（标记的独特之处）一类，且存在以下问题：

### 1.1 数学层

| # | 问题 | 位置 | 后果 |
|---|------|------|------|
| 1 | JS 散度跳过任一侧占比为 0 的类别（`if (p === 0 \|\| q === 0) continue`），但 JS 散度对零概率有良好定义 | `normalization.ts#compareDistributionJS` | "只集中在某类别 / 完全缺失某类别"这种最强信号被丢弃 |
| 2 | 最终分数乘以类别覆盖率权重（匹配类别数 / 总体类别数），分布越集中权重越低 | 同上 | 系统性压低最独特的候选，**排序方向与洞察价值相反** |
| 3 | 归一化对度量取绝对值求和 | `normalization.ts#normalizeWithParent` | 可正可负的度量（利润等）份额概念不成立，结果无意义 |
| 4 | 比较基线是"含自身的总体"（child vs parent），而非"其余标记"（siblings） | `explainBySelection.ts` | 大占比标记与包含自己的总体比，差异被自我稀释 |

### 1.2 统计层

- 无最小样本量要求：只有两三行数据的标记分布必然极端，散度必然高，**排最前的往往最不可信**。
- 无基数校正：高基数维度（城市 200 值）与低基数维度（性别 2 值）的分数不可比却混排。
- 数值维度等宽 10 箱，一个极端值即可把其余 9 箱压空，分箱本身制造假差异。
- 无显著性判断、无分数阈值：**永远输出一个排好序的列表**，不管有没有真实信号。

### 1.3 工程层

- 查询完全串行，共 `2 × 候选维度数 × 度量数` 次往返；总体分布查询按度量重复执行。
- `explainValue.ts`、`explainByChildren.ts` 为死代码（无任何引用）；前者还有 key 错位 bug（聚合结果 key 为 `getMeaAggKey` 形式，读取时却用裸 `fid`，恒为 `undefined`）。

### 1.4 呈现层

- 返回值命名为 `normalizedData` 实际是未归一化的原始聚合值，图表靠双独立 y 轴硬拗成可比。
- 结果标签为 `字段名 + 裸分数`，用户无法解读；多度量时不可区分；标题硬编码英文未走 i18n。
- 全部计算完成前只有 loading，无渐进展示；无空状态。

**一句话结论：现状是"用一个实现有误的信息论指标，近似回答了一个错误的问题"。** 用户问"为什么这个值高/低"，系统回答"这个标记的构成有何不同"，且在这个降级问题上排序也不可信。好在查询走标准 workflow 抽象、标记级聚合数据量小，重构的工程障碍不大。

## 2. 架构约束与总设计原则

### 2.1 计算架构约束（硬性）

Graphic Walker 的计算既可在浏览器端执行，也可下发服务端，**唯一下发通道是 workflow DSL**（`IDataQueryWorkflowStep[]`，经 `dataQuery(computation, workflow)` 执行）。DSL 能力清单（`interfaces.ts`）：

| 能力 | 形态 | 备注 |
|------|------|------|
| 过滤 | `{type:'filter', filters:[{fid, rule}]}` | rule 支持 `one of` / `not in` / `range` / `temporal range` / `regexp` → **标记谓词可下推** |
| 派生列 | `{type:'transform', transform:[{key, expression}]}` | 表达式 op：`bin` / `binCount` / `log2` / `log10` / `log` / `one` / `dateTimeDrill` / `dateTimeFeature` / `expr` |
| 聚合 | `{type:'view', query:[{op:'aggregate', groupBy, measures}]}` | 聚合器：`sum` / `count` / `mean` / `median` / `variance` / `stdev` / `max` / `min` / `distinctCount` |
| 行级取数 | `{type:'view', query:[{op:'raw', fields}]}` + payload `limit` | **极端值检测的关键依赖** |
| 排序 | `{type:'sort', sort, by}` | 配合 limit 可做 top-N |

**没有的能力**：分位数聚合（无 q1/q3）、窗口函数、join、采样。方案设计不得依赖这些；确需分位数时用 `raw` 取回单列客户端计算（见 3.1）。

### 2.2 总原则：DSL 做数据归约，客户端做统计

所有解释类型统一遵循一个两段式契约：

```
阶段一（可下发）：workflow DSL 把原始数据归约为「标记级 / 类别级聚合表」或「受限行级样本」
                  —— 结果规模 = O(标记数 × 类别数)，与原始行数无关
阶段二（客户端）：在归约结果上做统计计算（散度、IQR、ridge 回归、打分）
                  —— 纯函数、无 IO、可单测
```

这与 Tableau 的架构一致（模型拟合发生在标记级聚合上，而非原始行）。它保证：服务端只需要已有的 DSL 语义，不新增任何自定义算子；统计层在两种计算模式下行为完全一致。

**派生原则**：所有聚合查询一律请求 `sum` + `count`（而非直接请求 `mean`），客户端按需派生均值与份额。这带来两个关键收益：

1. sum/count 可加，**siblings（其余标记）分布可以从「视图维度 + 候选维度」一次查询的结果中直接减出来**，不需要单独的总体查询——查询数减半；
2. 均值、占比、方差贡献等都能在客户端一致地推导，避免非可加聚合（mean/median）无法跨层合成的问题。

例外：视图度量本身用了 `median` / `variance` 等非可加聚合时，该度量的总体/兄弟分布需单独一次查询（见 6.1）。

### 2.3 共享查询编排

四类解释器的查询高度重叠，引擎层统一去重：

- 以 workflow 的稳定序列化哈希为 key，同一查询只执行一次，多个解释器共享结果；
- `Promise.all` + 并发上限（默认 4）并行执行；
- 结果以流式（`onResult` 回调 / AsyncGenerator）交付 UI，先算完的先展示。

**查询预算对比**（k = 候选维度数，m = 视图度量数）：

| | 现状 | 重构后 |
|---|---|---|
| 查询次数 | 2·k·m（串行） | ≈ k + 3（并行，B/D 两类共享同一批查询） |
| 单查询度量数 | 1 | 全部度量合批 |

## 3. 四大类解释的实现方案

以下统一记号：视图维度集 `Dims`（定义了标记的 LOD）、视图度量 `M`（目标度量，聚合器 `agg`）、选中标记谓词 `P`（`Dims` 上的等值条件，DSL 表达为 `one of` 过滤）、候选维度 `d`、候选度量 `m`。

### 3.1 A 类 · 极端值（Extreme Values）

**回答的问题**：选中标记的聚合值是否被少数行级极端记录扭曲？（Tableau 开篇的 10000 秒 L-sit 例子）

**适用条件**：`agg ∈ {mean, sum, stdev, variance}`（对极值敏感）；`count` / `distinctCount` 不适用。

**查询计划**（两段，均为标准 DSL）：

第一步·预筛（1 次查询，结果 1 行）——判断有没有必要拉行级数据：

```jsonc
[
  { "type": "filter", "filters": [/* 视图过滤器 + 标记谓词 P（one of） */] },
  { "type": "view", "query": [{
      "op": "aggregate", "groupBy": [],
      "measures": [
        { "field": "M", "agg": "count",  "asFieldKey": "M_count" },
        { "field": "M", "agg": "mean",   "asFieldKey": "M_mean" },
        { "field": "M", "agg": "median", "asFieldKey": "M_median" },
        { "field": "M", "agg": "stdev",  "asFieldKey": "M_stdev" },
        { "field": "M", "agg": "min",    "asFieldKey": "M_min" },
        { "field": "M", "agg": "max",    "asFieldKey": "M_max" }
      ]
  }]}
]
```

预筛条件：`count ≥ 5` 且（`|mean − median| > 0.5·stdev` 或 `max − median > 3·stdev` 或 `median − min > 3·stdev`）。均值与中位数的显著偏离是存在极端值的廉价信号；不满足则直接跳过该类，省掉行级查询。

第二步·行级取数（1 次查询）——DSL 没有分位数聚合，用 `raw` 拉取该标记的度量列，客户端算 IQR：

```jsonc
// payload: { workflow: [...], limit: 20000 }
[
  { "type": "filter", "filters": [/* 同上 */] },
  { "type": "view", "query": [{ "op": "raw", "fields": ["M", /* 其他视图度量 */] }] }
]
```

**客户端计算**：

1. 排序求 q1/q3，`IQR = q3 − q1`，离群 = 超出 `[q1 − 1.5·IQR, q3 + 1.5·IQR]` 的记录；
2. **影响力评估**（核心打分）：`impact = |agg(全部) − agg(剔除离群行)| / |agg(全部)|`。只有 impact 超过阈值（建议 10%）才作为解释输出——"存在离群值"本身不是洞察，"离群值扭曲了你看到的聚合结果"才是；
3. 行数超过 limit 时降级：仅基于预筛统计量给出弱提示（"该标记的均值显著偏离中位数，可能存在极端记录"），不列具体行。

**证据呈现**：该标记度量值的直方图（客户端已有全部行值，直接分箱）+ 高亮离群区间 + 文案"剔除 n 条极端记录后，`mean(M)` 从 X 变为 Y（变化 Z%）"。若需要展示离群行明细，用第二步已取回的其他字段。

**护栏**：`count ≥ 5`；impact ≥ 10%；离群行数占比 ≤ 20%（超过说明是双峰/长尾分布而非个别异常，改用"分布形态"话术）。

### 3.2 B 类 · 贡献维度（Contributing Dimensions）

**回答的问题**：某个未可视化维度的取值构成，能否**帮助预测**各标记的度量值——而不只是"这个标记的构成不一样"（那是 D 类）。

**方法**（Tableau 的 base/explain model 框架）：

- **base model**：以视图维度 one-hot 为特征，ridge 回归拟合各标记的 `M` 值；
- **explain model**：base 特征 + 候选维度 `d` 的 **top-K 取值占比**（rates）作为附加特征；
- 训练时**留出选中标记**，打分 = 对其余标记的拟合改善 + 对留出标记的预测误差改善 − 过拟合惩罚。

**查询计划**（每个候选维度 1 次查询；数值型候选先 transform bin）：

```jsonc
[
  { "type": "filter", "filters": [/* 仅视图过滤器，不含标记谓词 —— 需要所有标记 */] },
  // 数值型候选维度：先分箱
  { "type": "transform", "transform": [{
      "key": "d_bin",
      "expression": { "op": "bin", "as": "d_bin", "num": 10,
                      "params": [{ "type": "field", "value": "d" }] }
  }]},
  { "type": "view", "query": [{
      "op": "aggregate",
      "groupBy": [/* ...Dims, */ "d_bin"],
      "measures": [
        { "field": "M", "agg": "sum",   "asFieldKey": "M_sum" },
        { "field": "M", "agg": "count", "asFieldKey": "M_count" },
        { "field": "*", "agg": "count", "asFieldKey": "row_count" }
      ]
  }]}
]
```

> 这批查询**与 D 类完全同构**——引擎层同一次查询同时喂 B、D 两个解释器，这是查询预算从 2km 降到 k 的关键。

**客户端计算**：

1. 从查询结果统计 `d` 的全局 top-K 取值（K = 10，按行数），其余归入 `__other__`；
2. pivot 成「标记 × (top-K 占比)」特征矩阵，占比 = 该标记内取值行数 / 该标记总行数；
3. 目标向量 y = 各标记的 `M` 聚合值（sum/count 派生），标准化；
4. ridge 闭式解 `β = (XᵀX + λI)⁻¹Xᵀy`。特征维度 ≤ |Dims one-hot| + K + 1 ≈ 20，标记数通常几十，纯 JS 实现（高斯消元求逆）几十行，无新依赖；
5. 打分：
   - `fitGain = R²_explain − R²_base`（在非留出标记上，λ 经 LOO 交叉验证选取）；
   - `predGain = |ŷ_base(mark) − y(mark)| − |ŷ_explain(mark) − y(mark)|`，归一化到 y 的尺度；
   - `penalty`：自由度惩罚（特征数增量 / 标记数）+ "幸运预测"检查——对候选特征做若干次随机置换（种子固定，保证可复现），若真实 predGain 未显著超过置换分布，判为侥幸，丢弃；
   - `score = w₁·fitGain + w₂·predGain − penalty`，仅 score > 阈值者输出。

**证据呈现**：Tableau 式双图——上图为各标记的实际值 vs base model 预测带 vs explain model 预测带（选中标记高亮）；下图为该候选维度 top 取值占比与 `M` 的关系。文案统一用关联性措辞："`d` 的构成**有助于预测** `M`"，禁用因果表述。

**护栏**：标记数 ≥ 8 才启用模型类（不足时该类整体禁用，UI 说明原因）；候选维度基数 ≥ 2；`__other__` 占比 > 80% 的高基数维度跳过。

### 3.3 C 类 · 贡献度量（Contributing Measures）

**回答的问题**：某个未可视化**度量**在标记 LOD 上的聚合值，能否帮助预测目标度量？（攀岩例子里的指力、训练年限）

**查询计划**（**全部候选度量合并为 1 次查询**）：

```jsonc
[
  { "type": "filter", "filters": [/* 仅视图过滤器 */] },
  { "type": "view", "query": [{
      "op": "aggregate",
      "groupBy": [/* Dims */],
      "measures": [
        { "field": "M",  "agg": "sum",   "asFieldKey": "M_sum" },
        { "field": "M",  "agg": "count", "asFieldKey": "M_count" },
        // 每个候选度量 m：
        { "field": "m1", "agg": "sum",   "asFieldKey": "m1_sum" },
        { "field": "m1", "agg": "count", "asFieldKey": "m1_count" },
        { "field": "m2", "agg": "sum",   "asFieldKey": "m2_sum" }
        // ...
      ]
  }]}
]
```

结果规模 = 标记数 × 字段数，极小。

**客户端计算**：与 B 类共用同一 ridge 框架，差异仅在特征构造：

1. 候选度量 `m` 在标记 LOD 上取 mean（sum/count 派生），标准化；
2. 特征 = base 特征 + `m̃` + `m̃²`（二阶项，对应 Tableau 的 second-order modeling，捕捉非线性）；
3. 打分、置换检验、护栏与 B 类完全一致。

**证据呈现**：散点图（x = 候选度量的标记级均值，y = 目标度量，选中标记高亮）+ explain model 拟合曲线。文案额外遵循 Tableau 文章的提醒：**只陈述关联，不暗示可控性**（"臂展有助于区分，但不可改变"这类判断留给用户；后续可让用户给字段打 可控/固定/忽略/敏感 标签，见 M3）。

### 3.4 D 类 · 标记独特性（Unique About This Mark）——修复现有实现

**回答的问题**：这个标记的人群构成，在哪个未可视化维度上与**其余标记**最不一样？定位为"探索线索"，UI 上明确降级于 A/B/C（Tableau 原文："clues, not conclusions"）。

**查询计划**：与 B 类共享同一批查询（3.2 的 workflow），零额外查询。选中标记的分布 = 谓词过滤后的行；siblings 分布 = 全量减去选中标记（sum/count 可加，客户端直接减）。

**客户端计算**（替换 `compareDistributionJS`）：

1. 分布构造：对 count 类比较用行数占比；对度量比较用 `sum` 份额（**负值处理**：存在负值时自动切换为行数占比模式并在文案中注明，不再取绝对值硬算）；
2. 平滑：两侧分布各加 Laplace 伪计数（α = 0.5），消除小样本的伪极端；
3. 打分 = **完整 JS 距离** `√(JSD)`：零概率类别按定义计入（`0·log 0 = 0`，单侧为零时贡献 `0.5·p`），**不再乘覆盖率权重**。JS 距离有界于 [0,1]，跨维度天然可比，高基数无需额外归一；
4. 显著性：对行数分布做 G 检验（`G = 2N·KL(mark‖siblings)`，渐近 `χ²(k−1)`），p < 0.01 且 JS 距离 > 0.15 才输出；对度量份额分布无严格检验，用样本量下限 + 更高的距离阈值（0.25）兜底，并在 UI 标注为启发式结果。

**证据呈现**：修复现状图表——选中标记与 siblings **共用同一 y 轴**，均以份额（%）呈现；不再返回挂着 `normalized` 名字的原始值。

**护栏**：标记行数 ≥ 20；候选维度在平滑后有效类别数 ≥ 2；每维度只保留该维度下的最优结果，全局最多输出 top 5。

### 3.5 跨类型排序与展示

各类分数量纲不同，**不做跨类型统一排序**。UI 按固定优先级分组展示：A（数据质量，最可行动）→ B/C（模型证据）→ D（探索线索），组内按各自分数排序；每条解释映射为三档定性强度（强 / 中 / 弱提示），裸分数仅在开发者模式展示。所有类别都可能为空——空状态明确显示"未发现显著模式"，这是**特性而非缺陷**。

## 4. 推荐改造方案：架构层保留，算法层重写

明确回答"从零重写还是基于现有修改"：**分层回答**。

### 4.1 保留（复用现有资产）

| 资产 | 位置 | 理由 |
|------|------|------|
| 触发链路 | `embedMenu.tsx` → `selectedMarkObject` → 谓词构造 | 标记→谓词的映射逻辑正确，含 temporal 特判 |
| workflow 编排与计算抽象 | `utils/workflow.ts#toWorkflow`、`computation/index.ts#dataQuery` | 这正是"适配双端计算"的根基，方案的全部查询都经由它 |
| 对话框与图表基建 | Dialog / vega-embed / 主题系统 | 壳可用，换内容 |

### 4.2 重写（废弃后新建）

| 废弃 | 理由 |
|------|------|
| `lib/insights/explainBySelection.ts` | 打分逻辑重写后所剩无几，查询编排移入引擎层 |
| `lib/insights/explainValue.ts`、`explainByChildren.ts` | 死代码 + bug，git 历史可查，直接删除 |
| `utils/normalization.ts` 中的 `compareDistribution*` 系列 | 数学错误的修复量 ≈ 重写量，且现有代码零测试覆盖；`normalizeWithParent` 等如无他处引用一并清理 |
| `components/explainData/index.tsx` 内容区 | 从"分数列表 + 单图"改为"按类分组的解释卡片 + 渐进加载" |

理由汇总：算法层总共约 300 行、无测试、其中三分之二是死代码，"原地修" 与 "重写" 工作量几乎相同，但重写能一步到位建立四类解释器的统一接口与测试基线。

### 4.3 新模块设计

```
lib/explain/
├── engine.ts          // 编排：查询去重（workflow 哈希）、并发执行、流式交付、跨类护栏
├── types.ts           // IExplainer / IExplanation / ExplainContext
├── explainers/
│   ├── extremeValue.ts        // A 类
│   ├── contributingDim.ts     // B 类
│   ├── contributingMeasure.ts // C 类
│   └── uniqueMark.ts          // D 类
├── stats/
│   ├── divergence.ts  // JS 距离（完整零处理 + 平滑）、G 检验
│   ├── quantile.ts    // q1/q3/IQR
│   └── ridge.ts       // 闭式解 ridge + LOO λ 选择 + 置换检验（种子固定）
└── __tests__/         // 纯函数单测 + 合成数据金标准
```

核心接口：

```ts
interface IExplainer {
  type: 'extreme-value' | 'contributing-dimension' | 'contributing-measure' | 'unique-mark';
  isApplicable(ctx: ExplainContext): boolean;                    // 聚合类型、标记数等前置检查
  plan(ctx: ExplainContext): IDataQueryPayload[];                // 只产出 workflow DSL，不执行
  analyze(ctx: ExplainContext, results: IRow[][]): IExplanation[]; // 纯函数，客户端统计
}

interface IExplanation {
  type: IExplainer['type'];
  score: number;
  strength: 'strong' | 'moderate' | 'weak';
  field: IField;                       // 解释字段（+ 度量上下文）
  descriptionKey: string;              // i18n key，参数化，不硬编码文案
  descriptionParams: Record<string, string | number>;
  evidence: { chartSpec: object; rows?: IRow[] };  // vega-lite spec + 可选明细行
}
```

`plan / analyze` 分离是适配双端计算的结构性保证：**explainer 只会通过 DSL 表达数据需求**，任何绕过 DSL 的取数在接口上就不可能发生；engine 对 `plan` 产出做哈希去重后统一执行（B/D 共享查询即由此自动达成）。`analyze` 是纯函数，单测直接喂查询结果 fixture，无需 mock 计算层。

对外暴露 headless API（供 host 应用/未来 LLM 叙述层消费）：

```ts
explainMark(ctx): AsyncGenerator<IExplanation>
```

现有 `<ExplainData>` 组件变为该 API 的默认 UI 消费者。

### 4.4 测试策略

- `stats/` 全部纯函数单测（散度零值边界、G 检验临界值、ridge 与解析解对拍）；
- 合成数据金标准：构造已知答案的数据集（植入一条极端记录 / 一个强相关隐藏度量 / 一个构成差异维度），断言对应解释以 `strong` 强度被找到、且无关字段不产生解释（控误报）；
- 双端一致性：同一合成数据集分别走客户端计算与服务端计算（CI 里用 DuckDB-WASM 模拟），断言 `analyze` 输入一致。

## 5. 里程碑

| 阶段 | 内容 | 规模 | 可独立发布 |
|------|------|------|-----------|
| **M0 · 止损** | 在现有代码上最小修复：JS 散度零值处理、删覆盖率权重、siblings 基线、样本量/阈值/空状态、查询合批并行、UI 同轴份额化 | 2–3 天 | ✅ 立即改善现有功能可信度 |
| **M1 · 引擎 + A 类** | `lib/explain/` 骨架落地；极端值解释器；D 类迁入引擎；卡片式分组 UI + 渐进加载；删除死代码 | ~1 周 | ✅ |
| **M2 · 模型类** | `stats/ridge.ts`；B、C 解释器；置换检验；i18n 文案体系（关联性措辞规范） | ~2 周 | ✅ |
| **M3 · 产品层** | headless API 定稿；行动按钮（将解释字段加入视图 / 过滤到该段 / 排除离群行）；字段元数据标注（可控/固定/忽略/敏感）；LLM 叙述接口预留 | 按需 | — |

M0 与 M1+ 并不冲突：M0 的散度修复代码即 M1 `stats/divergence.ts` 的雏形，工作量不浪费。

## 6. 风险与开放问题

1. **非可加聚合的 siblings 派生**：视图度量为 `median` / `variance` 时无法从标记级 sum/count 合成总体分布，D 类需为此类度量单独多跑一次总体查询（回到现状的查询形态，但仍合批并行）。
2. **`raw` 查询的规模上限**：A 类依赖行级取数，单标记行数极大时受 `limit` 约束降级为弱提示。若未来服务端 DSL 扩展分位数聚合（`q1`/`q3`），A 类可完全免除行级查询——建议作为 DSL 演进的候选项记入 [dsl-design-review.md](./dsl-design-review.md) 的行动清单，但**本方案不依赖它**。
3. **temporal 维度作为候选**：需选择 drill 粒度（year/month/…）。M1 先用 `dateTimeDrill` 固定 month 粒度，后续依据视图时间轴粒度自适应。
4. **置换检验的确定性**：浏览器端随机置换需固定种子以保证"同一视图状态产出同一解释"（Tableau 文章强调的可复现性）；`stats/ridge.ts` 内置 PRNG，不使用 `Math.random`。
5. **候选字段规模**：宽表（>50 个候选字段）下 k+3 次查询仍可能偏多。缓解：按字段元信息预排序（基数适中优先），首屏只跑 top 20 候选，其余"继续分析"按需触发。
