# S1 独立浏览器验收

2026-11-06。独立 Playwright Chromium 会话访问 `http://127.0.0.1:4178/`。先操作正在开发的演示，产品源码和 demo 冻结后重新加载，复验下列场景。通过真实控件、鼠标和键盘操作，并读取同一页面的 `window.worksheetDemo.view.getViewState()` 检查 Scene、几何和选择。

**结果：通过下列 S1 浏览器场景，未发现未解决的浏览器验收阻断项。** 这是独立演示的 S1 验收，不代表 S2 的分页导出或 B2–B5 资源和性能基准，也不代表 S3 的 Graphic Walker 产品接入已经完成。

| 场景 | 最终候选的实际结果 |
| --- | --- |
| 五种 mark 和深层表头 | Regional sales、line、heatmap、text、grouped、stack、scatter、deep、scope、interval 十个准备数据示例均加载为 complete；每个 Canvas 场景有且仅有一个 Canvas。line、rect、text、bar、point 均有实际可见几何和命中记录。deep 的八层表头场景有 20 个视口 hit。 |
| 折线和区间 | East 的 New 系列在显式 null 两侧的线段止于 datum 2、从 datum 4 重新开始，没有跨缺失值连接。实际点击首段返回两个端点 `line:0:0:0` 和 `line:0:0:1`，tooltip 包含两端的值。输入区间 `[0,10]`、`[10,25]`、`[25,50]` 的绘制宽度分别为 36、54、90 CSS px。 |
| grouped、stack、cell 和 point | grouped 的同类别三系列柱使用相邻槽位；stack 的正值柱首尾相接，负值位于零线另一侧。heatmap 和 text 各有 12 个命中项；scatter 的 12 个点使用不同尺寸、形状与透明度。 |
| 域作用域 | 对 East、Office、Online 的值 10 和 40，shared 下柱高约 0.054 和 0.217 px，prefix 下约 5.424 和 21.695 px，pane 下两者均约 21.695 px。新 fixture 同一 Region 有两个不同范围的 pane，可区分三种作用域。 |
| Canvas 和 SVG | 上述十个示例逐一从 Canvas 切换 SVG，两个后端的 Scene commands 和 hits 相等，每次 SVG 只有一个根。实际选择两条数据后切换后端，两个目标的字段和稳定身份保留。 |
| 指针和可访问视图 | 悬停 bar 显示准备值；普通点击一条，再用 Command 点击另一条，得到两个目标；Shift 拖框得到对应两条目标。Visible data 面板显示可见 chart item 和准备值。键盘代理的方向键移动焦点，Enter 选择，H 切换到表头；表头可访问名称包含完整路径，只有可折叠表头带展开状态。 |
| 受控行列折叠 | 点击 West 后先显示等待宿主，随后得到 accepted；West×2026 缺少父级记录，保持空白，West×2025 显示宿主提供的 70/85。点击 2026 折叠后，East 使用 95/115；键盘 H、方向键、Enter 折叠 East 后，East×2026 显示宿主提供的 140/155。没有由子值自动生成父值。 |
| 排序与选择 | 键盘 S 发出排序请求并得到 accepted，Region 从 West、East 变为 East、West。初验时实际选中 West/Seattle/2026/Q2 的记录后排序，markId 和 datumKey 保持不变。 |
| SVG 回收 | 程序化 windowed source 在首尾之间实际点击八次，每次 SVG 子节点 220、defs 后代 74、可见 hit 12；首末逻辑纵向偏移为 0 和 179999498。这是按窗口返回非空记录的程序化数据，不是百万条真实记录性能测量。 |
| 错误与状态 | 初验发现的初始化 `readSharedDomains is not defined` 已修复。旧请求到期提示曾跨场景残留；修复后等待请求到期，再切换场景，status 被隐藏且文本清空。最终 Chromium console error 为 0。 |

另在最终候选上用 Playwright WebKit 引擎 smoke：line、heatmap、text、grouped、stack、scatter、deep、scope、interval 和 controlled 均 complete 且无页面错误；实际点击 West 折叠得到 accepted，console error 为 0。Playwright WebKit 不是正式 Safari 产品版本；本轮没有执行正式 Safari 或 Firefox 验收。

证据为同目录的 `heatmap.png`、`line.png` 和 `controlled.png`，均来自独立 Chromium 的实际页面；结论也依据上述实际输入事件、Scene、命中和宿主状态，并非只看截图。
