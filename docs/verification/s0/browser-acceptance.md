# S0 独立浏览器验收

2026-11-06。使用独立 Playwright Chromium 会话访问 `http://127.0.0.1:4178/`，在修复后重新加载构建复验。以下结论仅覆盖 S0 纵切和本页程序化 fixture，不代表 S1–S3 或 B3 百万条真实记录性能基准。

**结果：通过所列 S0 浏览器场景；当前没有未解决的浏览器验收阻断项。**

| 场景 | 实际结果 |
| --- | --- |
| 初始画面 | Nested fixture 正常显示；重新加载后的浏览器 console error 为 0。Sales 轴显示 0、97.5、195，多个度量表头不再重叠。 |
| 单 Canvas、滚动与冻结头 | 700×800 视口中仅一个可见 Canvas，位图为 650×558。实际双轴滚动后偏移 30、60，位图尺寸不变；相同 body cell 从 (156,54) 移至 (126,-6)，行头横坐标和列头纵坐标保持固定。 |
| 超长范围 | Windowed source 确实返回非空记录。Last 到达逻辑偏移 (466,179999496)，末行 `Item 999999` 可见；First 返回 (0,0) 并读到 `Item 0`。这是程序化窗口供数，不是百万条真实记录基准。 |
| SVG 与选择 | 切换 SVG 后仅一个 SVG 根，Canvas 与 SVG 的 Scene commands 和 hit records 完全一致；实际点击标记可选中。切换后端保留所选身份。通过控制器以 point mark 驱动同一 fixture，浏览器点击 SVG 点后切 Canvas，选择身份和 Scene 保持一致；demo 控件本身只暴露 bar 示例。 |
| 导出 | 实际点击 Export viewport SVG 下载成功；XML 解析成功，根为 SVG，viewBox 为 `0 0 650 558`，无 script 元素。见同目录 `export.svg`。 |
| Resize | 窗口宽度由 700 调整至 1000 时，Canvas 位图从 650×558 调整为 950×558，仍只有一个 Canvas，偏移保持 (30,60)。 |
| 快速切换 | 交错切换 fixture/backend 八次后，最终控件为 Windowed/Canvas，已提交 source、1,000,000 行、可见 `Item 0` 记录及单 Canvas 一致。 |
| 失败状态 | 注入 `describe` 抛错后 update 为 rejected，旧 hit 不能选中，导出拒绝；注入 `coveredWindows: []` 后 update 为 rejected，导出拒绝；恢复正常 source 后再次 committed。 |

初验发现的 favicon 404、Sales 零点域、度量表头重影及切换 source 后旧选择详情残留，均在后续构建中复验修复。曾怀疑滚轮位移翻倍；捕获 DOM 事件后确认 Playwright 的一次 wheel 调用在该环境发出一个 delta 为 60/120 的事件，最终逻辑偏移也是 60/120，事件在冒泡结束时已被阻止默认行为，因此撤回该疑点。

证据：`nested-fixed.png` 为修复后的 Nested 视图截图；`export.svg` 为 UI 实际下载的视口 SVG。浏览器会话中还检查了数据、Scene、点击结果及错误状态，截图不是唯一依据。

## 最终修复后复验

最终构建重新加载后，在 Chromium 的 700×800 视口复验通过：Nested 有 18 个视口 hit、一个 650×558 Canvas；实际点击标记后切换 SVG，选择身份、Scene commands 和 hit records 均保持一致，SVG 根数量为一。切换到 Windowed 后 Last 到达 (466,179999496)，显示 `Item 999999`；跨 source 的旧选择已清空。注入 `describe` 失败后 update 为 rejected、无旧 hit、导出拒绝，恢复正常 source 后 committed 且重新出现 18 个 hit。Chromium console error 为 0。

另外使用本机 Playwright WebKit 引擎进行超长范围 smoke：Last 和 First 分别到达上述末点与 (0,0)，并分别显示 `Item 999999` 与 `Item 0`；实际 wheel DOM 事件为 (30,60)，被阻止默认行为，逻辑偏移为 (30,60)；聚焦工作表后按 ArrowDown，纵向偏移由 60 变为 100。WebKit console error 为 0。Playwright WebKit 不等于实际 Safari 产品版本。本机缓存的 Firefox 版本与当前 Playwright 所需版本不匹配，未安装新浏览器，也未执行 Firefox smoke。
