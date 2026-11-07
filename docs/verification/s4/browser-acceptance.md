# S4 独立浏览器验收

2026-11-07，独立验收模型 gpt-6.1-terra / xhigh。最终候选的已测浏览器功能 PASS。测试使用真实 GW 计算入口和 native renderer，样例通过 fixture URL 或宿主 API 设定；程序化设定的数据和图表不等同从编辑器手工建立图表。下文保留发现、修复和构建边界。

基线 commit `799b87377a7599bef68fd8c91504bb78ef528285`。[源码清单](./source-manifest.json)覆盖 51 个产品和测试文件，文件 SHA-256 `73ebd4e6db155a6625c3021fea1c1276e344c1483220f2e925edde72721f9638`；验收时逐项重新计算，全部一致。实现方另给出产品指纹 `0e4eae5a7caafa11c21a857c37aff4bb23a62db7bd8938a77fea4a1a006f520c`。最终测试页资产清单指纹 `ece83609deb1ef2d430373975900e0ae4878f3d2c002c35a9e7756e9b611a061`。该值是在仓库根目录将 `node_modules/.cache/graphic-walker-e2e` 所有文件路径排序，逐个运行 `shasum -a 256`，再对结果整体运行 `shasum -a 256`。

## 三引擎回归与构建边界

- 首次独立 production build 的完整测试为 147/162 通过，15 项均为 Firefox 新图形测试的点位探针失败，见[原始日志](./e2e-initial.log)。Firefox 的 `<clipPath>` 子矩形 `getBBox()` 返回零尺寸，测试因此排除了真实可见区域；我独立确认 `isPointInFill` 可用并在 Firefox 真实点击 circle 得到 pointer 事件。测试修为读取裁剪矩形属性，保留裁剪和实际鼠标输入检查。
- 此后 fresh build，资产清单 `4f0199afd9f9b02dbf2c62b4988ecf86ee4a902a6c01cc500cfe963a0f72c50a`，Chromium、Firefox、WebKit 完整 162/162 通过，3.6 分钟，见[完整回归](./e2e-final.log)。这是圆环孔指针修复之前的构建。
- 随后只修改圆环孔 hit 判断及对应核心测试，fresh build 生成最终 `ece83609…` 资产。新图形 16 场景 × 3 引擎共 48/48 通过，56.3 秒，见[最终定向回归](./e2e-hitfix.log)。同时在该构建复跑本报告的独立指针、箱图、尺寸和滚动探针。完整 162 项没有在该单一 hit 修复后再次全量执行，不能把前一构建的完整测试表述为最终构建的全量实测。

生产测试页从 `packages/graphic-walker` 运行 `GW_E2E_PORT=4194 yarn vite build --config tests/e2e/vite.config.ts` 构建并通过本机 4194 preview 提供。完整回归在同目录运行 `GW_E2E_PORT=4194 NATIVE_WORKSHEET_URL=http://127.0.0.1:4194/tests/e2e/native-worksheet.html npx playwright test`；最终定向回归在命令后加 `tests/e2e/native-extended-marks.spec.ts`。三引擎为 Playwright Chromium、Firefox、WebKit，WebKit 不是原生 Safari 的替代名称。

## 视觉、交互和导出

独立 Chromium 捕获并查看 circle、tick、auto-tick、area、trail、pie、donut、pie-size、bar normalize/center、area normalize/center 和 boxplot 的 SVG 与 Canvas 页面。13 个样例每个都得到一个 SVG 或一个 Canvas，无 native alert；各截图命名为 `<样例>-svg.png` 和 `<样例>-canvas.png`，[捕获脚本](./capture-marks.cjs)及[结构记录](./capture-marks.json)可复现。例如 [area SVG](./area-svg.png)、[trail Canvas](./trail-canvas.png)、[圆环 Canvas](./donut-canvas.png)、[箱图 SVG](./boxplot-svg.png)。视觉检查显示堆积、空值断段、环孔和箱须；circle 在轴最小、最大值处按既有 plot clip 裁掉越界部分，并不自动为端点符号增加留白，见 [circle 截图](./circle-canvas.png)。

