# 自有工作表渲染器实施记录

2026-11-07 后续：S4 已完成图表类型扩展与 GW 箱图统计供给，独立门禁通过。见 [S4 设计与验收范围](./worksheet-renderer-chart-types.md)。以下 S0–S3 记录对应此前冻结版本。

日期：2026-11-06。S0–S3 已按约定实现并分别提交至同一 draft PR。独立 Sol 代码审核和 Terra 浏览器验收均通过；最终有 473 项 GW 测试、226 项渲染库测试、114 项三引擎浏览器回归、类型检查、生产构建与仓库外 fresh tarball 消费证据。

R01–R17、A01–A16 和 B1–B5 的首版门禁已按本文证据关闭。最终 76 文件候选指纹为 `04f08b1acc58d29a9d609e3dcb645b859973a79035fba05eba724289865aa6b6`，GW 浏览器资产指纹为 `d8a42531535a4b20f38305dac42a7b987ebadbc9b4bbfd7c8df9372976c75812`。S2 与 S3 均在真实 60 Hz、1440×900、DPR 2 完成规定样本；显示设置已恢复 ProMotion。独立真实 Safari 复验 bin→fold，Chromium 验证两个宿主的过期及当前请求错误；WebKit 自动化不代替 Safari。

本记录追踪 [需求与验收](./worksheet-renderer-requirements.md)、[技术设计 v0.4](./worksheet-renderer-design.md) 和 [alignment v0.4](./worksheet-renderer-alignment.md)，不扩大批准范围。**现有 IChart 仍是用户保存的可视化 specification；RenderPlan 是临时显示参数。** GW 现有计算 DSL、SQL 和 computation 负责结果，本库只消费准备好的值，不引入 VizQL、LOD、表计算、聚合引擎、查询规划或数据库 provider。

Canvas 模式的表头、轴、主体、选择与焦点高亮共用一个可见 Canvas；不按 pane 拼接图表实例。Canvas 与 SVG 共用布局、几何、clip、命中和语义，使用低层格式化工具，不依赖 Vega-Lite、Observable Plot 等整图引擎完成 native 渲染。

## 阶段与提交门禁

