# S2 辅助功能补充验收

后续独立复验已使用 VoiceOver 字幕及键盘导航读出摘要、位置和按需数据行，见 [最终读屏验收](./accessibility-final.md)。本文件保留较早一轮的发现与限制。

2026-11-06，macOS 26.5.2、Safari 26.5.2，冻结版 S2 演示 `http://127.0.0.1:4178/`。本次结果不足以关闭 A14 的真实读屏验收，也不足以确认物理触控板行为。

## VoiceOver

系统设置中的 VoiceOver 开始为 off。通过系统设置将其打开，确认开关为 on 且 VoiceOver 进程运行。VoiceOver Utility 中“Show caption panel”原本为 on，没有修改该选项。Safari 使用 Controlled headers 示例，焦点放到数据项后按 H，页面的辅助功能状态显示 `Row header: West`、expanded；按 Enter 后先显示 `Waiting for host: collapse West`，随后请求 accepted，焦点仍在 West，状态变为 collapsed，可见行位置由 4 变为 3。这是在 VoiceOver 运行时执行的键盘操作。

后续使用系统桌面截图观察到 VoiceOver 自身的字幕面板，截图只保存面板裁剪，避免包含无关桌面内容。[数据项字幕](./voiceover-data-caption.png)显示 Region: Group 0、Category: Item 4、Subcategory: Standard、Year: 2025、sum(Sales): 104、sum(Profit): 40；[West 折叠](./voiceover-collapsed-caption.png)及[展开](./voiceover-expanded-caption.png)字幕分别明确显示 collapsed 和 expanded。运行时使用 H 和 Enter 完成状态切换。字幕是 VoiceOver 的实际输出文本；没有录制或听到音频。尚未通过 VoiceOver 字幕确认工作表摘要、位置及按需数据表中的具体行，A14 全项仍开放。完成后在系统设置确认 VoiceOver 已恢复为 off。

## 原生滚动输入

Safari 的 Windowed source 示例、SVG 后端，起始摘要为 1,000,000 行，行起点 1、offset 0, 0。通过计算机控制接口在工作表内发送一次原生向下滚动，摘要变为行起点 4、offset 0, 697，列头和行头仍可见。随后发送两次向右原生滚动，摘要没有改变，横向偏移仍为 0。该接口使用页面单位，未提供触控板手势的硬件来源或惯性阶段证据；不能据此判定真实触控板，也不能据此断言横向触控板滚动存在产品缺陷。

补测没有改动产品代码，也没有重跑性能基准。120 Hz 是否替代原要求 60 Hz 的决定仍待用户确认。真实 VoiceOver 听读和物理触控板双向手势应在具备可观察读屏输出与实际输入设备的环境复验。
