# 图表类型扩展（S4）

日期：2026-11-07。状态：实现、独立代码审核、浏览器验收及构建消费检查通过。本阶段在原 S0–S3 核心范围上补齐 Graphic Walker 已有图表菜单，作为 S4 单独提交进入同一个 PR。

## 范围与计算边界

用户保存的格式仍是 `IChart`。新 mark 使用已有 `config.geoms`、通道、`layout.stack` 与主题配置，不新增持久化可视化 DSL。图表库继续只接收准备好的结果。

本阶段新增 circle、tick、area、trail、arc 和 boxplot；bar/area 增加 normalize、center，rect 增加面积编码，text 增加连续位置和字号编码。表格仍由 PivotTableCore 处理，地图仍由地理 renderer 处理。

用户在本阶段明确授权扩展 **Graphic Walker 计算层**，以提供箱线图统计结果。这不是把统计计算放入图表库，也不引入 LOD、VizQL 或新计算 DSL。SQL 和已有表达式仍走现有执行链。

## 类型与语义

| 类型 | 输入与绘制 | 交互单位 |
| --- | --- | --- |
| circle | 固定圆形；size 表示像素面积 | 单条结果 |
| tick | 单轴或双轴刻度；size 控制长度，tickThickness 控制厚度 | 单条结果 |
| area | 线性相邻段填充至基线或堆积上下界；支持 x/y progression，null 断段 | 相邻两条结果及稳定 segment ID |
| trail | 相邻端点宽度形成填充带，沿段线性变化；转角共享截面，斜接长度不超过半宽的四倍 | 相邻两条结果，按多边形及指针容差命中 |
| arc | 完整 pane 内按非负 theta 权重分配角度；缺 theta 时等分 | 单个扇区对应的结果 |
| boxplot | 已计算的五个统计角色及离群点；支持水平、垂直、并列系列和多度量槽 | 箱体/须为统计组；离群点为独立观测 |
| rect size | 像素面积，保持格子宽高比且不超出单元格；缺 size 时铺满格子 | 单条结果 |
| text size | 字号像素；可使用连续坐标 | 单条结果 |

`auto` 可落到 tick，单连续字段不再因缺少 mark 而失败。不同度量槽需要不同自动 mark 时仍给出明确诊断，不猜测一个统一类型。

area、trail 与 line 共用序列身份、排序和断段规则。每段事件携带两个端点，不把整条线或整片面积伪装成一条原始记录。指针 hover/click 沿实际几何边缘保留既有的 3 CSS px 容差，便于选择细线和窄轨迹；框选按几何相交判断。圆环孔作为明确排除区域，不受这项容差扩张。路径色彩使用常量或离散系列；本阶段没有曲线插值、多标记层或任意渐变。

## 堆积、值域与位置