新图形三引擎测试实际移动鼠标和点击 SVG 与 Canvas，检查 tooltip、selection、原始字段、datum identity、area/trail 的两个端点、box 的五个统计端点、离群点身份、SVG/PNG 导出及切换后端不增加查询。pie 的完整查询保留双轴分面字段，滚动后末端成员可见，Canvas 仍仅一层；SVG 保持有限可见 pane。测试对包含 null 和零的样例有断言。

pie-size 的真实 SVG 中前三个扇区半径为 34.8827、49.3315、60.4185，比例为 1 : √2 : √3；0、62.5、125 的面积图例半径为 0、6.364、9，与面积映射一致。见[定量探针](./pie-size-legend.cjs)及[数据](./pie-size-legend.json)。

rect-size 与 text-size 在真实 GW fixture 中通过宿主 API 改图表和原始数据，非菜单样例。12 个 rect 的面积随数值改变，12 个 text 的字号和连续 x 位置改变；对实际 SVG 图形进行 hover、点击，切换 Canvas 后再次点击同一位置，身份保持且查询数不变，SVG 和 PNG 均能导出。见[探针](./size-trail-independent.cjs)、[数据](./size-trail-independent.json)、[rect 截图](./heatmap-size.png)和 [text 截图](./text-size.png)。

## 箱图、圆环边界与 trail

[独立箱图探针](./box-independent.cjs)使用真实 GW computation。图表设置 `config.limit=5` 和 Region=East 筛选，输入 12,055 条 East、1 条 West。实际 workflow 包含原始查询与筛选，没有 limit；实际结果为 12,055 条，尾部样本保留，West 排除。供应方如果未声明地截断返回数组，现有接口无法检测，本测试只能证明 fixture provider 返回了请求的完整结果。

小样本 `[1,2,3,100]` 的真实点击返回 lower=1、Q1=1.75、median=2.5、Q3=27.25、upper=3；100 作为离群观测。全 null 的 Empty 组仍显示分面成员，没有虚构箱体。一次点击后箱体、四边、中位线、两须及两帽的 10 个 SVG 命令由 `#2563eb` 全部变为 `#ea580c`。见[原始结果](./box-independent.json)及[截图](./box-small-selected.png)。

首次独立边界探针发现，内半径 32 的圆环在孔内半径 31、29 处仍有 tooltip 并可点击选择，SVG、Canvas 均复现，见[修复前数据](./donut-boundary-before-fix.json)。修复后的最终 bundle 对半径 31、29、27、0 均无 tooltip 且返回零目标，半径 35 正常选择扇区；两个后端一致，见[复验数据](./donut-boundary.json)和[脚本](./donut-boundary.cjs)。

trail 保留与已有指针交互一致的 3 CSS px 轮廓容差。对实际 SVG 多边形，内部点和外侧 2 px 点命中并返回两端点，外侧 8 px 点无 tooltip 且零目标；对该段包围盒中的空白区域实际 Shift 拖框，返回零目标。见[数据](./size-trail-independent.json)。这不是说包围盒整体可命中；框选按实际几何判断。

## 有界滚动 smoke 和限制

独立 pie 双轴分面 probe 在 Canvas 下 40 次交替滚动到首末位置，末端实际滚动 left=738、top=846；native DOM 元素数起始及最大均 18，Canvas 始终 1，查询次数始终 1。滚回并切回 SVG 后，原选中扇区仍为选中色 `#ea580c`。见[滚动脚本](./pie-scroll-independent.cjs)、[原始数据](./pie-scroll-independent.json)、[截图](./pie-scroll-canvas.png)。这是有限次数的功能和资源数量 smoke，不是长期内存泄漏证明，也不是百万行或新图形的 B1–B5 性能测量；S2/S3 旧性能报告不能当作 S4 新图形性能结果。
