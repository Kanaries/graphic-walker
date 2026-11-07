# 多层嵌套工作表渲染器：历史调研索引

整理日期：2026-11-06。用途是为正式立项找回已有研究、实验和代码。本次仅核对历史聊天、文件及当前源码，没有重新执行历史性能基准或启动演示服务。

## 建议先读

| 资料 | 用途 |
| --- | --- |
| [Graphic Walker 多层嵌套与分面工作表设计](./tableau-style-worksheet-design.md) | 最新找到的完整架构方案，覆盖语义、查询、布局、后端、兼容迁移和验收 |
| [Tableau Desktop 2022.2 机制研究](/Users/observedobserver/Documents/tableau-research/tableau-desktop-2022.2.md) | 理解递归表表达式、表头树、pane、查询粒度及渲染模块的依据 |
| [Worksheet renderer V0 说明](../packages/worksheet-renderer/README.md) | 确认已有代码能做什么、尚缺什么，避免把实验版当作正式集成 |
| [早期 Vega-Lite 二维虚拟化报告](/Users/observedobserver/Documents/Codex/2026-10-10/task-3/research/REPORT.zh.md) | 回看 Vega-Lite 路线的实验、性能边界和与 Tableau 行列语义的差别 |

## 1. 早期 Vega-Lite 与 Graphic Walker 组合研究

这条线有三组材料，不能合并理解为同一个已完成方案。

### 1.1 扩展 Vega-Lite 的嵌套语法

- [有序嵌套 Facet 实现指南](/Users/observedobserver/Documents/GitHub/vega-lite/docs/nested-facet-implementation-guide.md)。新增 `facet.levels`，把有序层级展开成递归 facet；属于本地 Vega-Lite 扩展。
- [MVP 输入 spec](/Users/observedobserver/Documents/GitHub/vega-lite/examples/specs/nested-facet-mvp.vl.json)。
- [MVP SVG 输出](/Users/observedobserver/Documents/GitHub/vega-lite/examples/compiled/nested-facet-mvp.svg)。

后续报告指出，此扩展主要解决可递归语法，没有自动解决全局行列对齐、空组合、视口虚拟化和跨 pane 状态。递归 facet group 与多个独立 Vega View 是两种不同机制。

### 1.2 2026-10-10：二维虚拟化与业务演示

研究目录：`/Users/observedobserver/Documents/Codex/2026-10-10/task-3/research`。

- [深度报告 REPORT.zh.md](/Users/observedobserver/Documents/Codex/2026-10-10/task-3/research/REPORT.zh.md)。比较全量 facet、固定视口 clip、窗口内多 View、filter 和索引供数单 View。
- [多记录业务演示说明 BUSINESS-DEMO.zh.md](/Users/observedobserver/Documents/Codex/2026-10-10/task-3/research/BUSINESS-DEMO.zh.md)。有多层表头、原始交易、显式小时聚合、空组、tooltip、校验及带坐标轴的基准。
- [可独立打开的业务演示 business-preview.html](/Users/observedobserver/Documents/Codex/2026-10-10/task-3/research/business-preview.html)。已内嵌依赖，按文档可直接用浏览器打开。
- [复现与产物清单 README.md](/Users/observedobserver/Documents/Codex/2026-10-10/task-3/research/README.md)。

这份业务演示采用外层 host 管理窗口、每个非空可见 pane 挂载 unit View，移出窗口后释放。它最接近“嵌了很多 Vega-Lite 实例”的描述；尚未从原会话确认它就是用户当时看过并认为效果不理想的那版。

历史报告的关键边界：clip 能限制画布分配，但不等于减少全部场景对象和 subflow；窗口数据不能代替全局聚合、domain 与排序。报告中的无坐标轴最小基准和带真实坐标轴业务基准应分别阅读。

### 1.3 2026-10-10：Graphic Walker 官方升级与多图组合

研究目录：`/Users/observedobserver/Documents/Codex/2026-10-10/task-5/research`。

- [Graphic Walker 官方升级与多图组合研究](/Users/observedobserver/Documents/Codex/2026-10-10/task-5/research/REPORT.zh.md)。检查真实 `toVegaSpec`、多 View、Observable Plot、导出与交互，评估有限的官方 repeat → facet 适配路线。
- [复现说明 README.md](/Users/observedobserver/Documents/Codex/2026-10-10/task-5/research/README.md)。