zero 对正负值分别从零累计。normalize 和 center 使用绝对值作为厚度：normalize 将每个位置组映射到 `[0,1]`；center 用当前完整 pane 中最大的组厚度对齐中心。原始数值、符号和 datum identity 保留在事件中，不被显示端点覆盖。此语义与既有 [Vega stack 布局](https://vega.github.io/vega/docs/transforms/stack/) 以及其 [normalize/center 实现](https://github.com/vega/vega/blob/main/packages/vega-encode/src/Stack.js) 对齐。

全零组的端点固定为零；不可表示的累计值明确失败。core 的端点函数同时供完整数据的域准备和可见 pane 几何使用。共享、prefix 和 pane 域都建立在完整 pane 的端点上，滚动不会重新定义比例。

normalize 的数值轴采用百分比格式或现有 `normalizedNumberFormat`，分类轴和原始数值 tooltip 保留各自格式。

## 饼图与圆环图

arc 的行列架全部解释为分面维度，theta/radius 是极坐标通道。现有 query 会保留行列分面字段；仅放开 mark 名称而不改变实际查询字段是不够的。行列中的度量位置会被明确拒绝。

扇区从正上方顺时针开始，按稳定记录次序排列。theta 为 null 或零时不生成扇区；负值拒绝。大但有限的权重先按最大值缩放，避免总和溢出。theta 直接表示权重，不套用比例尺变换。

radius 表示半径像素；size 表示面积后转换为半径。两者不能同时绑定。字段映射使用完整域，默认从零开始；null/零半径不绘制。内外半径来自既有主题入口 `VegaGlobalConfig.arc.innerRadius/outerRadius`，最终受 pane 可用范围约束。圆环是 arc 的样式，不新增独立 IChart mark。VL 导入目前不能持久化 innerRadius，会返回属性诊断。

Canvas、SVG 与 SVG 导出共用同一圆弧参数。整圆使用可表达完整圆周的路径，框选按真实环形扇区计算；pointer 沿外缘和角边保留上述容差，圆环孔始终排除。此实现参考 [arc 的通道定义](https://vega.github.io/vega-lite/docs/arc.html)，不依赖其 renderer。

## 箱线图的计算与结果合同

计算发生在 GW 公共计算层：现有 provider 先执行过滤、表达式和 raw 查询，公共结果阶段再计算统计。外部 provider 不需要理解新的查询操作；本地和外部结果使用相同分位数定义。

箱线图按行列维度、颜色、明细和不透明度等组字段划分样本，每个度量槽独立计算。忽略 null 数值；非有限数、数值字符串和缺列是错误。Q1、中位数、Q3 使用排序样本上的线性分位数。须端点是落在 1.5 IQR 围栏内的实际观测值；围栏外观测保留为离群点。全 null 样本保留 empty 角色行以保留分面成员，但不产生虚构箱体。

原始样本查询不使用展示行数 limit，避免用前 N 行计算一个看似完整的箱图。`IComputationFunction` 目前只返回记录数组，不能检测外部 provider 未声明的截断；provider 必须按请求返回完整筛选结果。计算期间仍保留原有请求所有权和版本检查，旧查询不得覆盖新图。

计算结果先作为 sidecar 附在已完成查询上；native 结果适配只映射身份与列，不重新计算分位数。图表库接收如下内部合同：

- `RenderPlan.mark = 'boxplot'`，`barOrientation` 决定数值方向。
- `RenderPlan.boxplot` 指定独立的 `groupKeyColumn` 和 `roleColumn`。
- 每个统计组含 lower、q1、median、q3、upper 五条结果，数值位置列存对应统计值。outlier 角色使用真实离群观测值。
- 元数据列动态分配，不能覆盖用户数据列，也不是新的可视化字段。
- 其他并行度量槽的值为 null，避免把一组统计画到错误槽位。
- 统计组使用 group/measure/role 身份；离群点保留原查询行身份与度量身份。选择箱体返回五个统计端点，选择离群点返回该观测。

库验证统计组完整性、角色唯一性、类别/系列一致性及 `Q1 ≤ median ≤ Q3`、`lower ≤ upper`。小样本的线性分位数可能位于实际须端点之外，例如 `[1,2,3,100]` 的 Q3 为 27.25、上须为 3；不能为了强制五值单调而修改统计值。缺项或错序不能提交一帧。它不接受原始观测然后自行推导统计。箱体的多个绘制命令通过 `interactionId` 共享一个选择目标，缓存后重绘仍保持整组高亮。

本阶段普通 raw 箱线图与显式多度量槽属于范围；折叠后的虚拟 measure-name/value 箱图、聚合 SQL 表达式和聚合过滤器均给出明确诊断；普通原始行过滤沿用既有查询。箱图样式的任意 Vega 参数不在本阶段范围内。

## 验收

每个新类型都使用同一 Scene，Canvas 模式仍只有一个可见 Canvas。必须检查 SVG 交互、切换后端、导出、深层分面、双向滚动、零值/null、稳定选择和错误恢复。统计测试分别核对分位数、实际须端点、离群观测身份、多槽位、过滤后样本和完整查询；不能只断言画出了一个矩形。

原 S0–S3 验收报告保留为历史证据。S4 新结果记录在 `docs/verification/s4/`，不把旧版本的性能测量称为本次新类型测量。


最终记录：[独立代码审核](./verification/s4/code-review.md)、[独立浏览器验收](./verification/s4/browser-acceptance.md)、[工程验证](./verification/s4/engineering-validation.md)。库 298 项、GW 473 项及 4 snapshots 通过。三引擎完整 162 项通过后，最后的圆环孔命中修复又在新构建上复跑 48 项新增图形测试与独立边界探针，全部通过。每次构建的具体身份和结果分别保留，不合并成一次执行。
