# 自有工作表渲染器实施记录

日期：2026-11-06。记录状态：S0 候选已通过提交门禁，独立 Sol 代码复审和 Terra 最终浏览器复验均为 PASS，58 项测试通过。S1–S3 尚未完成，当前不具备首版发布条件。

本记录追踪 [需求与验收](./worksheet-renderer-requirements.md)、[技术设计 v0.4](./worksheet-renderer-design.md) 和 [alignment v0.4](./worksheet-renderer-alignment.md) 的实施证据，不修改批准范围。IChart 继续是用户保存的权威格式；RenderPlan 是临时显示参数。现有 GW 计算 DSL/SQL 仍负责结果，库不新增聚合、过滤、计算表达式、查询规划或数据库 provider。

## 实施与提交门禁

所有阶段最终进入一个 PR，S0、S1、S2、S3 分阶段提交。S0 候选已通过提交门禁。阶段拆分只安排实施顺序，不能把未完成的 R/A/B 项改为可选项。

每个 commit 必须先通过独立 subagent 的代码 review，指定模型为 `gpt-6.1-sol`、reasoning effort 为 `xhigh`。涉及 UI/UX 的变更还必须由独立 agent session 进行 browser use 验收，指定模型为 `gpt-6.1-terra`、reasoning effort 为 `xhigh`。发现问题后修改并复审、复验，所需门禁全部通过后才能 commit。不能把旧构建的通过结果当成后续改动的通过结果。

当前代码审核会话是 `s0_review`，其 [代码复审报告](./verification/s0/code-review.md) 已给出 PASS。浏览器验收会话是 `s0_browser_acceptance`，其 [S0 浏览器验收报告](./verification/s0/browser-acceptance.md) 已给出最终 PASS，并记录具体场景、截图和实际下载文件。本轮覆盖 Chromium 和 Playwright WebKit；Playwright WebKit 不等同于 Safari 发布版，Firefox 因缺少本地缓存未验收。

| 阶段 | 交付范围 | 当前状态与退出条件 |
| --- | --- | --- |
| S0 | IChart fixtures → 纯 adapter → 自有 Canvas/SVG 的最小纵切；冻结头、版本供数、超长滚动 | 候选已通过独立 Sol 代码复审、58 项测试及 Terra 最终浏览器复验 |
| S1 | 五种基础 mark、完整布局与域、顺序/折叠请求、统一选择与事件 | 待实施；完成对应显示和双后端一致性用例，受控操作不在库内生成业务汇总 |
| S2 | 范围调度、字节预算、窗口缓存、分页导出、真实规模与生命周期基准 | 待实施；窗口外不物化图元，B2/B3/B5 有真实记录和可复现测量 |
| S3 | GW renderer、正规化/输入、保存/历史、公开 ref/callback、局部兼容 | 待实施；同一 IChart 切换不丢语义，旧后端及导入导出回归通过 |

## 当前代码与验证入口

| 入口 | 证据范围 |
| --- | --- |
| [子包 README](../packages/worksheet-renderer/README.md) | 当前可调用 API、独立嵌入示例、脚本及限制 |
| [core/types.ts](../packages/worksheet-renderer/src/core/types.ts)、[prepared.ts](../packages/worksheet-renderer/src/core/prepared.ts)、[keys.ts](../packages/worksheet-renderer/src/core/keys.ts) | 版本供数合同、typed 身份、实际成员树、度量槽、稀疏索引、完整共享域 |
| [validateWindow.ts](../packages/worksheet-renderer/src/core/validateWindow.ts)、[capabilities.ts](../packages/worksheet-renderer/src/core/capabilities.ts) | 响应版本/覆盖/完整性、rank/key/slot/路径、必需列/原值校验和 S0 能力拒绝 |
| [GW adapter](../packages/graphic-walker/src/lib/native/adapter.ts)、[fixtures](../packages/graphic-walker/src/lib/native/fixtures.ts) | 真实 IChart 类型到内部参数，不改变 IChart，不引入计算执行 |
| [scene/build.ts](../packages/worksheet-renderer/src/scene/build.ts)、[scene/scales.ts](../packages/worksheet-renderer/src/scene/scales.ts) | 两后端共用几何、clip、命中与有效显示域 |
| [runtime/worksheet.ts](../packages/worksheet-renderer/src/runtime/worksheet.ts)、[runtime/scroll.ts](../packages/worksheet-renderer/src/runtime/scroll.ts) | 单运行实例、窗口读取、取消、冻结头、压缩滚动轨道、当前选择与导出 |
| [adapter tests](../packages/worksheet-renderer/tests/adapter.test.ts)、[prepared tests](../packages/worksheet-renderer/tests/prepared.test.ts) | 映射、U1、深层字段、typed 身份、成员顺序、稀疏空组合和堆叠域 |
| [window contract tests](../packages/worksheet-renderer/tests/window-contract.test.ts) | 过期/部分/错误响应明确拒绝，避免空白或缺失标记被当成完整结果 |
| [scene tests](../packages/worksheet-renderer/tests/scene.test.ts)、[scale tests](../packages/worksheet-renderer/tests/scales.test.ts)、[scroll tests](../packages/worksheet-renderer/tests/scroll.test.ts)、[capability tests](../packages/worksheet-renderer/tests/capabilities.test.ts) | 几何、零点/固定端点、坐标往返和未支持配置拒绝 |
| [浏览器验收](./verification/s0/browser-acceptance.md) | 独立 Chromium 中的真实绘制、点击、滚动、resize、切换、错误恢复与视口 SVG 下载，以及 Playwright WebKit 复验 |