报告认为官方 repeat 是组合简写，不能自动提供任意深度工作表或二维虚拟化。依赖升级与新工作表引擎应分别评估。版本建议仅代表 2026-10-10 的历史研究，本次没有重新核查最新版本。

以上早期材料的文件已找到；本次未在可检索的 Codex 聊天列表中确认其原始聊天标题或 ID。

## 2. Tableau 本机机制研究

- [完整报告](/Users/observedobserver/Documents/tableau-research/tableau-desktop-2022.2.md)，研究日期为 2026-10-22，对象为本机 Tableau Desktop 2022.2.4。
- [工作簿 XML 摘录](/Users/observedobserver/Documents/tableau-research/evidence/workbook-excerpts.md)，含实际 Rows/Columns 表达式。
- [动态库符号摘录](/Users/observedobserver/Documents/tableau-research/evidence/symbol-excerpts.md)，含 VizQL、TableExpression、表头、分区和布局相关符号。
- [版本与文件校验清单](/Users/observedobserver/Documents/tableau-research/evidence/manifest.json)。

优先阅读完整报告第 2–4 节，理解 `Nest /`、`Cross *`、`Concat +`，以及表头、pane 与标记粒度的区分；第 9 节讨论复现时的模块划分。附录保留原生应用与渲染栈调查。

证据边界：有本机动态库符号和真实工作簿 XML，没有私有源码、反编译算法或运行时调用追踪。本机停在激活窗口，没有完成拖拽实验。报告已区分确认事实和实现推断。

## 3. 从 Tableau 研究延伸出的 Graphic Walker 设计与 V0

[设计文档](./tableau-style-worksheet-design.md) 已明确建议自建工作表语义和布局，首个后端直接使用 Vega，保留替换为自建 Canvas 的边界。新工作表不以 Vega-Lite 为中间表示。

重点定位：第 2 节记录现有 GW 的字段裁剪和单层 facet 限制；第 3–7 节定义模型、查询及布局；第 8 节比较渲染路线；第 11–13 节列改造范围、阶段和验收。

[V0 说明](../packages/worksheet-renderer/README.md) 对应 `packages/worksheet-renderer`。当前源码确认屏幕使用一个 Vega Canvas View，接收已计算好的像素图元，没有调用 Vega-Lite。实现包含递归表达式、多度量、折叠重聚合、范围策略、窗口渲染、选择及 SVG 导出。

代码入口：

- [types.ts](../packages/worksheet-renderer/src/types.ts)：工作表格式和协议。
- [compiler.ts](../packages/worksheet-renderer/src/compiler.ts)：表达式展开、查询规划和执行。
- [model.ts](../packages/worksheet-renderer/src/model.ts)：路径、pane、domain 与堆叠。
- [scene.ts](../packages/worksheet-renderer/src/scene.ts)：像素布局与窗口裁剪。
- [vegaBackend.ts](../packages/worksheet-renderer/src/vegaBackend.ts)：图元到 Vega 及 SVG 导出。
- [Worksheet.tsx](../packages/worksheet-renderer/src/Worksheet.tsx)：生命周期、滚动与交互。
- [Playground 示例页](../packages/playground/src/examples/pages/worksheetRenderer.tsx)：运行 Playground 后的路径为 `/examples/Worksheet_Renderer`。

V0 尚未接入旧编辑器、历史记录及完整存储流程，也缺少冻结表头、多标记层、双轴、LOD 和表计算等能力。性能仍需正式基准。README 中的测试通过记录属于历史记录，本次未重跑。

本次检查时，设计文档、新渲染包和示例文件仍是未被 Git 跟踪的本地文件，另有 Playground 配置改动。后续立项应将这批本地产物纳入版本管理。

## 4. 已确认的历史聊天

聊天标题：**研究 Tableau 图表嵌套机制**。

- 聊天 ID：`01a164ab-b9c5-74a0-958a-fb8a674bac32`。
- 主机：`local`。
- 工作目录：`/Users/observedobserver/Documents/GitHub/graphic-walker`。
- 2026-10-22 10:32，开始 Tableau 本机嵌套机制研究。
- 2026-10-22 10:42，继续要求结合 Graphic Walker 设计多层嵌套方案，并评估自建渲染路线。
- 2026-10-22 12:09，开始实现独立渲染包 V0，随后交付演示入口。

时间均为 America/Los_Angeles。此聊天的完整记录确认了 Tableau 调研、GW 设计和直接 Vega V0 三个阶段；早期 Vega-Lite 实验的原始聊天尚未定位。
