# S1 独立代码审核

日期：2026-11-06。审核模型：`gpt-6.1-sol`，reasoning effort：`xhigh`。工作树：`feat/native-worksheet-renderer`。

结论：**PASS，仅批准本轮 S1 渲染库阶段。** 对实现冻结后的实际源码、测试和构建产物完成独立复审，当前没有未解决的 S1 代码审核阻断项。此结论不表示首版 R01–R17、A01–A16 或 B1–B5 已全部完成。

## 审核快照

基线为 2026-11-06 的 `feat(worksheet): establish native rendering and window contracts`，提交标识 `b4e3be7c`。本次审核其后的 S1 工作树变更。

实现方明确冻结产品源码与测试后，审核者计算并复核 53 个相关源码、测试、演示、构建脚本和包配置文件的内容指纹。最终验证前后指纹一致：

```text
SHA-256 07c6defdf48c2097d9bd278806494edfbf38170713949481d57e5e1f8362e957
```

指纹包括 `packages/worksheet-renderer/{src,tests,scripts,demo}`、该包的 `package.json` 与 `tsconfig.json`，以及 `packages/graphic-walker/src/lib/native/*.ts`。README、实施台账和审核报告的后续文档更新不在该产品指纹内。产品文件若再次改变，须重新核对相关检查，本报告不能替代复审。

## 实际审核范围

- 对照技术设计 v0.4、需求 v0.3、alignment v0.4、S0 代码及浏览器报告，检查本阶段范围和仍需完成的最终要求。
- 审查 prepared 索引、typed identity、变深度成员树、度量槽、完整联合 series、shared/prefix/pane/fixed domain、窗口与 locate 协议。
- 审查五种 mark、分组柱与正负堆叠、区间柱、线序与缺值断线、共同轴/图例/文字、裁剪和精确点击/框选几何，以及 Canvas/SVG 后端。
- 审查更新提交、旧响应与取消、受控请求超时和确认、精确选择与跨快照值、焦点、tooltip、键盘和有界语义 DOM。
- 审查 IChart 纯适配器及相关旧绑定/mark 规则、独立 React 入口、ESM/声明构建、包导出和演示宿主。

新路径继续消费现有 IChart 和已准备结果。RenderPlan 是内部显示参数。核心没有依赖 GW store、React、Vega、Vega-Lite 或 Plot，也没有引入计算 DSL、SQL、业务聚合或第二套用户持久化格式。受控演示使用宿主预先提供的父级常量，缺父记录的交叉位置保持为空。

## 发现及修复复审

| 审核发现 | 冻结版本中的处理与复核 |
| --- | --- |
| 完整固定域仍依赖源统计，独立字段复用时位置 scope 与共享颜色冲突 | 完整 fixed 域由共同模块合成；无需统计或 series 时不调用 readDomains。非位置通道保持 shared。仅固定一端仍要求完整统计域，line/grouped/stack 的 series 合同不被豁免。独立探针及回归通过。 |
| 能力门禁、prepared 与 Scene 对省略 positionType 的柱方向和区间类型推导不一致 | 共用 positionTypeFor/barIsHorizontal，保留显式方向优先级；合法区间位置不被误拒绝，区间值不能进入标量视觉通道。回归与独立横向柱探针通过。 |
| 外部源可重排度量槽，locate 可把 A 指向 B | 校验按计划排列的完整 slot 组、路径与总数；locate 核对版本、请求 key、canonical path、rank、隐藏祖先，并与实际 readAxis 窗口往返核对。错误定位探针被拒绝，视口没有移动。 |
| 线段点击丢失实际命中点，线端帽绘制与框选几何不一致 | SelectionTarget 保留已呈现帧 CSS 坐标的 hitPoint；两后端明确使用 round cap，框选采用与其一致的欧氏距离。端帽外角不再误选，回归及独立探针通过。 |
| 候选更新失败会清除旧选择，后续候选不能确认已提交版本发出的请求 | 提交状态与候选状态分离；保留旧显示 bundle，禁用 stale/error 数据交互与默认导出；选择迁移在提交事务中生效。请求基于已提交 presentation 验证，拒绝候选不发虚假的 clear。独立乱序及拒绝更新探针通过。 |
| 同一输入的滚动可能使 update/request 收尾丢失，初始受控选择被滚动重放 | 同 revision 的候选重试到一致提交；请求在实际提交时结束，初始受控状态仅在该 revision 首次提交应用。更新中滚动和选择保持探针通过。 |
| 跨 snapshot 的 pending 目标仍可能携带旧值，源切换可留下旧焦点环 | 清除未重新验证目标的旧 raw/value；新受控输入可提供新目标。候选 Scene 使用正确的提交焦点，避免旧源同名 mark 的焦点环残留。回归通过。 |
| 状态快照可被宿主修改，结构化诊断被降为英文句子，宿主回调可打断提交 | 返回隔离的不可变快照，保留已显示与目标版本/偏移；诊断保留 code/fieldRef；事件在事务后以不可变快照派发。快照、初始订阅、诊断及回调重入回归和独立重入探针通过。 |
| pending 请求缺提示，终端表头被错误宣布为可折叠 | 显示等待/过期/拒绝提示；表头语义及 tooltip 包含路径，仅可折叠节点暴露 aria-expanded。已复查代码，实际输入和视觉效果由独立浏览器验收负责。 |
| 声明文件的相对导入没有扩展名，NodeNext 消费失败 | 正式构建为声明相对导入补全 ESM 扩展名。外部严格 NodeNext 消费及原生 Node ESM 的 core/react 实际导入通过。 |

