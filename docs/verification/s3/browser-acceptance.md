# S3 独立浏览器验收

独立验收 gpt-6.1-terra / xhigh：最终 76 文件源码指纹 `04f08b1acc58d29a9d609e3dcb645b859973a79035fba05eba724289865aa6b6`、GW 浏览器 bundle `d8a42531535a4b20f38305dac42a7b987ebadbc9b4bbfd7c8df9372976c75812` 的已测产品功能门禁 PASS；实际 60 Hz 性能复验见 [性能报告](./performance-60.md)。以下是 2026-11-06 对 4186 候选 bundle SHA-256 `8c5ee937fffee4d3a73edaba384fdec0e2baf959e4453524161030825d31f8e5` 的观察，不代表后续修复后的最终 bundle。Chromium headed，页面使用真实 GW `PureRenderer` 或 `GraphicWalker`、`getComputation`。测试数据在本地 fixture 中，部分图表通过公开宿主 fixture API 设置；这不等于全部从编辑器交互制作。截图保留在本目录。

## 产品交互和导出

- 默认 PureRenderer 显示 6 × 4 位置、28 项 complete，[Canvas 截图](./pure-canvas.png)。实际鼠标点击 East/Furniture/Standard/2025 的 Sales 条，公开回调 source 为 pointer，inputRevision 1、frameId 2，含 source/snapshot/presentation 版本。原值含 Region East、Category Furniture、Subcategory Standard、Year 2025、Sales 100、Profit 20，分别对应原字段和 encodings 路径。
- 四个公开 ref 名称存在。`getSVGData` 与 `getCanvasData` 分别得到单一 SVG 和 PNG data URL；调用 `downloadSVG` 与 `downloadPNG` 后浏览器实际收到对应下载，保留 [SVG](./public-ref.svg) 和 [PNG](./public-ref.png)。Canvas→SVG 和深浅主题变更均未增加 GW 查询次数，SVG 单根，导出内容随主题改变。
- 通过宿主设置相同深层 IChart 为 Vega-Lite 和 Observable Plot，两者都显示明确 `cannot display all fields` 及涉及的 `encodings.rows`。实际点击 `Use Native Worksheet` 返回 native，行字段 Region/Category/Subcategory、列字段 Year/Sales/Profit 保留，查询次数不变。
- 通过宿主控制 computation 的延迟与失败：旧查询挂起时 SVG 导出报 `still computing; the previous viewport is stale`；先放行新结果 Latest、后放行 Older，两次导出均仅含 Latest。再触发失败后可见 `Fixture query failure`，导出同样抛出该错误，没有返回旧图。
- 编辑器中实际拖动 Channel 到 Y-Axis，字段顺序成为 Region/Channel/Category/Subcategory，可见位置从 6 增至 12；实际点击撤销、重做恢复相应字段。实际拖 Region 到 Filters，在弹窗取消 West 并确认；过滤规则为 `not in [West]`，导出含 East、不含 West。实际从 Sales 的聚合菜单选择 Mean，GW workflow 输出 `Sales_mean`，SVG 含 `mean(Sales)`。IGWHandler 导出为 native、1 × 1，容器与图均连接，状态 idle。随后通过宿主 store 的 `exportAllCharts`、`removeField`、`importRaw` 保存和恢复，encodings 完全相同，历史中没有 RenderPlan/domainPlanKey 等派生内部数据。保存与导入是宿主 API 操作，不是文件对话框操作。

## 同一 IChart 对照

宿主设置同一份 IChart 为 Region、sum(Sales)，输入 East 100、West 200，数字格式 `.1f`，之后只改 renderer。三后端显示 East/West、0–200 范围和 1:2 条长：native 90:180，Vega 473:946，Plot 471:942，切换时查询数不变。[Native](./compare-native.png)、[Vega](./compare-vega.png)、[Plot](./compare-plot.png)。Native 和 Vega 轴标为 0.0、100.0、200.0 等，Plot 显示 0、20、…、200，未应用 `.1f`。这是该候选的 A15 缺口，已通知实现方，待最终构建复验。