已运行包级测试和严格 TypeScript 检查；最终代码复审对应的 58 项测试通过，涵盖响应完整性、记录/raw 列校验和固定域修复。最终候选提交仍需确认这份结果对应其实际构建。构建脚本已生成 `dist/index.js` 和声明；真实安装消费、`/react` 入口及生产集成验收仍需单独补齐。

可复现的命令均从仓库根目录运行：

```sh
yarn workspace @kanaries/worksheet-renderer typecheck
yarn workspace @kanaries/worksheet-renderer test
yarn workspace @kanaries/worksheet-renderer build
yarn workspace @kanaries/worksheet-renderer dev
```

## 首版需求 R01–R17

下表的“已有”仅指列明的 S0 证据。任何一行含有待办，都不能标记为完整首版验收通过。

| ID | S0 已有证据 | 仍需完成 |
| --- | --- | --- |
| R01 独立子包 | 根 ESM 导出、声明构建、无 React/GW/Vega/Plot 运行时入口；独立 source 与控制器 | `/react` 独立入口、真实构建产物外部消费及发布依赖图检查 |
| R02 自有双后端 | bar/point 使用同一 Scene；浏览器确认 Canvas/SVG 命令及命中一致并可点击选择 | 五种 mark、全部更新/交互的一致性和 SVG 生命周期 |
| R03 单 Canvas | 浏览器确认仅一个可见 Canvas，表头/轴/主体共画；滚动位图尺寸不变 | DPR、资源释放和完整规模场景的持续验收 |
| R04 递归行列 | adapter 保留两轴 3/5/10/20 层字段；实际路径树、并列槽与空交叉；U1=24 pane | 深层实际布局/排序/折叠与产品字段操作全链路，不只参数映射 |
| R05 字段与数据绑定 | binding/fieldRef 分离；typed path；宿主 datumKey；count/fold/expr/raw 绑定测试 | 全部 series 通道、跨快照选择重新验证、GW 真实结果身份合同 |
| R06 统一布局 | 父级跨度、冻结区、基础轴和共同 clip；负值/null 不产生业务零值 | 长文本、中英文测量、不等长层级与更多 mark 的布局；windowed 固定步长属于设计允许的基线 |
| R07 冻结与滚动 | 浏览器双轴滚动、首尾跳转、resize；键盘滚动与按 key 定位接口 | 焦点/锚点往返、折叠缩短、DPR 变化、完整触控板与跨浏览器验收 |
| R08 有界虚拟化 | 稀疏 typed array 索引、非空行目录、窗口几何、8 窗口缓存、压缩轨道 | 字节预算、范围合并/去重、总并发调度、预取、B3 真实规模与内存记录 |
| R09 基础图形 | bar/point；重叠与正负零点堆叠共用端点规则 | line、rect、text、分组柱、区间柱、缺值断线和系列顺序 |
| R10 轴/范围/编码 | band/linear/time；shared/fixed 域；零点、端点、reverse；离散颜色 | prefix/pane 域、连续色、完整静态样式/通道、格式、图例、nice/range |
| R11 顺序和折叠 | complete source 支持外部逐父成员 ordinal，排序后 key 稳定；空组合不补零 | 排序/折叠请求与状态机、父级记录显示、双轴受控更新和锚点恢复 |
| R12 统一交互 | 点击、修饰键多选、清空；宿主收到精确命中目标，后端切换保留身份 | tooltip、框选、完整受控选择、事件版本协议、跨 pane tuple 验收 |
| R13 GW 配套接入 | 纯 IChart adapter 和已有准备列规则，无库内 computation | 产品 renderer 路由、过滤/折叠结果接入、格式、保存、历史、公开 ref/callback |
| R14 导出/可访问性 | 已实现视口 PNG/SVG；浏览器实际下载并解析 SVG；基础 region/status 与键盘滚动 | PNG 浏览器验收、范围/分页/取消、完整焦点/可访问名称与按需数据访问 |
| R15 完整性/诊断 | 校验 source 版本、覆盖、域及记录；取消旧读取；不支持/错误明确拒绝，失败不允许旧图导出 | 预览/部分加载展示、补页、统一资源预算、完整输入事务/请求状态和导出取消 |
| R16 现有 spec 入口 | IChart fixture 原样映射；未新增持久化 specification | `layout.renderer` 产品接入、切换/保存/重载不丢字段，旧后端深层 unsupported 行为 |
| R17 局部兼容 | 当前少量 mark/channel/scale/style 有映射或明确拒绝测试 | 全部批准子集及优先级、现有正规化入口、外部 scales、原始 VL-like 输入的拒绝/保留策略 |

