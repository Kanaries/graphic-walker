# 自有工作表渲染器实施记录

日期：2026-11-06。S0 已提交为 `feat(worksheet): establish native rendering and window contracts`，提交标识 `b4e3be7c`。S1 已有本文列出的实现与回归证据，候选已通过提交门禁，126 项测试、严格类型检查、构建和 diff 检查通过，独立 Sol/Terra 最终结论均为 PASS。S2/S3 未完成，当前不具备首版发布条件。

本记录追踪 [需求与验收](./worksheet-renderer-requirements.md)、[技术设计 v0.4](./worksheet-renderer-design.md) 和 [alignment v0.4](./worksheet-renderer-alignment.md)，不修改批准范围。IChart 继续是用户保存的权威格式；RenderPlan 是临时显示参数。现有 GW 计算 DSL/SQL 负责结果，库不新增聚合、过滤、表达式、查询规划或数据库 provider。

## 实施与提交门禁

所有阶段进入同一个 [draft PR #528](https://github.com/Kanaries/graphic-walker/pull/528)，S0、S1、S2、S3 分阶段提交。阶段划分只安排实施顺序，不能把未完成的 R/A/B 项变成可选项。

每个 commit 必须先通过独立 subagent 的代码 review，指定 `gpt-6.1-sol`、reasoning effort `xhigh`。涉及 UI/UX 的变更还须由独立 agent session 进行 browser use 验收，指定 `gpt-6.1-terra`、reasoning effort `xhigh`。发现问题后修改并复审、复验，所需门禁全部通过后才能 commit。旧构建的通过结果不能代替后续变更的验收。

S0 的独立 [代码复审](./verification/s0/code-review.md) 与 [浏览器复验](./verification/s0/browser-acceptance.md) 已 PASS，58 项测试通过。浏览器覆盖 Chromium 和 Playwright WebKit；后者不等同于 Safari 发布版，Firefox 因缺少本地缓存未验收。S1 的 `s1_review` [代码复审](./verification/s1/code-review.md) 与 `s1_browser_acceptance` [浏览器验收](./verification/s1/browser-acceptance.md) 均为 PASS。代码审核包括126项测试、NodeNext/原生ESM消费、独立探针和稳定内容指纹；浏览器覆盖Chromium全面验收与Playwright WebKit smoke，未代替正式Safari/Firefox验收，也未关闭S2/S3要求。

| 阶段 | 交付范围 | 当前状态与退出条件 |
| --- | --- | --- |
| S0 | IChart fixtures → 纯 adapter → 自有 Canvas/SVG 纵切；冻结头、版本供数、超长滚动 | 已按门禁提交；保留报告及 58 项测试证据 |
| S1 | 五种 mark、布局与域、顺序/折叠请求、统一选择与事件 | 已实现下列能力，冻结候选的 126 项测试、类型检查和构建通过；独立代码与浏览器门禁均通过，可创建阶段commit |
| S2 | 范围调度、字节预算、窗口缓存、分页导出、真实规模与生命周期基准 | 待完成；preview/补页和范围导出有实际语义，B2/B3/B5 有真实记录与可复现测量 |
| S3 | GW renderer、正规化/输入、保存/历史、公开 ref/callback、局部兼容 | 待实施；同一 IChart 切换不丢语义，旧后端和导入导出回归通过 |

## 当前代码与验证入口

| 入口 | 证据范围 |
| --- | --- |
| [子包 README](../packages/worksheet-renderer/README.md) | 当前 API、独立嵌入、React 入口、脚本及限制 |
| [core/types.ts](../packages/worksheet-renderer/src/core/types.ts)、[prepared.ts](../packages/worksheet-renderer/src/core/prepared.ts)、[keys.ts](../packages/worksheet-renderer/src/core/keys.ts) | 版本供数、typed 身份、实际成员树、并列槽、稀疏索引、不等深可见叶与父记录 exact-match |
| [domains.ts](../packages/worksheet-renderer/src/core/domains.ts)、[series.ts](../packages/worksheet-renderer/src/core/series.ts) | shared/prefix/pane/fixed 域统一请求与查询，实际 joint series 身份及顺序 |
| [validateWindow.ts](../packages/worksheet-renderer/src/core/validateWindow.ts)、[capabilities.ts](../packages/worksheet-renderer/src/core/capabilities.ts) | 完整性、版本、rank/key/slot/顺序/路径/原值校验，locate 身份验证，当前能力准入 |
| [GW adapter](../packages/graphic-walker/src/lib/native/adapter.ts)、[presentation.ts](../packages/graphic-walker/src/lib/native/presentation.ts)、[scenarios.ts](../packages/graphic-walker/src/lib/native/scenarios.ts) | IChart 到显示参数，准备列绑定、展示优先级、静态 scales 与完整输入 callback 解析；五 mark 场景 |
| [scene/build.ts](../packages/worksheet-renderer/src/scene/build.ts)、[marks.ts](../packages/worksheet-renderer/src/scene/marks.ts)、[scales.ts](../packages/worksheet-renderer/src/scene/scales.ts)、[text.ts](../packages/worksheet-renderer/src/scene/text.ts) | 共同几何、clip、轴/图例、命中、文本测量与低层 d3 数值/UTC 日期格式化 |
| [runtime/worksheet.ts](../packages/worksheet-renderer/src/runtime/worksheet.ts)、[requests.ts](../packages/worksheet-renderer/src/runtime/requests.ts)、[semantic.ts](../packages/worksheet-renderer/src/runtime/semantic.ts) | 输入事务、readonly 状态/事件、受控请求、选择/焦点、按需语义数据与视口导出 |
| [react.ts](../packages/worksheet-renderer/src/react.ts) | React 独立入口、单控制器生命周期、input 更新与卸载清理 |
| [adapter tests](../packages/worksheet-renderer/tests/adapter.test.ts)、[adapter S1 tests](../packages/worksheet-renderer/tests/adapter-s1.test.ts) | 真实 IChart、U1、深层字段、fold/count/raw、五 mark 到 Scene、格式/作用域/展示优先级 |
| [prepared tests](../packages/worksheet-renderer/tests/prepared.test.ts)、[domain tests](../packages/worksheet-renderer/tests/domains.test.ts)、[window contract tests](../packages/worksheet-renderer/tests/window-contract.test.ts)、[location tests](../packages/worksheet-renderer/tests/location-contract.test.ts) | 稀疏覆盖、固定域无需统计、scope 隔离、父记录/缺父空槽、完整 series、错误外源响应与定位拒绝 |
| [scene S1 tests](../packages/worksheet-renderer/tests/scene-s1.test.ts)、[backend tests](../packages/worksheet-renderer/tests/backends.test.ts)、[scale tests](../packages/worksheet-renderer/tests/scales.test.ts) | 五 mark、断线/顺序、区间边界、分组/堆叠、图例与命中、SVG 节点复用和资源门限 |
| [runtime tests](../packages/worksheet-renderer/tests/runtime.test.ts)、[request tests](../packages/worksheet-renderer/tests/requests.test.ts) | 候选失败保留旧提交、固定域不读统计、只读快照、source/selection 变化、定位安全、取消和请求状态 |
| [受控 demo](../packages/worksheet-renderer/demo/controlled.ts) | 两轴 Region/City × Year/Quarter，host 550 ms 后确认；明确父常量，缺父值为空，展开恢复稳定 datum |
| [S1 浏览器验收](./verification/s1/browser-acceptance.md) | 真实 Canvas/SVG 五 mark、tooltip/多选/框选、键盘、SVG 回收、三种scope和受控双轴更新通过；WebKit smoke通过 |

冻结候选已通过包级严格 TypeScript 检查、126 项测试、构建和 diff 检查，demo bundle 也已验证。构建脚本同时生成根入口、React 入口、共享 ESM chunk 与声明，并规范声明的相对 ESM 引用。独立报告已核对这份冻结构建的内容指纹。外部strict NodeNext消费、原生ESM导入、根入口依赖检查和pack dry-run均通过；真实React宿主生命周期与正式发布仍未完成。

仓库根目录命令：

```sh
yarn workspace @kanaries/worksheet-renderer typecheck
yarn workspace @kanaries/worksheet-renderer test
yarn workspace @kanaries/worksheet-renderer build
yarn workspace @kanaries/worksheet-renderer dev
```

## 首版需求 R01–R17

“已有”指实现及列明证据，不等于完整首版通过。含待办的行继续保持开放。

| ID | S0/S1 已有证据 | 仍需完成 |
| --- | --- | --- |
| R01 独立子包 | 根 ESM、声明、独立 `/react`；外部NodeNext/ESM消费、依赖检查和pack dry-run通过；仅低层d3格式化 | 真实React宿主生命周期与正式发布消费复验 |
| R02 自有双后端 | 五 mark 共用 Scene/clip/命中；最终浏览器多场景 commands/hits 相同；SVG keyed 更新与节点回收测试 | B5正式规模、更新与回收测量 |
| R03 单 Canvas | 一个可见 Canvas 共画表头/轴/主体/高亮；位图随视口分配；内部测字使用独立非可见工具 | 固定 DPR/规模场景的持续验收及生命周期报告 |
| R04 递归行列 | 两轴 3/5/10/20 层字段保留；实际路径、并列槽、空交叉；不等深父叶；U1=24 pane | 两轴同时全部深度的实际 UI 验收及产品字段操作全链路 |
| R05 字段与数据绑定 | binding/fieldRef、typed path、datum 与实际 joint series 身份；count/fold/expr/raw；完整系列序、跨快照选择重新验证 | GW 生产结果身份与全部真实结果映射复验 |
| R06 统一布局 | 父跨度、冻结区、轴/图例、共同 clip、文本测量/截断、不等深可见叶、负值/null 规则 | 长文本/中英文及全部不等长层级固定用例的最终双后端验收；固定步长属于设计允许基线 |
| R07 冻结与滚动 | 双轴滚动、首尾/按 key 跳转、align、resize/DPR 监听、focus、折叠 hidden 祖先锚点；locate 回应校验 | 折叠/重排锚点与焦点完整复验、触控板及正式跨浏览器矩阵 |
| R08 有界虚拟化 | 稀疏索引、非空目录、窗口 Scene、8 窗口缓存、压缩轨道，无 R×C 对象矩阵 | 字节预算、相邻范围合并/去重、总并发/优先级/预取、B3 正式规模和内存 |
| R09 基础图形 | bar/point/line/rect/text；分组柱、正负零点堆叠、给定区间端点、系列隔离与 null 断线 | B1全部固定输入与clip边界系统验收 |
| R10 轴/范围/编码 | band/linear/time；shared/prefix/pane/fixed；zero/nice/reverse/range；颜色/size/opacity/shape/text、轴选项和图例；固定域无需统计 | 滚动完整域不变量和单位边界的最终验收，正式局部兼容 fixture 全覆盖 |
| R11 顺序和折叠 | memberOrder、axisMembers/getRecordPath；双轴受控请求状态、明确父记录、缺父空槽；demo 异步 accepted/rejected 协议 | 生产宿主接入与规模下锚点/顺序更新验收 |
| R12 统一交互 | tooltip、精确多选、框选、clear、受控 selection、焦点；line segment 两端点与 hitPoint；版本事件 microtask 通知 | 指定 tuple 的排序/滚动/后端往返最终验收及 GW 公开事件适配 |
| R13 GW 配套接入 | 纯 IChart adapter、展示优先级和完整结果 callback/static scales；无库内 computation | 产品 renderer、过滤/折叠准备结果、字段操作、存储、历史和公开 ref/callback |
| R14 导出/可访问性 | 视口 PNG/SVG、焦点代理、可访问名称/摘要、Visible data 每页最多100可见项、键盘折叠/排序请求 | PNG 完整浏览器验收，未访问范围/分页/取消，正式屏幕阅读器与 DOM 上界测量 |
| R15 完整性/诊断 | 完整窗口校验、过期取消、候选失败保留旧画面/选择；requested/committed/displayed 状态区分；请求超时/拒绝/取代 | preview/部分加载/补页、统一资源/字节预算和导出取消；已通过的事务合同在S2调度中持续回归 |
| R16 现有 spec 入口 | IChart fixture 原样映射，无第二套持久化 spec；demo 切换 plan/source/backend | 生产 layout.renderer 接入，切换/保存/重载不丢字段，旧后端深层 unsupported |
| R17 局部兼容 | 五 mark/channel/scale/axis/style 子集准入；theme→host→layout 优先级，格式与 callback 边界明确 | 既有正规化入口、原始 VL-like 输入诊断/保留策略和所有批准配置固定用例 |

## 正确性验收 A01–A16

| ID | 当前可核对的证据 | 待验收部分 |
| --- | --- | --- |
| A01 | adapter 两轴3/5/10/20层；prepared 20层祖先窗口；八层真实 demo；不等深路径与slot顺序校验 | 两轴同时全部深度的完整布局、成员排序和显示断言 |
| A02 | U1 24 pane，24输入记录对应48槽位引用，值不变；adapter→source→Scene | 产品数据准备接入后的端到端复验 |
| A03 | 同轴实际联合路径、跨轴空覆盖；缺父空槽不建假记录；窗口不物化稠密交叉 | 指定 Furniture/Chair、Office/Paper 两布局的完整双后端固定场景 |
| A04 | typed key 区分 null/字符串/数值/布尔/time/interval及分隔符；给定区间几何保留端点 | 产品导入、排序及事件的身份断言 |
| A05 | 双轴 axisMembers/getRecordPath；只显 exact-match 父记录；demo父值70/85、95/115、140/155，West×2026无父值为空 | S1固定fixture点击/键盘与宿主确认已通过；S3真实宿主复验 |
| A06 | 完整 shared/prefix/pane/fixed 域、不同单位family、空scope、stack累计端点；固定域缺统计可用；Domains每Region有两个不同范围pane | 随滚动/跳转/后端切换的完整域不变量最终复验 |
| A07 | 精确 datum/segment tuple；浏览器验收双目标多选/框选和后端切换；跨快照refresh/source变更清除单测 | 指定 East/Chair 与 West/Paper 的排序、滚出滚回、pending恢复完整任务 |
| A08 | 五 mark 共用 Scene；浏览器验收多场景 commands/hits一致；线段圆帽与命中、字体/clip共用 | 全部固定输入下文字/焦点/选择及1 CSS px目标系统验收 |
| A09 | 过期/部分/错key响应拒绝；候选事务、取消兄弟读取、失败保留旧提交、readonly快照、微任务事件回归 | 已通过的事务合同在S2调度中持续回归，preview/加载/真实空组合与S2乱序调度全组合 |
| A10 | 祖先跨窗口、冻结clip、首末位/resize、逻辑坐标往返；locate匹配请求，hidden祖先验证；focus接口 | 折叠后锚点与焦点任务复验，正式浏览器矩阵 |
| A11 | line按pane/series隔离、null断线、显式sequenceOrder；cell rect/text定位；浏览器实际点线段返回端点 | 裁剪边界线段、全部固定输入与最终双后端复验 |
| A12 | 视口SVG实际下载，PNG实现；错误/缺覆盖拒绝导出 | 未访问逻辑范围读取、分页无遗漏重复、PNG实测、取消及导出资源释放 |
| A13 | adapter不改IChart；React独立input封装和运行时受控状态 | 产品保存/重载/undo/redo/导入导出、所有旧路径回归 |
| A14 | 焦点代理/箭头/H/Enter/S/Escape、摘要、Visible data按100项分页；实际键盘发出选择与请求 | 完整键盘折叠往返、屏幕阅读器位置/展开状态、语义DOM上界正式测量 |
| A15 | IChart字段/聚合标签/time/fold/count绑定，format/有效域/外部scale映射 | 同IChart三renderer对照、renderer/useSvg切换编辑无损和深层旧后端诊断 |
| A16 | 当前五mark/channel/scale/axis/style子集有准入和unsupported测试；回调完整输入与windowed静态边界 | 原始输入transform/params/表达式的正规化诊断与完整批准兼容清单 |

## 规模基准 B1–B5

| ID | 当前证据 | 仍需完成的正式基准 |
| --- | --- | --- |
| B1 显示语义集 | U1、五mark、格式/域/图例、typed身份、缺值、受控父记录与作用域fixture；已列出的真实浏览器场景 | A01–A16全部固定输入、长文本/单位和局部兼容的完整B1基准汇编 |
| B2 日常工作表 | 窗口记录上限、单Canvas、有界窗口数、命中与交互回归 | 10,000非空pane、6层、最多100可见/overscan pane与20,000 marks，规定样本的提交/呈现/交互/生命周期报告 |
| B3 高基数稀疏表 | 稀疏单测；曾以100,000×1,000轴、1,000,000真实记录运行单次Node索引探索，见下文 | 正式6层不均匀结构，索引时间/峰值内存/首帧/随机跳转/热滚动及字节预算报告 |
| B4 超长坐标 | 程序化source为1,000,000行×4列，逻辑高180,000,000px；首末跳转与往返有浏览器证据 | 原生滚动上限实测、双轴压缩/普通组合、完整键盘/定位/resize及正式浏览器矩阵 |
| B5 SVG 工作表 | keyed节点复用与clip定义计入预算；5,000 hits/10,000元素门限；实测八次首尾切换节点数稳定 | B2同等语义正式测量、连续更新回收、导出一致性及生命周期报告 |

B4 按需生成记录，不能证明 B3 的真实输入索引或内存达标。现有浏览器验收不是规定的1440×900、DPR2、60Hz性能配置；尚无正式 p50/p95、峰值/驻留内存、long task、掉帧、50次挂载/销毁或1,000次窗口移动报告。

一次真实记录探索使用 Node v22.20、Apple M4 Max、64GiB：生成1,000,000条记录83.95ms，100,000×1,000轴索引准备2193.99ms，计时含准备前GC；GC后heap从仅输入的131,696,736 bytes增至带索引的397,780,232 bytes。300个10×10随机窗口共读取314条记录，readPaneData p95为0.0121ms，原始脚本保留在本地 `work/s0-real-index-benchmark.mjs`。这是单次准备/读取探索，不是正式6层不均匀B3、浏览器帧预算、峰值内存或运行时128MiB预算验收。

正式报告须按需求第7节固定机器、浏览器、字体、种子和构建，分列外部准备、adapter、索引、读取等待、layout、Scene、命中、提交与呈现，不遗漏库内索引准备。目标保持为冷首帧p95≤500ms；Canvas提交p95≤16ms、呈现间隔p95≤33ms分别记录；SVG提交p95≤32ms；交互p95≤50ms；运行时驻留≤128MiB，位图/完整输入/供数索引另报。当前未宣称达标。

## 当前实现边界与后续缺口

准备索引按实际记录到度量槽保存，最多16,000,000条，不分配R×C矩阵。单次轴读最多100,000叶，pane读最多64窗口；控制器每窗口最多20,000槽位记录、缓存8窗口。SVG的5,000 hits/10,000元素限制包含clip定义。尚无字节计数、总并发优先级、相邻范围合并、分页补全或统一导出预算，不能关闭R08/R15。

当前只提交完整窗口，preview、续页、部分pane、缺统计域和缺覆盖明确拒绝。完整fixed域可独立于源统计生成，但需要完整series的line/分组/堆叠仍遵循series合同。只读快照区分requestedVersion、committedVersion和displayedFrame，失败候选保留已提交画面/选择并禁用旧图导出。事件经microtask在当前状态事务完成后交付，受控请求默认10,000ms超时；这些事务已通过回归和冻结候选独立复审；S2调度变更仍需持续复验。

S2继续实现预览/部分输入的显示与补页、字节缓存和范围调度、未访问范围/分页导出及取消、正式性能和生命周期验收。S3尚未解除产品canonical rows/columns的旧深度裁剪，也未增加实际native renderer分支；必须落实D9，完整保留字段并对旧后端不支持场景明确诊断，不能截断、自动切换或以demo代替产品接入。

首版关闭条件仍是全部R01–R17完成、A01–A16通过、B1–B5有可复现记录，以及构建消费、GW保存/历史/导入/切换与旧路径回归通过。阶段commit和单个PR不替代这些条件。
