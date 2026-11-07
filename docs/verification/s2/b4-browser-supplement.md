# B4 完整规模浏览器功能补测

2026-11-06。`http://127.0.0.1:4182/` 冻结的 S2 benchmark，Chromium 和 Safari。B4 的源按需程序化生成，清单为 1,000,000,000 行 × 1,000,000 列；它不创建 10^15 条记录，也不证明 B3 的百万真实记录索引能力。没有运行性能循环。

Chromium 通过页面选择 B4、Canvas 和 Prepare，首窗口摘要为行 1、列 1、42 项 complete，单 Canvas，frame/displayedFrame 均为 1。实际点击 Last position 后，摘要为行 999,999,994、列 999,993、42 项 complete，frame/displayedFrame 均为 2；scrollX 159,998,810，scrollY 119,999,999,260，diagnostics 为空。使用宿主公开 `move` 依次定位到 (100, 最大值)、(最大值, 100)、(50,000,000, 60,000,000,000) 和 (0, 0)，摘要分别为行/列 999,999,994/1、1/999,993、500,000,001/312,501、1/1，均 complete、无诊断。坐标的远近不同不等于验证了一个轴使用普通滚动范围。该固定 B4 的两轴逻辑范围均超出浏览器原生滚动范围，混合压缩轴和普通轴的组合没有在此验证。

同页通过宿主 API 准备 SVG B4。首末摘要分别为 1/1 和 999,999,994/999,993，均 42 项 complete、无诊断，首末显示 frame 与已提交 frame 一致，SVG 有 744 个后代。Safari 单独通过 UI 准备 Canvas B4；计算机控制接口发送一次向下原生滚动后摘要行起点 1→6，工作表聚焦后按 End 到达行 999,999,994、列 999,993。向右原生滚动输入没有引起摘要变化；该接口未提供触控板硬件或惯性证据。该结果不能证明物理双向手势，也不足以判定横向滚动缺陷。

本基准页以 `autoResize: false`、固定 1440 × 900 创建控制器，未暴露 resize API，本次没有验证 B4 resize。当时混合压缩/普通轴和 resize 尚未验证，后续结果见下节。120 Hz 替代 60 Hz 的用户决定仍待确认。

## 混合轴和 resize 补测

在 `work/b4-mixed.ts` 临时宿主直接复用冻结的 B4 plan、可设行列数的程序化 source 和公开 `createWorksheet`，未修改产品。Chromium Canvas，初始宿主 1000 × 600。1,000,000,000 行 × 20 列时，原生滚动内容尺寸为 3450 × 1,000,160，列轴是普通范围，行轴压缩；末位置逻辑坐标为 (2450, 119,999,999,560)，摘要 999,999,997/16。20 行 × 1,000,000 列时，尺寸为 1,000,250 × 2560，列轴压缩，行轴普通；末位置为 (159,999,250, 1960)，摘要 17/999,996。两种窗口均 complete，frame 和 displayed frame 一致。

将宿主元素与控制器一起缩为 800 × 400 后再定位末尾。两组分别为摘要 999,999,999/17 和 19/999,997，各 6 项 complete，frame/displayed frame 均 3。第二组键盘 End 到末尾，Home 返回 1/1；通过浏览器鼠标滚轮的 90 像素纵向输入使逻辑 y 从 0 变为 90。以上混合轴跳转与 resize 是宿主公开 API 调用，非物理拖动。浏览器的系统滚动条为自动隐藏，尝试在底边模拟拖动未改变 scrollLeft，不能声称滚动条拖动通过；物理触控板也未测试。

复现：从仓库根目录执行 `./node_modules/.bin/esbuild docs/verification/s2/b4-mixed-harness.ts --bundle --outfile=work/b4-mixed.js --platform=browser`，在 `work/b4-mixed.html` 放入 `<div id="host" style="width:1000px;height:600px"></div><script src="./b4-mixed.js"></script>`，用本地静态服务器打开，调用 `testMixed(rows, columns, 'canvas')` 及 `testView()`。测试时实际混合轴自编宿主 JS SHA-256 为 `f1ae9b64870b7e6a792469da0c2a0401830aecba29045996dd51c008ce41d745`；它从 S2 源码现编，不是 4182 的 bundle。4182 冻结 benchmark bundle SHA-256 为 `39006c5067100fccb2225f4f66f0893ef0009e9f368e27189a101ec954116f14`。

随后在隔离 headless Chromium 的同一临时宿主加局部 `::-webkit-scrollbar` 样式（16 px 宽高、灰色轨道、深灰滑块），使原生滚动条持续可见，不改产品或系统设置。鼠标实际拖动两个滚动条：[样式截图](./b4-visible-scrollbars.png)。20 × 1,000,000 时，先拖压缩横轴到末尾，逻辑 x = 159,999,450；再拖普通纵轴，y = 2,160，摘要行/列 19/999,997、6 项 complete。1,000,000,000 × 20 时，先拖普通横轴到 x = 2,650，再拖压缩纵轴到 y = 119,999,999,760，摘要 999,999,999/17、6 项 complete。两组均在 800 × 400 宿主、Canvas。该测试使用浏览器鼠标拖动原生滚动条，不是物理触控板手势。复现样式可追加在临时 HTML：`#host [role=region]::-webkit-scrollbar{width:16px;height:16px;background:#eee} #host [role=region]::-webkit-scrollbar-thumb{background:#555;border:2px solid #eee;border-radius:8px}`。

软件 wheel 输入合同补测：在上述两种普通/压缩轴互换的宿主中，隔离 Chromium 使用 `mouse.wheel` 发送三个双轴、递减的像素增量 (3.5, 5.25)、(2, 3)、(1, 1.5)，随后按住 Shift 发送 (0, 7.5)。监听到四个事件均 `isTrusted=true`、`deltaMode=0`，最后一个 shiftKey=true。两组的逻辑坐标先恰为 (6.5, 9.75)，Shift 后为 (14, 9.75)，等待额外 800 ms 仍不变；没有观察到重复消费或原生滚动回声把亚像素位移清零。两组 complete。这个固定序列覆盖浏览器受信任的小数双轴输入、递减增量和 Shift 横向的软件合同，因此该范围通过；它模拟惯性序列，不证明真实触控板硬件或操作系统产生相同手势。
