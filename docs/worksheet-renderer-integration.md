# Native Worksheet 的 GW 接入

图表类型扩展和箱线图计算边界见 [S4 文档](./worksheet-renderer-chart-types.md)。

状态：S3 接入与 S4 图表扩展已通过独立代码审核、浏览器验收和构建消费检查。本文件说明现有 API 与边界；完整验收证据见 [实施记录](./worksheet-renderer-implementation.md)。

## 选择渲染器

现有 `IChart` 仍是保存格式。普通图表通过 `chart.layout.renderer = 'native'` 使用 Native Worksheet，通过 `layout.useSvg` 在 Canvas 和 SVG 之间切换。编辑器的可视化配置面板提供 Native Worksheet 选项；`defaultRenderer="native"` 设置新建图表的默认值。

```tsx
<GraphicWalker
    data={rows}
    fields={fields}
    defaultRenderer="native"
    nativeRenderer={{
        // 原始模式下，id 必须包含在查询结果中，例如作为 details 字段。
        getResultRowKey: (row) => row.id,
        onSelectionChange: (event) => {
            // 每个 target 是一个精确选择，不应按字段合并成独立取值列表。
            console.log(event.version, event.targets);
        },
    }}
/>
```

`GraphicRenderer` 和 `PureRenderer` 接受同一组 `nativeRenderer` 宿主选项。PureRenderer 继续接受 `visualState`、`visualConfig`、`visualLayout`，其可选 `onRendererChange` 用于向受控宿主请求切换。宿主接受请求后更新 `visualLayout.renderer`。旧图表的默认 renderer 不变。

PivotTable 和 geographic 图表仍走现有专门组件。普通 rows/columns 不再受旧渲染器的字段数量裁剪影响；旧后端无法表示深层分面或 worksheet 特定配置时显示 `unsupported-renderer`，保留图表内容，由用户明确选择 native。

## 查询与显示的交接

现有 `toWorkflow` 和 computation 执行查询，返回未 fold 的查询结果。接入层把该结果与 workflow、source/snapshot 版本作为同一次完成结果提交，再准备 native 所需的列绑定、fold 身份和时间显示坐标。库内不执行过滤、聚合、SQL、表计算或 LOD。 Native 箱线图另在 GW 公共计算结果阶段生成分位数、实际须端点和离群观测，查询返回完整筛选样本后才计算；图表库消费统计角色行。详见 S4 文档。

时间坐标由 GW 侧的纯显示 helper 逐值准备，native、Vega 和 Plot 共用该规则。原时间列保留，新增的显示列按字段和 offset 区分；null 保留为空，数值 0 是有效时间戳。混合 ISO 与日期字符串不再由首行格式决定整列偏移，重排不会改变某条记录的坐标。这个修正也消除了旧 Plot 路径忽略 Vega 时间 transform 的差异。显示别名不写入 IChart，scale 回调与选择仍使用原字段和原值。

新查询尚未完成时，native 旧画面仅作为被遮罩的参考，交互与导出均被阻断。过期请求不能覆盖当前结果，也不能在编辑器或 GraphicRenderer 中触发属于旧请求的错误弹窗。当前查询失败仍正常报告；仅切换 Canvas/SVG、主题、尺寸或 renderer 不改变查询所有权，也不会隐藏该查询的错误。请求寿命记录在内部 WeakMap，宿主收到的 computation payload 和公开签名不变。

GW 本次接入消费现有 computation 的完整结果。独立子包同时提供已准备的窗口数据源合同，宿主可按逻辑行列供给窗口、完整域和版本；该合同不自动把 GW 查询改成服务端分页。两种入口都受窗口绘制和运行时资源预算限制，完整输入与供数索引另计。

## 身份与选择事件

聚合结果使用现有 workflow 的 groupBy 原始值确定身份。fold 还包含原字段 fid、聚合名称与结果列身份；同名度量不会因此合并。原始查询可通过 `getResultRowKey` 提供稳定且唯一的字符串或数值键。缺少该函数时，身份只在当前结果快照中稳定，并有说明；无效或重复键明确报错。

`getResultRowKey` 接收当前查询返回的行，并非输入数据表的完整原始行。用作键的列须进入查询结果；仅在元数据里声明该字段不足以保证返回该列。

`NativeSelectionEvent` 公开 `version`、`inputRevision`、`frameId`、`source`、`operation` 与 `targets`。每个 target 保留 pane、slot、datumKeys、字段实例和原始值。line 线段还提供有序端点，不能把线段误当作一条记录。时间显示偏移后的值与查询原值分开保存。

滚动及 Canvas/SVG 切换保留当前有效选择。跨查询结果更新按稳定身份重新验证；快照身份不能承诺跨查询保留。多目标事件不会自动转成维度取值的笛卡尔组合。现有嵌入菜单只处理可表达为单条原始记录的实际点击，其他选择由结构化回调交给宿主。

## 排序、折叠与格式

表头排序和折叠是当前显示状态。接入层响应受控请求并提交新的 presentation 版本，不执行新的业务计算。折叠到父节点时只显示已提供的父粒度记录；没有父值则保持空槽，不把子记录求和。当前 GW 完整查询结果通常只有当前粒度，因此折叠父位置可能为空。

既有 measure-driven sort 需要每个成员已有唯一的比较值。若多个结果值需要重新汇总才能得出排序指标，接入层返回诊断；图表库不生成排序用的业务统计。固定 domain 和外部成员顺序保持权威。

展示配置沿用现有主题、宿主 scales 和 layout 的优先级。`layout.worksheet.scaleScopes` 补充 shared/pane/prefix 位置域，`layout.worksheet.barLayout = 'grouped'` 表示分组柱。其余支持清单见 [设计文档](./worksheet-renderer-design.md) 与 [VL 输入转换清单](./worksheet-renderer-vl-import.md)。

## 公开导出 API

PureRenderer 继续通过 ref 返回 `getSVGData`、`getCanvasData`、`downloadSVG`、`downloadPNG`，结果类型仍为 `Promise<string[]>`。Native Worksheet 是一个图表实例，所以数组包含一份当前完整视口。SVG 返回 SVG 文本，Canvas 返回 PNG data URL；格式选择不要求切换当前绘制后端。

GraphicWalker/GraphicRenderer 的 `IGWHandler.exportChart('svg' | 'data-url')` 返回单张视口图和 `chartType: 'native'`，行列图表数量为 1×1。这些行列数量表示导出图表实例，不是工作表内 pane 数。`exportChartList` 沿用应用图表导航并等待当前图表完成。

导出在调用时和完成时核对当前显示版本；查询、显示更新或卸载使旧导出失效，不能悄悄返回上一张图。独立子包另外提供有限逻辑范围与分页 SVG 导出，公开 GW 旧 ref 的含义保持为当前视口。

## 构建与验证

仓库根目录 `yarn build` 先构建 worksheet 子包，再构建 GW。GW 使用正式包入口，不依赖子包内部源码路径。核心根入口不依赖 React，React 适配器在独立 `/react` 入口。

`yarn test:consumer` 将两个包打成 tarball，在仓库外安装和构建消费项目；本地 worksheet tarball 通过测试项目的 resolution 解析，验证不依赖仓库 symlink，也不要求先发布 npm 版本。浏览器回归入口位于 `packages/graphic-walker/tests/e2e/native-worksheet.html` 和 `native-renderer.html`，覆盖产品链路与直接组件生命周期。