## 正确性验收 A01–A16

| ID | 当前可核对的证据 | 待验收部分 |
| --- | --- | --- |
| A01 | adapter 两轴深度 3/5/10/20；prepared 单轴 20 层祖先窗口 | 同一完整工作表两轴深层布局、顺序及显示全部字段 |
| A02 | U1 两 Region×三 Category×两 Year×两度量槽=24 pane，24 输入记录对应48槽位引用，值不变 | 接入产品数据准备后的端到端复验 |
| A03 | 实际联合路径不做同轴 Cartesian product；跨轴稀疏组合用覆盖描述空格 | 固定 Furniture/Chair、Office/Paper 双布局与两后端完整场景 |
| A04 | typed helper 覆盖 null/字符串/数字/布尔/time/interval 和分隔符；父路径参与身份 | 产品导入、排序和交互中的同一身份断言；interval 图形仍未支持 |
| A05 | 已准备值不聚合；不完整 source/窗口明确拒绝 | 折叠/展开请求、双向宿主响应、缺父级值加载与空态 |
| A06 | shared 域不随窗口变；stack 正负端点；固定端点/zero 优先级测试 | prefix/pane、不同单位共享规则、全部渲染模式域不变量 |
| A07 | 稳定宿主键在重排后保留；浏览器点击及 Canvas/SVG 切换保留所选身份 | 指定两 tuple 的精确多选、框选、滚出滚回、跨快照 pending/恢复 |
| A08 | 浏览器比较 bar/point 同一 Scene 的命令与命中；共同 clip/几何测试 | 五种 mark、文字、选择/焦点和1 CSS px目标的系统化双后端验证 |
| A09 | 过期版本/不完整覆盖/部分 pane/domain 单测；浏览器快速切换和失败恢复 | 确定性乱序网络响应、过滤/重排事务、加载/空/preview状态全组合 |
| A10 | 祖先跨度跨窗口；冻结区 clip；浏览器首末位与 resize；逻辑/物理坐标往返 | 焦点定位、折叠后锚点和完整跨浏览器输入 |
| A11 | 目前未实现 line/rect/text，S0 明确拒绝 | 序列隔离、缺值断线、跨 clip 线段、cell rect/text 全部待办 |
| A12 | 当前已提交视口 SVG 实际下载成功，失败/未覆盖时拒绝导出 | 未访问范围读取、分页无重复遗漏、PNG 实测、取消和资源释放 |
| A13 | adapter 不修改冻结 IChart fixture | 保存/重载、undo/redo、受控 props、导入导出与所有旧路径回归 |
| A14 | 原生可聚焦滚动 region、键盘滚动、状态信息 | 完整键盘任务、语义焦点、屏幕阅读器摘要/位置/折叠/数据和 DOM 上界 |
| A15 | IChart→plan 字段、值、聚合标签、时间和 fold/count 绑定测试 | 同一 IChart 三 renderer 的域/格式/事件对照与切换后编辑无损 |
| A16 | S0 对未支持 mark/channel/scope/style 有诊断；已有计算描述不送入库执行 | 原始输入的 transform/params/表达式诊断，以及正式局部兼容清单全部 fixtures |