## 独立执行的最终验证

| 检查 | 结果 |
| --- | --- |
| 子包 `npm test` | **126/126 通过**，无跳过、取消或失败。 |
| 子包 `npm run typecheck` | 通过，使用包内 strict TypeScript 配置。 |
| 子包 `npm run build` | 通过，生成 core/react ESM 与类型声明。 |
| `git diff --check` | 通过。 |
| 外部 TypeScript 消费 | 在仓库之外建立消费目录，使用 NodeNext、strict、skipLibCheck:false，导入 core、RenderPlan 与 `/react`，通过。显式限定 React 类型，避免根仓库无关全局类型污染。 |
| 原生 ESM 消费 | Node 实际导入正式包的 core 与 `/react` 成功；根入口在无 DOM/window 的 Node 中也可导入。 |
| 独立运行时依赖检查 | 根入口内存 ESM 构建通过；解析的 118 个输入中没有 React、GW 源码、Vega、Vega-Lite 或 Plot。产物无外部运行时 import。低层 d3-format/d3-time-format 负责格式，不调用完整图表引擎。 |
| `npm pack --dry-run --json` | 通过，32 个发布文件含两个入口、共同 ESM chunk 和完整声明文件；未发布包。 |
| 独立 scratch 探针 | 固定域、复用字段作用域、方向推导、端帽框选、slot 乱序、候选确认、更新中滚动、选择回滚、错误定位、受控选择纯滚动、事件回调重入均符合预期。未改产品源码或测试。 |
| 冻结内容复核 | 最终检查后 53 文件 SHA-256 与开始时一致。 |

独立探针和外部消费工程保留在本次聊天工作区的 `work/s1-*.ts` 与 `work/s1-consumer/`。这些检查直接运行当前源码或正式产物，没有以实现者的摘要替代执行。DOM mock 只证明控制器状态及事件合同，不证明浏览器像素、真实键盘/指针投递或屏幕阅读器行为。

## 批准边界与后续门禁

本次批准 S1 的五种基础 mark 及其已声明通道、轴/图例、作用域、受控顺序与折叠输入、共同几何与结构化交互、更新事务，以及独立 React/ESM 入口。涉及 UI 的 commit 仍须通过独立 Terra 会话针对同一冻结版本的 [S1 浏览器验收](./browser-acceptance.md)。本报告没有代替该门禁。

S2 仍须完成完整窗口调度、补页/预览与部分加载策略、范围合并去重和统一并发/驻留预算、未访问范围与分页导出、取消及正式资源/生命周期基准。当前完整窗口的拒绝策略、少量缓存和稀疏单测不能替代这些要求。

S3 仍须完成生产 GW renderer 路由、schema 与 canonical normalize/reducer 保字段、现有存储/导入导出/undo/redo、公开 ref/callback 和真实结果身份适配，以及旧路径回归和多 renderer 对照。当前纯 IChart adapter 与独立演示不表示生产 GW 已完成接入。

完整首版的 R01–R17、A01–A16 和 B1–B5 门槛保持不变。此次没有进行正式性能统计、完整浏览器矩阵、真实屏幕阅读器或全部 GW 产品回归，不宣称完成这些验收。
