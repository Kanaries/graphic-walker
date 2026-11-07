# S2 VoiceOver 独立验收

2026-11-06，macOS 26.5.2、Safari 26.5.2，冻结演示 `http://127.0.0.1:4178/`，Controlled headers 示例，SVG 后端。使用 macOS VoiceOver 自身的字幕面板观察输出，没有录音或实际听音。字幕截图只保留面板附近区域。

## 结果

指定的真实读屏项目已取得字幕证据：VoiceOver 读出库内工作表摘要和可见行列起点，也通过键盘导航进入按需数据表并读出一条数据。此前的数据项和表头展开、折叠字幕见[补充验收](./accessibility-supplement.md)。这些结果覆盖本次指定的 A14 读屏场景，并不代表对其他浏览器、示例或全部辅助功能的验收。

1. 从 Visible data 按钮向前导航，VoiceOver 读出库内摘要：`Worksheet. 4 row positions, 3 column positions. Visible rows start at 1, columns at 1. 15 visible chart items. complete.` 见[库内摘要字幕](./voiceover-library-summary.png)。
2. 展开 Visible data 后，进入 Visible worksheet data region，依次导航到 table，VoiceOver 报告 2 列、16 行。进入表格并按 VO-Down 后，字幕读出 `row 2 of 16 Region: West, City: Seattle, Year: 2026, Quarter: ∅, Category: Standard, Value: 95`。见[键盘导航数据行字幕](./voiceover-keyboard-row.png)。继续向右时，字幕开始读出同一行的 Prepared values，包含 datum key 和维度值。
3. 在工作表获得焦点后按 Home、Down，演示页状态字幕输出 `4 row positions × 3 columns · 18 visible marks · offset 0, 40 · 25 cached windows`。按 End 后输出相同维度、18 个标记及 `offset 55, 244`。见[滚动后字幕](./voiceover-summary-position.png)和[末尾偏移](./voiceover-position-end.png)。这是演示页状态，与第 1 项的库内摘要分别记录。

## 操作路径和限制

CUA 的 `pressKey` 发出 Control-Option-Shift-Down 后没有观察到 VoiceOver 进入网页，字幕仍提示按该组合键。随后在 Safari 前台用 macOS System Events 发送该组合键，字幕显示 `In Native worksheet · S2, web content, main`，确认原生输入路径有效，见[进入网页字幕](./voiceover-native-entry.png)。这说明先前 CUA 操作未取得正向输入确认，不能据此判定产品吞掉了命令。

原生输入的可复现路径如下。VO 表示 Control-Option：

1. 在展开 Visible data 后按 VO-U，使用 Form Controls 转子找到 Visible data 并按 Return。按 VO-Left 两次到库内摘要。
2. 再用转子回到 Visible data，按 VO-Right 到 Visible worksheet data region，按 VO-Shift-Down 进入。按 VO-Right 经过 Previous 100、页码和 Next 100，到达 table。
3. 按 VO-Shift-Down 进入 table，再按 VO-Down 移到第二行，即第一条数据。

在尚未进入 region 时，Tables 转子曾显示无项目；继续通过 region 的顺序导航可以进入表格并读取数据。该现象不足以单独判定缺陷。更早通过鼠标三击选中文本得到的[字幕](./voiceover-visible-row.png)也保留为补充，但键盘行读取以第 2 项为准。

各轮测试前 VoiceOver 为 off，结束后在系统设置确认恢复为 off；字幕面板原先为 on，未更改。为显示 Safari 临时使用 Hide Others，完成后执行 Show All。测试期间未修改产品代码。