## 规模基准 B1–B5

| ID | 当前证据 | 仍需完成的正式基准 |
| --- | --- | --- |
| B1 显示语义集 | 上述映射、供数、几何测试和 U1 浏览器场景 | 补齐 A01–A16 全部固定输入、五 mark、长文本、单位与局部兼容 |
| B2 日常工作表 | 当前窗口有记录上限、单 Canvas 和少量窗口缓存 | 10,000 非空 pane、6层、最多100可见/overscan pane与20,000 marks，按规定样本记录提交/呈现/交互/生命周期 |
| B3 高基数稀疏表 | 单测使用1,000条实际记录、1,000×1,000逻辑槽，仅1,000非空pane；另已进行100,000×1,000轴、1,000,000条实际记录的单次Node索引探索，见下文 | 正式6层不均匀结构；索引时间、峰值内存、首帧、随机跳转和热滚动报告 |
| B4 超长坐标 | 程序化 source 为1,000,000行×4列，逻辑高度180,000,000px；浏览器到末行 Item 999999并返回首行 | 浏览器原生上限实测、双轴压缩/普通组合、完整键盘/定位/resize及固定版本浏览器矩阵 |
| B5 SVG 工作表 | 浏览器可交互 SVG、Canvas/SVG切换和视口导出 | B2同等语义、5,000 marks/10,000 SVG元素预算、节点回收、连续更新与导出一致性测量 |

B4 的记录是按需程序生成，不能用它证明 B3 的真实输入索引或数据内存达标。S0 浏览器报告的窗口尺寸也不是需求中的1440×900、DPR2、60Hz性能参考配置。当前没有正式 p50/p95、峰值/驻留内存、long task、掉帧、50次挂载/销毁或1,000次窗口移动数据。

另有一次真实记录探索使用 Node v22.20、Apple M4 Max、64GiB 内存：生成1,000,000条记录耗时83.95ms，100,000×1,000轴索引准备耗时2193.99ms，计时包含准备前GC；GC后heap从仅输入的131,696,736 bytes增至带索引的397,780,232 bytes。300个10×10随机窗口共读到314条记录，`readPaneData` p95为0.0121ms。原始探索脚本保留在本地 `work/s0-real-index-benchmark.mjs`。这只说明真实输入索引与稀疏读取已经运行，不是6层不均匀B3、浏览器帧预算、峰值内存或运行时128MiB预算的正式验收。

正式报告须按需求第7节固定机器、浏览器版本、字体、数据种子和构建，分列外部准备、adapter、索引、读取等待、layout、Scene、命中、提交与呈现；不能把库内索引准备时间排除。现有预算保持为目标：冷首帧 p95≤500ms；Canvas提交 p95≤16ms与呈现间隔p95≤33ms分开；SVG提交p95≤32ms；交互p95≤50ms；运行时驻留目标≤128MiB且位图/完整输入/供数索引另报。当前实现未宣称达到这些指标。

## S0 临时实现参数与已知缺口

已准备 source 的索引按实际记录到度量槽映射保存，不分配 `R×C` 矩阵；最多16,000,000索引条目。轴单读最多100,000叶，pane单读最多64窗口。控制器每窗口最多20,000槽位记录，缓存8窗口，超过当前限制明确失败。它尚不具备字节计数、总并发优先级、相邻范围合并、分页补全或统一导出预算，不能据此关闭 R08/R15。

S0 目前只提交完整窗口，preview、续页、部分 pane、缺域、缺覆盖均拒绝。这样可避免错误结果被当作完整视图，但首版仍需实现设计要求的加载、预览、部分输入和受控请求状态。输入拒绝后保留上次有效画面、完整 selection pending/revalidation、事件版本和焦点协议等事务要求也尚需按设计补齐。

当前工作只增加库、纯 adapter 和 fixtures，尚未解除产品 canonical rows/columns 的旧深度裁剪，尚未增加实际 native renderer 分支，也未改变旧后端在超深配置下的处理。S3 必须落实 D9，保留完整字段并给出 unsupported 状态，不能截断、自动切换或以演示页面替代产品接入。

首版关闭条件仍是全部 R01–R17 完成、A01–A16 通过、B1–B5 有可复现记录，以及构建消费、GW保存/历史/导入/切换和旧路径回归通过。阶段 commit 和单个 PR 的存在不替代这些条件。