真实 GW computation 供数，通过宿主设置 IChart 检查五类 mark：bar、point 各 2 项，line 1 段；另设 Region × Category band 和 Sales color/text 后，rect、text 各 2 项。每组 complete 且无 alert。这些是浏览器程序化设 spec 的显示检查，不代表五种 mark 都由编辑器手动构建。

## 未完成

最终 bundle 冻结后需复验受修复影响的 Plot 格式、VL 导入、时间语义和新增的 GW bin/binCount、同名 fold、temporal raw 样例；完整深度 3/5/10/20、A15 更广支持子集、完整导入配置及跨浏览器矩阵尚不能由上述观察推断。S2 VoiceOver、B4、A06/A07 和受控延迟补证在 S2 目录单独记录。只有上述条件都核对后才能给 S3 最终结论。

补充深层真实 GW 计算检查：通过宿主程序化设置 point IChart，行列各 3、5、10、20 个不同维度及一个度量，每组输入一条记录。四组都显示单 SVG、1 个可见点、complete、无 alert；各轴分别保留深度 + 1 个字段。20 层时 GW aggregate workflow 的 groupBy 包含全部 R0–R19、C0–C19；键盘选择回调保留全部 40 个维度的原始值，以及 Sales 11、Profit 7 和版本。首次误用 bar 配置且两轴均为定量位置时得到明确不支持诊断；改用适合双定量位置的 point 后得到上述结果。这是宿主设 spec，不是 UI 逐项拖放 40 个字段。该结果仍属于 8c5ee 候选。

## eae88 中间候选复测

随后刷新新页面验证 browser bundle `eae88ad7df2f2ec706038e098ae7946047f1a194b65ed2ddf7b533a3e913d035`，source `bbf145bd73bf3e50cba829cfa563bf97ed7788779d71ce13879312c5b303c5d1`。它已被新一轮修复取代，不能当最终结果。

同一 Region/Sales 图再次切换三后端，Observable Plot 已显示 0.0、20.0、…、200.0，与指定 `.1f` 相符，查询次数不变。bin 和 binCount 样例均由 GW transform、aggregate 计算，结果分别为 [0,10]、[10,20]、[20,30]、[30,40] 及 1、2、3、4，均各计数 2、显示 4 项。实际键盘选择返回的首个 raw 分别为 [0,10] 和 1。

同名 fold 的 GW aggregate 原始结果 Chair 的 RevenueA/B 为 12/15、Paper 为 7/9；4 个实际选择的身份各不相同，两分支都显示 `sum(Revenue)`。时间样例真实查询保留两条 DST 前后 ISO 字符串、日期字符串和 null，显示 3 个点，选择回调保留三条原始字符串和各自身份。固定本机 UTC−8 配置下，同一 IChart 在 native、Vega、Plot 的实际点位，相邻间距与首末间距之比分别为 0.0444444444、0.0444444454、0.0444444466，切换不增加查询。多次点击后 Vega 的第一个点在 store 的 selectedMarkObject 和 filters 中保留 `2026-03-08T01:30:00-08:00` 原串。该观察不能证明首次点击成功，见后续复测。

真实 editor 的 `vlSpec` prop 输入 Region=East 筛选、Category、sum(Sales)、`.1f` 后，得到相应 IChart 和无错误。再输入 calculate transform 或对 fold 输出执行 bin，分别通过 onError/UI 返回 `transform[0]` 和 `encoding.x.bin` 诊断，chart、历史和 undo/redo 状态保持。该候选中成功图含筛选时，拒绝输入使同一主查询重复两次；实现方定位为测试 fixture 的 onError 回调引用不稳定，正在修复。修复后需重新验证查询次数及上述受影响入口。

PureRenderer 四个 ref 再次返回一份 SVG/PNG 并触发两次实际下载。GraphicWalker 的 SVG 和 PNG 导出均返回 native、1 × 1，SVG 容器和 chart 已连接，renderStatus 为 idle。

## 551744 中间候选复测与首击问题