所有阶段进入同一个 [draft PR #528](https://github.com/Kanaries/graphic-walker/pull/528)。阶段划分安排实施顺序，不把 R/A/B 条目变成可选项。每个阶段提交前需通过独立代码审核；涉及 UI 的变更还需独立浏览器验收。旧候选的通过不自动覆盖新修改。

| 阶段 | 交付范围 | 状态 |
| --- | --- | --- |
| S0 | IChart → 纯 adapter → 自有 Canvas/SVG；冻结头、版本供数、超长滚动 | 2026-11-06 提交 `feat(worksheet): establish native rendering and window contracts`；58 项测试与独立门禁通过。提交标识 `b4e3be7c`。 |
| S1 | 五 mark、统一布局与域、受控顺序/折叠、选择与事件 | 2026-11-06 提交 `feat(worksheet): add marks, display scopes and controlled interaction`；126 项测试与独立门禁通过。提交标识 `6534b263`。 |
| S2 | 窗口调度、共享预算、几何缓存、分页导出、规模与生命周期 | 2026-11-06 提交 `feat(worksheet): add bounded virtualization and range exports`；202 项阶段测试、独立代码/浏览器和原定 60 Hz 门禁通过。提交标识 `540df460`。 |
| S3 | GW renderer、正规化/保存/历史、公开 API、局部兼容 | 2026-11-06 提交 `feat(graphic-walker): integrate native worksheet renderer`；最终代码、功能、60 Hz 性能和构建消费门禁通过。 |
| S4 | circle/tick/area/trail/arc/boxplot、normalize/center、rect/text size、GW 箱图统计结果 | 2026-11-07 提交 `feat(worksheet): support extended marks and prepared boxplots`；298 库测试、473 GW 测试及4 snapshots、162 三引擎回归与最终48项复验、独立审核和 fresh consumer 通过。 |

代码审核使用独立 `gpt-6.1-sol`、`xhigh`；浏览器验收使用独立 `gpt-6.1-terra`、`xhigh`。实施方工程测试、独立审核和独立浏览器证据分别保存。

## 证据索引

下文用 E0–E10 指向记录。各报告保留具体环境、候选指纹、原始失败、修复和复验；本文汇总当前状态，不删除历史失败。

| 编号 | 记录及范围 |
| --- | --- |
| E0 | S0 [代码审核](./verification/s0/code-review.md)、[浏览器验收](./verification/s0/browser-acceptance.md)：独立包、单 Canvas、冻结与首尾定位、resize、事务失败。 |
| E1 | S1 [代码审核](./verification/s1/code-review.md)、[浏览器验收](./verification/s1/browser-acceptance.md)：五 mark、十 fixture、完整 commands/hits 对照、交互及双轴受控更新。 |
| E2 | S2 [代码审核](./verification/s2/code-review.md)、[浏览器验收](./verification/s2/browser-acceptance.md)：以“冻结候选复验”及其后补证为准，涵盖调度/预算、A06/A07、导出、规模和生命周期。 |
| E3 | [B4 补证](./verification/s2/b4-browser-supplement.md)：普通/压缩轴组合、resize、Home/End、实际原生滚动条拖动、受信任小数双轴 wheel 及递减模拟惯性。 |
| E4 | [真实 VoiceOver 补证](./verification/s2/accessibility-final.md)：Safari/macOS 的摘要、位置、展开状态与按需数据行，证据为字幕和键盘路径。 |
| E5 | [规模数据及复现](./verification/s2/benchmark-data.md)、E2 链接的 final JSON：真实 B3 输入、完整准备链路、Node 内存、浏览器 CPU/呈现/账本/回收。 |
| E6 | S3 [独立代码审核](./verification/s3/code-review.md)、[候选清单](./verification/s3/candidate-manifest.json)：76 文件 `04f08b…`，含查询 owner/race、旧 renderer 和 retained handle 修复复核。 |
| E7 | S3 [独立浏览器验收](./verification/s3/browser-acceptance.md)：真实 GW 计算、字段/过滤/历史、公开导出、三 renderer 对照与最终 Safari。 |
| E8 | S3 [集成工程验证](./verification/s3/integration-engineering.md)、[组件工程验证](./verification/s3/component-engineering.md)：全量测试、真实 StrictMode、构建、三引擎回归与新 tarball 消费；不替代 E6/E7。 |
| E9 | 最终薄项补证：[五 mark 几何](./verification/s2/geometry-result.json)、[长中英文几何](./verification/s2/geometry-long-result.json)、[DPR](./verification/s2/dpr-browser-result.json)、[非首位锚点](./verification/s2/anchor-result.json)、[不同单位 fixture](./verification/s2/unit-domain-harness.ts)。对应复现为 `geometry-acceptance.cjs`、`geometry-long-acceptance.cjs`、`dpr-browser-probe.cjs`、`anchor-probe.cjs`；单位结果纳入 E2。 |

E10：最终 [S2 60 Hz 性能](./verification/s2/performance-60.md)、[S3 60 Hz 性能](./verification/s3/performance-60.md) 与 [显示环境恢复](./verification/s2/reference-refresh-rate.md)。报告保存完整原始数据、脚本、实际刷新率和各阶段 bundle 指纹。

S0/S1 的 Playwright WebKit 记录不称为真实 Safari。S2/S3 后续有真实 Safari 证据；114 项三引擎自动化中的 WebKit 仍按其实际引擎名称记录。

## 实现与复现入口

| 入口 | 职责 |
| --- | --- |
| [子包 README](../packages/worksheet-renderer/README.md)、[GW 接入说明](./worksheet-renderer-integration.md)、[VL 输入兼容清单](./worksheet-renderer-vl-import.md) | 独立嵌入、公开 API、支持边界、现有输入的保留与诊断。 |
| [core](../packages/worksheet-renderer/src/core/types.ts) / [prepared](../packages/worksheet-renderer/src/core/prepared.ts) / [domains](../packages/worksheet-renderer/src/core/domains.ts) | 版本数据合同、typed 身份、稀疏成员树、并列槽、完整域和联合系列；精确父记录，不推导父值。 |
| [reader](../packages/worksheet-renderer/src/runtime/reader.ts) / [resources](../packages/worksheet-renderer/src/runtime/resources.ts) | 共享并发、去重、范围合并、续页、优先级、取消、字节 LRU 和活动帧预算。 |
| [scene](../packages/worksheet-renderer/src/scene/build.ts) / [cache](../packages/worksheet-renderer/src/scene/cache.ts) / [backends](../packages/worksheet-renderer/src/backends/svg.ts) | 共用布局/命中、pane 局部几何缓存、单 Canvas、SVG keyed 更新和组平移。 |
| [runtime](../packages/worksheet-renderer/src/runtime/worksheet.ts) / [semantic](../packages/worksheet-renderer/src/runtime/semantic.ts) / [export](../packages/worksheet-renderer/src/export/range.ts) | 输入事务、受控请求、滚动/焦点、选择、按需语义数据、固定版本的视口/范围/分页导出。 |
| [NativeRenderer](../packages/graphic-walker/src/vis/native-renderer.tsx) / [results](../packages/graphic-walker/src/lib/native/results.ts) / [adapter](../packages/graphic-walker/src/lib/native/adapter.ts) | 消费 GW 原 computation 结果，映射现有 IChart，保存 raw 值和身份，接入主题、事件和既有公开 ref。 |

窗口读取默认最多 4 个实际 provider 调用并行。取消后未返回的 provider 仍占物理槽；元数据、视口、续页、预取和导出按优先级调度。窗口、域、轴、几何缓存及活动帧共用 128 MiB 预算，完整输入/索引和 Canvas 位图另报。热滚动复用不可变窗口及 pane 几何，SVG 使用组变换，Canvas/SVG 保持同一全局命中合同。

连续滚动保留实际相交的边缘格。名义容量最多 100 个完整格，10×10 视口偏移 1 px 可相交 11×11 格，长条视口最多 202 格；整窗最多 40,400 条记录，单 pane 最多 20,000 条。可见 Canvas marks 仍限 20,000，SVG 仍限 5,000 hits/10,000 元素；不以采样或删数据达标。

视口导出默认等待目标完整，不返回 stale 旧帧；显式占位导出另行标识。范围导出固定源版本、plan、字体与布局，独立低优先级 reader 读取未访问数据，逐页交付 sink。页数、字节、读取、时间均有上限；取消和销毁释放任务及保留资源。UI 更新不修改正在导出的旧快照。

仓库根目录可运行以下检查；正式浏览器/性能复现使用报告内固定端口、环境与构建，避免测到不同候选。

```sh
npm --workspace @kanaries/worksheet-renderer run typecheck
npm --workspace @kanaries/worksheet-renderer test
npm --workspace @kanaries/graphic-walker test -- --runInBand
npm run build
node scripts/consumer-smoke-test.mjs
```

## 首版需求 R01–R17

“已覆盖”指该项实现及列出的验收证据齐备；性能结果见 E10 与后文，保留各项测量边界。

| ID | 实现与可追溯证据 | 状态 |
| --- | --- | --- |
| R01 独立子包 | core ESM/声明与独立 `/react`；不依赖 GW store；NodeNext/原生 ESM、正式构建和 fresh tarball consumer 通过。E0/E2/E6/E8。 | 已覆盖。 |
| R02 自有双后端 | 五 mark 共用 Scene/clip/命中，Canvas 与原生 SVG 支持显示/更新/滚动/选择；keyed 节点与 defs 回收；实际调用/CTM 几何补证。E1/E2/E9。 | 已覆盖。 |
| R03 单 Canvas | 一个可见 Canvas 画头轴、主体和高亮；bitmap 随视口/DPR，不随逻辑长度增长；挂载/销毁和实际 DPR 切换已验。E0/E2/E8/E9。 | 已覆盖。 |
| R04 递归行列 | 两轴 3/5/10/20 层、实际路径、并列度量、空交叉和变深叶；真实 GW 20 层保留全部 40 个维度。E2/E7；prepared/adapter/domain 测试。 | 已覆盖。 |
| R05 字段与数据绑定 | field/configRef、typed path、datum/series 身份；完整联合系列顺序；GW bin/binCount、同名 fold、时间 raw 值与事件稳定。E1/E6/E7；native-results 测试。 | 已覆盖。 |
| R06 统一布局 | 父跨度、固定条带、轴/图例、clip、负值/null、不等深路径；中英文长标签测量/截断及实际双后端几何。E1/E2/E9；scene-s1/layout/labels 测试。 | 已覆盖。 |
| R07 冻结与滚动 | 双轴普通/压缩轨道、逻辑/key 定位、首末、resize、DPR1→2→1；Portland 非首位排序保留 20 px 偏移，折 West 回 hidden 祖先 y=0。E0/E3/E9。 | 已覆盖；软件输入证据边界见后文。 |
| R08 有界虚拟化 | 稀疏索引、窗口数据/Scene、共享字节 LRU、范围合并/去重、最多 4 并发；真实百万记录与超长坐标。E2/E5。 | 已覆盖，60 Hz 性能通过。 |
| R09 基础图形 | bar/point/line/rect/text；grouped、正负 stack、零值可访问目标、给定区间、系列隔离/null 断线、cell rect/text。E1/E7；scene-s1 测试。 | 已覆盖。 |
| R10 轴/范围/编码 | band/linear/time、shared/prefix/pane/fixed、颜色/size/opacity/shape/text、格式/图例；滚动域、累计端点和不同单位同时显示已验。E1/E2/E7/E9；domains 测试。 | 已覆盖。 |
| R11 顺序和折叠 | 外部 memberOrder、受控 accepted/rejected/等待态、双轴 exact 父记录、缺父为空；宿主准备显示顺序；非首位锚点。E1/E2/E7/E9；native-display 测试。 | 已覆盖，不计算缺失父值。 |
| R12 统一交互 | tooltip、单选/修饰键多选/框选/clear、line 两端点、精确 tuple、键盘；GW 原字段/raw/version 事件；滚动排序/切后端保身份。E1/E2/E7。 | 已覆盖；60 Hz 交互计时通过。 |
| R13 GW 配套接入 | renderer、字段/过滤/聚合设置、格式、保存/历史、四 ref、AppRoot/List export；StrictMode、旧 handler 移交、卸载回收。E6/E7/E8。 | 已覆盖。 |
| R14 导出/可访问性 | PNG/SVG 视口、未访问范围/分页/取消；焦点代理、完整名称、100 行按需数据页、真实 VoiceOver；GW 公开导出。E2/E4/E7/E8。 | 已覆盖。 |
| R15 完整性/诊断 | loading/empty/complete/preview/unsupported/resource-limit；乱序拒绝、取消、stale 导出拒绝；旧查询失败不污染当前图，当前错误仍可见。E2/E6/E7。 | 已覆盖；最终 Safari 切换和 Chromium current/stale 复验通过。 |
| R16 现有 spec 入口 | IChart 原样选择 native；后端/主题变更不重查；存储/历史不含 RenderPlan；深层旧后端明确 unsupported，不删字段。E6/E7/E8。 | 已覆盖。 |
| R17 局部兼容 | 声明的 mark/encoding/scale/axis/格式子集；保持原正规化；unsupported transform/params/表达式定位拒绝，合法 aggName/filters 由 GW 处理。E6/E7、兼容清单。 | 已覆盖；未承诺完整 Vega-Lite/VizQL。 |

## 正确性验收 A01–A16

| ID | 可追溯证据 | 状态 |
| --- | --- | --- |
| A01 | E2 独立 B1 双轴 3/5/10/20 层；E7 真实 GW 同四深度，20 层 groupBy/选择保留 40 维；prepared/adapter 验父路径和顺序。 | 已覆盖。 |
| A02 | prepared 明确 2 Region×3 Category×2 Year×2 measure=24 panes，Subcategory 在 pane 内、输入值不变；E1/E2 nested 与 E7 真实宿主。pane 数与可见 hits 分别记录。 | 已覆盖。 |
| A03 | E2 Furniture/Chair、Office/Paper 同轴两真实路径，跨轴四槽两空；prepared/window-contract 无假记录或零值。 | 已覆盖。 |
| A04 | typed key 测试区分 null/字符串、1/字符串、布尔、time/interval、分隔符和不同父同名子；E7 同名 fold 的四身份与 raw 事件。 | 已覆盖。 |
| A05 | E1 双轴折叠显示宿主给定的 70/85、95/115、140/155；West×2026 缺父为空；domains/native-display 验 exact parent 和缺父规则。 | 已覆盖。 |
| A06 | E2 shared/prefix/pane/fixed 滚动/切后端不变；完整 pane 极值、fixed [−500,500]、stack [−96,147]；E9 同时显示 Sales USD 轴 0/97.5/195 和 Profit percent 轴 −31/0/31，未误共享；domains 的 unitKey/family 合同补充。 | 已覆盖。 |
| A07 | E2 指定 East/Chair、West/Paper 实际 click/Meta，仅两个 datum/raw tuple；滚出滚回、host 重排及切 SVG 后保持，无交叉展开或查询谓词。 | 已覆盖。 |
| A08 | E1 十 fixture 完整 commands/hits 相等；E9 五 mark 与中英文实际 Canvas calls 对照 SVG CTM/clip，最大几何误差 ≤5.7×10⁻¹⁴ CSS px；共享 text/identity。 | 已覆盖 ≤1 CSS px 几何目标；AA 差异允许，不声称逐像素完全相等。 |
| A09 | reader/runtime 的版本、乱序、取消及 coverage 合同；E2 loading/preview/empty 分离；E7 Latest 先回/Older 后回只显示新结果，最终 stale reject 无弹窗、当前错误保留。 | 已覆盖。 |
| A10 | 20 层祖先 spans、四区 clip、First/Last/resize/键盘位置；E3 超长双轴；E9 非首位 Portland 排序保留 20 px、West 折叠回 hidden 祖先 y=0。 | 已覆盖。 |
| A11 | E1 line 分 pane/series/null 断线、实际命中两端点；scene-s1 的线 x=−10→20 穿过 [0,10] clip，两端在外仍可命中/框选；rect/text cell 定位。 | 已覆盖。 |
| A12 | E2 未访问范围 reads 127→140、6×4 六页无重漏、父头保留；导出时 UI 换图仍旧 snapshot，取消后队列/export 归零；E7 四 ref 实际下载。 | 已覆盖。 |
| A13 | E7 字段/过滤/Mean、undo/redo、store 保存/重载、受控 props、导入导出；E8 全量旧 IChart/Vega/Plot 回归。PivotTable 6 suites/44 用例覆盖查询、模型、静态视图/格式/时间、折叠排序及公开类型。 | 已覆盖；PivotTable 证据为真实代码路径测试，未冒称独立手工浏览器操作。 |
| A14 | E1 键盘导航/选择/折叠；E2 AX 完整路径/状态与 100 行按需页；E4 真实 VoiceOver 摘要、位置、展开状态和数据；生命周期 DOM 回基线。 | 已覆盖；读屏证据为字幕和键盘路径。 |
| A15 | E7 同 IChart 三 renderer 保留 100/200、1:2 条长、0–200 域及 `.1f`；混合时间间距/raw 对照；切换不增加查询；deep unsupported 不删字段。Plot 格式、Vega 首击修复均复验。 | 已覆盖声明子集；旧 timeUnit 派生 line 选择限制未计入等价通过。 |
| A16 | vlImport/canonical/normalize/legacyCapabilities 固定输入输出；E7 合法 filter/aggregate/format 成功，calculate 与 fold+bin 明确拒绝且 chart/history 不变；原 GW 计算保留。 | 已覆盖声明子集。 |

PivotTable 回归位于 `src/components/pivotTable/{query,utils,view,core,public.types}.test.*` 和 `src/workers/buildPivotTable.test.ts`，包含真实内置 computation 供数及 `PivotTableView` 输出；已纳入 GW 全量 473 项。相关覆盖不应再写为“旧 PivotTable 尚未验证”。

## 规模基准 B1–B5

| ID | 固定规模与证据 | 结论 |
| --- | --- | --- |
| B1 | A01–A16 汇编：五 mark、U1、深层/不等深、空交叉、typed 身份、长中英文、单位/域/格式，以及真实 GW 计算与局部兼容配置。E1/E2/E6/E7/E9。 | 通过；不是由单一 harness 替代全部正确性验收。 |
| B2 | 20 万真实记录、1 万非空 pane、每轴 6 层；30 冷样本、5×300 移动、50 次销毁。 | S2/S3 均在原定 60 Hz 通过，见 E10。 |
| B3 | 100 万真实记录、100,000×1,000 叶、一亿逻辑槽；索引、完整准备、热窗口、Node 峰值与驻留分别记录。 | S2/S3 均通过；不是程序化空表或 B4 的替代结果。 |
| B4 | 10 亿行×100 万列程序化源；混合普通/压缩轨道、首末/远近定位、resize、Home/End、实际原生拖条与 trusted 小数双轴 wheel/Shift/递减惯性。E3。 | 软件合同通过；不声称物理触控板硬件实测。 |
| B5 | 普通及 203,000 记录/5,000 hits 压力版，各有30冷样本、5×300移动、50次销毁；压力轨迹0–20px。 | S2/S3 均通过。23px 的5,033 hits明确拒绝，返回原点恢复；未删 marks 达标。 |

## 最终 60 Hz 性能

参考机器为 Apple M4 Max、64 GiB、macOS 26.5.2，Headless Chromium 151.0.7922.34。系统原生显示设置为 60 Hertz；新浏览器实测空闲 rAF 中位数 16.7 ms。视口 1440×900 CSS px、DPR 2，固定字体和种子；控制时序也按相同尺寸、DPR和刷新率补测。完整方法和逐帧原始数据见 E10。历史120Hz和低分辨率控制时序记录保留，但不作为本表依据。

下表为最终 S3 core 的实际结果；S2 冻结版亦通过，并在其独立报告中保留。Canvas 的16ms预算针对 JS 检索/布局/绘制提交 CPU，不包含等待下一帧的调度；commit墙钟与rAF间隔分列。单位均为 ms，内存为 bytes。

| 场景 | 冷呈现 p95 | 每轮 CPU p95 的最大值 | 热 commit / rAF p95 | 运行时账本峰值 | 50次销毁后heap增长 / DOM |
| --- | ---: | ---: | ---: | ---: | ---: |
| B2 | 85.3 | 3.0 | 20.9 / 18.2 | 48,569,998 | 0.090% / 0 |
| B3 | 35.3 | 2.3 | 20.2 / 18.2 | 17,045,385 | 0.010% / 0 |
| B5 | 85.4 | 4.0 | 22.2 / 18.5 | 48,569,998 | 0.102% / 0 |
| B5-stress | 163.2 | 4.1 | 22.1 / 18.2 | 130,747,140 | 2.849% / 0 |

全部冷呈现小于500ms；Canvas CPU小于16ms且rAF间隔小于33ms；SVG更新提交小于32ms；资源账本低于134,217,728 bytes，生命周期heap增量低于10%，DOM归零。热窗口没有重复源读取；并发4与共享预算合同由独立审核、调度测试和运行时计数共同验证。

B3的30次完整重建中，索引p95为1952.7ms，已有prepared records到呈现为2034.5ms，测试输入生成到呈现为2399.9ms，分别满足3500/4000/5000ms预算。它与预建供数源的500ms冷帧分开计时。最终Node B3保留完整输入与索引时，最大RSS为1,396,998,144 bytes，GC后heapUsed+arrayBuffers为1,038,536,335 bytes，分别小于2GiB和1.25GiB。完整输入/索引、运行时账本与Canvas位图分别披露，不把总heap称为运行时内存。

| 交互预算 | 最终60Hz结果 |
| --- | --- |
| hover/选择≤50ms | S3 Canvas/SVG各50次实际pointer。hover到tooltip DOM p95为0.7/1.3ms；点击到selectionChange为3.1/2.6ms，到下一rAF为17.2/16.1ms。完整rAF记录见E10。 |
| 受控更新≤150ms、等待态≤100ms | 1440×900/DPR2，每种操作10个计时样本。S2折叠/排序提交至committed加两帧p95为29.6/29.4ms，S3为28.5/28.6ms；各12个等待态样本最大均≤0.3ms。模拟宿主550ms等待被排除。 |

rAF 回调、DOM mutation 和提交时间按报告的实际测量含义使用，不称为物理光子时间。真实 VoiceOver 字幕不称为录音。trusted 软件 wheel/模拟惯性不称为物理触控板手势；这些边界不额外增加原需求未规定的硬件验收条件。

## 交付状态

R01–R17、A01–A16、B1–B5以及构建消费、现有spec保存/历史/输入正规化/切换与旧路径回归均已通过本文所列门禁。所有阶段在同一draft PR中保留独立commit和审核记录；没有发布npm包或合并PR。

S3按独立审核的76文件清单逐一核对S2基线和最终SHA后转入主工作树，内容与已验收候选一致；转入后再次完成生产构建并复核指纹。`.gitattributes`只将验证目录中的原始JSON标为generated，便于审查产品diff，原始测量与失败记录完整保留。显示器已恢复ProMotion。

已准备数据的完整/按需两种入口都属于交付。新计算DSL、VizQL和LOD不属于本项目。双轴、多mark层、地图和超预算单pane仍按既有范围保留明确诊断或旧路径，不把它们计入本版已支持能力。


## S4 增量验收

用户在 2026-11-07 要求继续补图表类型，并明确授权同时扩展 GW 计算层以供给箱图统计，图表库仍只接收已算结果。新增范围与限制以 [图表类型文档](./worksheet-renderer-chart-types.md) 为准。

最终产品 fingerprint 为 `0e4eae5a7caafa11c21a857c37aff4bb23a62db7bd8938a77fea4a1a006f520c`，51 文件 [清单](./verification/s4/source-manifest.json) 自身 SHA256 为 `73ebd4e6db155a6625c3021fea1c1276e344c1483220f2e925edde72721f9638`。独立 [Sol 审核](./verification/s4/code-review.md)、[Terra 浏览器验收](./verification/s4/browser-acceptance.md) 和 [工程检查](./verification/s4/engineering-validation.md) 均通过。

完整162项浏览器回归对应圆环近孔容差修复前构建；最终仅调整内孔排除后，fresh build 上48项新增图形三引擎回归与独立查询、选择、导出、命中和滚动探针重新通过。旧性能数据不重标为 S4 测量。最终库构建、声明检查、仓库外 fresh tarball 安装与 Vite 构建均通过。
