# S0 独立代码审核

日期：2026-11-06。审核模型：`gpt-6.1-sol`，reasoning effort：`xhigh`。审核工作树：`feat/native-worksheet-renderer`。

结论：**PASS，仅批准本轮 S0 最小纵切。** 已查看修复后的实际代码并重新执行下列验证，当前没有未解决的 S0 代码审核阻断项。首次审核未通过，后续修复经过复审；本结论不是依据原有 V0 或实施者的测试摘要作出。

## 实际审核范围

- `packages/graphic-walker/src/lib/native/` 的 IChart 适配器、结果列绑定与 fixture。
- `packages/worksheet-renderer/src/` 的内部类型、typed identity、prepared 数据索引、窗口协议校验、能力诊断、共同 Scene、Canvas/SVG 后端、滚动控制器和生命周期。
- 子包构建与开发脚本、包入口、类型输出配置、演示页及全部现有测试。
- 对照现有 GW 的 `getMeaAggKey`、workflow/fold、字段布局与时间显示入口，以及正式需求、设计和 alignment 文档。未改动这些既有计算实现。

新路径使用现有 IChart 和已准备结果。RenderPlan 为内部显示参数，库没有新增聚合、SQL、表达式执行器或用户持久化 specification。核心运行时未引入 React、Vega、Plot 或 GW store。

## 发现与修复复审

| 问题 | 修复与验证 |
| --- | --- |
| 更新失败后旧 frame 仍可命中和导出 | 更新起始及有效错误路径清除 frame 和绘图根；错误后导出拒绝，恢复有效 source 后可以重新提交。已独立复现原错误并验证修复。 |
| 部分窗口被误报为完整提交 | 提交前集中验证版本、轴范围与叶身份、祖先跨度、pane 路径与 slot、覆盖矩形并集、完整域及分页状态。不完整响应明确拒绝，不进入完整窗口缓存。 |
| windowed 记录缺列或错类型时静默少画 mark | 校验当前 pane 实际使用的结果列、raw 列、连续数值、时间范围及 facet 值与路径的一致性；保留合法 null，不要求其他度量槽的未使用列。 |
| nominal/ordinal 字段 COUNT 结果被当作 band | 度量位置遵循现有 GW 数值显示规则；COUNT 与 distinctCount 的 bar/point 回归通过。 |
| source/snapshot 更新后选择可能指向错误数据或携带旧值 | 切换 source 清空选择；新 snapshot 清除旧目标值，成功帧以当前 hits 刷新已知目标，未验证的身份保留 pending。 |
| 独立包入口静默接受未实现的显示选项 | 包入口增加 S0 能力检查，未实现的通道、布局、轴与样式选项明确诊断。 |
| 外部源的原始域覆盖了已配置的固定域 | 共同 scale 解析统一应用固定端点、零点和单值扩展；固定 band 域校验 typed 唯一性，位置、柱厚和颜色使用相同的有效域，并按字段缓存解析结果。 |
| 错误与销毁路径遗留资源 | 并行读取失败时取消兄弟读取；dispose 清理观察器、事件、请求、缓存、选择、Scene、绘图 DOM 和 Canvas 位图，并释放完整 source 引用。 |

同时复查了正负堆叠端点共用 `advanceBarStack`、零点显示域、多度量表头、冻结区域裁剪及超长滚动的逻辑与物理坐标映射。

## 独立执行的验证

| 检查 | 结果 |
| --- | --- |
| 子包 `npm test` | **58/58 通过**，包括 6 项 controller 状态、选择、失败取消及生命周期回归。 |
| 子包 `npm run typecheck` | 通过。 |
| 独立临时 DOM 状态回归 | 更新失败不导出旧帧、部分覆盖不提交、dispose 清理帧和位图，3 项通过。相关场景已纳入子包测试。 |
| 当前根入口的内存 ESM 构建与消费 | esbuild `write:false` 构建通过；13 个运行时输入全部位于本包 `src/`，没有外部运行时输入；产物可在没有 DOM/window 的 Node 环境导入。 |
| 原缺陷专项探针 | 实际运行并核对 nominal COUNT、缺失记录列、部分覆盖及外部固定域的行为。 |

DOM mock 仅验证控制器状态合同。实际浏览器的 Canvas 数量、像素、SVG、输入和导出由另一位独立审核者记录于 [浏览器验收](./browser-acceptance.md)，不以 mock 代替浏览器证据。本审核未重新执行完整 GW 产品回归或正式性能基准。

## 批准边界

本次批准覆盖 IChart fixture 到独立渲染库的 S0 纵切、显式 bar/point 子集、完整输入与程序化 windowed source、共同 Scene、单 Canvas/SVG、冻结头、超长滚动及上述基础正确性保护。

S1–S3 仍须完成其余基础 mark、完整交互与可访问性、作用域与图例、受控折叠和排序、高基数缓存及分页导出、真实记录性能与生命周期基准，以及生产 GW renderer 路由、schema、normalize/reducer 保字段、保存/导入导出/undo/redo 和旧后端回归。S0 通过不表示生产 GW 已可选择 native，也不表示 R01–R17、A01–A16 或 B1–B5 已全部验收。