刷新 browser bundle `55174445b070b24931ec0c02c54845259a6225827cc18f03dbb83ed9b646cad5`，source `af200f24b80b88266d42512a922ac509106bcc5cc05b8407cbbf694ec6d02893`。四个真实 GW 计算样例结果、fold 身份和时间原值与上一轮一致。筛选后的 VL 成功输入再分别拒绝 calculate 和 fold+bin，chart、历史及 undo/redo 不变，主查询次数始终为 2，前述 fixture 回调引起的重复查询不再复现。传入两个真实 JavaScript Date 时 Vega 和 Plot 各显示 2 点、无 alert；Vega 后续点击返回的原值仍是 Date 对象。

新开 editor 页，从 native 切到 Vega SVG 后，实际点击第一个时间点，800 ms 后 selectedMarkObject 和 filters 仍为空；点击第二个不同点后返回第二点 after-dst，第三次点第一个后才返回 before-dst。独立复现首次点击丢失，已通知实现方。上一节成功点击是多次操作后的结果，不能用于证明首击。该候选不应作为最终通过结论。

## 92db 点击修复候选

browser bundle `92db68b957a2aea7fe613b5aabe330bfea8d2a38cd6da5b39e8ab8b3317f0357`，source `d95dca43c420bd9bfe8a60b26a95e3081e5af6fe9d5ac32a7e48ce7a74234256`。新开 editor 页面，native 切至 Vega SVG 后第一次真实点击 before-dst 点，selectedMarkObject 立即包含原字符串 `2026-03-08T01:30:00-08:00`。首击后 GW 的操作菜单覆盖图表；实际点击菜单外关闭，再点击 after-dst 点，选择更新为 `2026-03-08T03:30:00-07:00`。切回 native 后旧 Vega path 已脱离 DOM；对该旧节点程序化派发 click，选择不变。这是有限的旧 DOM 探针，不能独自证明所有异步队列的卸载时序。此结果关闭本报告 551744 首击复现，但最终结论仍取决于最后冻结构建及性能复验。

## Safari 产品宿主 smoke

真实 Safari 26.5.2，92db 构建，通过原生窗口输入。PureRenderer 默认 Canvas 的 nested 显示 24 项 complete；用样例选择器切到 bin、同名 fold、时间样例分别显示 4、4、3 项 complete。bin 聚焦代理并按 Enter 后名称含 `sum(Count): 2, bin4(Amount): 0,10`。GraphicWalker editor 初始 nested 显示 20 项 complete；切 bin 后 4 项 complete，键盘可聚焦首个区间。

Editor 从 bin 切同名 fold 时，fold 工作表显示 4 项 complete，但同时弹出 `Oops! There is some error with Computation service`，输出 `Error(501)` 和压缩 blob 栈。关闭弹窗后切时间样例显示 3 项 complete，原错误文本仍在 fixture 输出区。Pure 中同一切换未看到该弹窗。该情况已通知实现方，需要区分测试 fixture 的 chart/data 切换时序与产品问题并复验。此轮为真实 Safari 的有限宿主 smoke，不是完整浏览器矩阵，也未在 Safari 执行 SVG 切换或下载。


## 最终 owner 修复定向复验

最终 d8a425 bundle 在真实 Safari 26.5.2 的 GraphicWalker editor 中通过样例选择器从 bin 切至同名 fold，显示 4 项 complete，没有此前 92db 的旧请求 501 弹窗。隔离 Chromium 分别对真实 editor 和 GraphicRenderer viewer 保留两个实际 computation 请求，先放行新请求、再拒绝旧请求，均无弹窗或 alert；拒绝当前请求则正常显示 `Fixture deferred query failure` 和 alert。此定向 delta 关闭上述 Safari 旧请求缺口；最终 bundle 的独立产品结论结合前述各版本明确记录的交互观察，以及最终构建工程三引擎全回归，不能把旧 bundle 的每个手工观察伪称为最终 bundle 全量重跑。真实 Safari 覆盖仍限所述 smoke，非全部场景。

独立浏览器验收所发现的首次 Vega 点击和过期请求错误分别经 92db 和最终 d8a425 定向复验关闭；四个真实 GW 计算样例、格式、时间原始值、公开导出和编辑流程的对应候选与操作边界见上文。完整性能和受控更新的最终 60 Hz 数据见 [性能报告](./performance-60.md)。
