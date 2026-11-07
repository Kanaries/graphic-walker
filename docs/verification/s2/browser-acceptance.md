# S2 独立浏览器验收

2026-11-06 至 11-07。独立验收模型 gpt-6.1-terra / xhigh：冻结 S2 源码指纹 `36de7207` 的浏览器软件功能和原定真实 60 Hz 性能门禁 PASS，详见 [60 Hz 最终复验](./performance-60.md)。A14 的真实 VoiceOver 字幕和键盘路径已补测，[B4 双轴、滚动条拖动及模拟惯性 wheel](./b4-browser-supplement.md)也已补证。物理触控板未实测，模拟不代表硬件手势。Safari 为 smoke 和辅助功能路径，非完整兼容矩阵；S3 产品接入和 roundtrip 不在本报告内。后文保留开发中失败、修复及当时的 120 Hz 环境结论。

## 实际 UI 初验

通过 Playwright 操作本机 demo，逐一切换 nested、line、heatmap、text、grouped、stack、scatter、deep、scope、interval 和 Canvas/SVG。各场景均 complete、alert 为空，每个后端各有一个对应绘制根。两后端可见 mark 数分别为 24、24、12、12、27、27、12、18、27、3。这一轮核对场景、状态和根节点，不替代全部几何和选择语义断言。

Paged 输入先显示 loading、0 visible items；实际点击 Release remaining records 后 complete、24 items。Preview 初次错误提示 `The joint series domain is incomplete or invalid`；修复后重新加载并选择，显示 `Preview: incomplete input` 和 preview 状态，alert 为空。键盘焦点代理实际按方向键和 Enter 选中 East/Furniture/Premium/2025，Visible data 显示准备值。实际鼠标单击和 Meta 单击选择 East/Furniture 的 Standard 与 Premium 2025 两条记录，Canvas 切 SVG 后两条 datumKey 保留。

实际点击导出，视口 PNG 下载并解码为 2300 × 1116 RGBA，有 509 种颜色；样本见 [viewport-initial.png](./viewport-initial.png)。6 × 4 范围导出为六个 2 × 2 SVG 页面，第一文件实际下载，见 [range-page-initial.svg](./range-page-initial.svg)。检查各页文本，跨页保留 East/West 和 2025/2026 父表头。启用 Path labels 时可见父节点及完整后代路径；1440 宽页面开关前后，10 个可见 header 目标 ID 相同。开始导出后切换示例到 line，六页仍保持原 u1 snapshot 1，UI 切换到 scenario:line。另一轮在第一页完成后点击取消，一秒后 active/queued/consumers 均为 0，export 资源分区为 0。程序化 huge source 初始视口位置 0，导出 6 × 4 范围时资源 reads 从 95 增至 108，六页完整覆盖范围。Last position 到逻辑 Y 179999498，再按 First 回 0；缩小视口后 SVG 仍为单根且无 alert。实际鼠标滚轮后逻辑 Y 为 1000，聚焦表格按 End 后 Y 为 179999498，均 complete。此 huge source 是 B4 测试，不是 B3 真实记录。

Firefox 158.0 的隔离 Playwright 浏览器逐一切换十个示例和 Canvas/SVG，均 complete、单根、无 alert，两个后端的 hit 数相等；deep 因视口不同为 20。该浏览器还实际切换 Canvas/SVG，Paged loading 为 0 项，释放后 24 项和单 SVG 根；Preview 显示 incomplete data 和 preview，无 alert；视口 PNG 实际下载，解码为 1230 × 558 RGBA。真实 Safari 26.5.2 通过原生窗口操作，Canvas 和 SVG 场景 complete；SVG Paged 先 loading 0 项，释放后 complete、20 项。该 Safari 测试只是基本交互 smoke，非完整兼容矩阵。初验当时尚未实测屏幕阅读器或触控板；后续读屏证据见文末。

## 初步基准

机器 Apple M4 Max、64 GiB、macOS 26.5.2。浏览器 Headless Chromium 132，1440 × 900 CSS px、DPR 2，种子 1592598566，字体配置 Arial / Noto Sans CJK SC / sans-serif。`font.check` 结果不能证明实际回退字形。空闲页面连续 240 个 rAF 间隔实测 p50 8.3 ms、p95 10.0 ms、最小 6.5 ms、最大 14.7 ms，约 120 Hz，不能称作物理 60 Hz 参考机。所有基准调用 30 次冷控制器、5 × 300 次实际浏览器呈现的控制器滚动，以及 50 次挂载/销毁。程序化控制器滚动不是原生滚轮或触控板性能测试。以下为未冻结构建的初验，不能直接作为最终验收。

| Case | 构建 SHA-256 | 冷提交 p95 | 冷呈现 p95 | 滚动提交 p95 | rAF 间隔 p95 | 限制 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| B2 Canvas | `07cce67abcd25a8e16773619132c20d9d0609c31df0d8635927b4a569a5bc794` | 32.1 ms | 58.5 ms | 29.6 ms | 34.2 ms | 33 ms 呈现目标未达，内存报告空对象 |
| B3 Canvas | `07cce67abcd25a8e16773619132c20d9d0609c31df0d8635927b4a569a5bc794` | 18.1 ms | 27.0 ms | 13.9 ms | 9.2 ms | 内存报告空对象，非 60 Hz；索引单次 2247.4 ms |
| B5 SVG | `ce0782a6998b0deeaae0b01f97d21fbbf4e5630f8aae3a689e9dd520b5d932a8` | 53.4 ms | 87.4 ms | 56.7 ms | 66.7 ms | 呈现目标未达；调度至提交 p95 56.7 ms，不能代替交互延迟测量；各轮 submit p95 22.9–24.2 ms |

原始结果分别为 [B2](./browser-B2-initial.json)、[B3](./browser-B3-initial.json)、[B5](./browser-B5-initial.json)。B3 实际生成 1,000,000 条记录、100,000 × 1,000 叶、每轴 6 层，输入 706.6 ms、adapter 0.6 ms、索引 2247.4 ms。B2 各轮 CPU p95 19.5–20.2 ms，scene 4.0–4.3 ms，submit 1.7–1.8 ms，read 14.1–14.6 ms；共 10 个 long task 和 1500 个超过 25 ms 的 rAF 间隔。B5 各轮 scene p95 4.6–4.8 ms、read 16.9–17.1 ms；1495 个 long task，1500 个超过 25 ms 的 rAF 间隔。B5 每轮末尾 1833 个 SVG 后代，50 次销毁后 DOM 为 0，显式 GC 后 heap 增长 3.22%；此 heap 包含输入与索引，不能当作运行时独占内存。早期 B2/B3 的 memory getter 将不可枚举属性展开为空对象，故无法判断 heap 增长；已修正，需冻结构建复测。早期 CPU 指标的同步部分计数也已修正，旧数据不能作为完整 CPU 门禁。

B2 的 [CDP CPU profile](./B2-cpu-profile-initial.json) 在 SHA `ce0782a6998b0deeaae0b01f97d21fbbf4e5630f8aae3a689e9dd520b5d932a8` 上采集 150 次热移动，1 ms 采样，共 5014 samples。按 self hit 合计 `validateWindow` 1998、`validateRecordValues` 774、`estimateBytes` 168，验证工作占主要比例。该 profile 包含 idle，采样不是精确 wall time。

B5 5,000 mark 压力输入实际 `prepare('B5', {backend:'svg', svgStress:true})` 被 `viewport exceeds 100 pane positions` 拒绝。该容量测试未通过，不能以普通 B5 场景代替。最终冻结构建需重跑 B2/B3/B5、内存与生命周期、压力场景及相关交互，并记录明确环境和原始数据。

最新性能修改后，SHA `b4b950397559448227d9eabade2e7542089eda26e2cffddbec82085a489cad3e` 的 quick pilot 各执行 30 次热移动。B2 的 commit/完整 CPU/scene/submit/read p95 分别为 17.0/8.2/4.6/1.7/0.5 ms，rAF 间隔 p95 10.0 ms。B5 分别为 25.7/21.7/4.1/8.3/0.6 ms，rAF 间隔 p95 17.2 ms；[B5 pilot 原始数据](./browser-B5-pilot.json)。两者均无 long task 或超过 25 ms 间隔。这是短样本探索，不替代规定的 1500 次滚动或 50 次生命周期。

最新 stress pilot 的 SHA `b689f6bf651d82f1edf7b82520f50801b60df6c1883f5268ac571fd960e0e9f7` 已可实际提交完整初始视口：203,000 条记录，5,000 个可见 chart item，6,190 个 SVG 后代。30 次热移动的 commit/完整 CPU/scene/submit/read p95 为 83.8/78.6/19.6/22.7/0.7 ms，rAF 间隔 p95 为 83.4 ms，有 29 个 long task、30 个超过 25 ms 的间隔。热移动的资源账本最高现存 57,999,826 bytes、历史峰值 88,596,346 bytes；完整输入、索引和浏览器 heap 不包含在该账本中。三次生命周期后 DOM 为 0，显式 GC 后 heap 增长 10.047%；样本太少，不能判断正式 50 次生命周期。结果仍不满足目标。原始数据见 [B5 stress pilot](./browser-B5-stress-pilot.json)。同构建的 [CDP profile](./B5-stress-profile.json) 采样 100 次热移动，共 5490 samples；self hits 以 tooltip 1002、estimateBytes 956、匿名函数 725、selectedColor 589 和 setAttribute 420 较多，采样包含 idle 和程序节点，不是精确耗时。

在上述 stress pilot 会话中，初始 5,000 项 complete 后实际调用 `move(1, 1)`，返回 `resource-limit: viewport exceeds 100 pane positions; increase fixed strip sizes`。目标位置为 (1, 1)，显示帧停留在第 1 帧。四个整格偏移的 quick 结果不能证明连续像素滚动；新版修复后需要在完整密度下复验并记录可见 pane/mark 的资源合同。

后续 SHA `4aaf7eb289f940b68444c2523782eae18ee838e6242456ad4c8bdd3f9ae8cfe9` 的连续像素试验已允许 (1, 1)，但沿对角线每次移动 1 px，连续完成 22 次后在 (23, 23) 报 `SVG exceeds 5,000 marks or 10,000 elements`。首次 22 次提交 p95 184.3 ms、rAF p95 183.4 ms；重试在同一位置失败，逐帧见 [B5 pixel pilot](./B5-pixel-pilot.json)。此构建的普通 B2/B5 quick 各 30 次热移动，完整 CPU p95 分别 4.0/3.9 ms，rAF p95 8.8/8.4 ms，geometry 各 72 项约 13.75 MB，0 次 eviction；不能用普通密度掩盖 stress 失败。

同 4aaf7e 候选构建还跑完完整样本，均为约 120 Hz headless 而非 60 Hz。B2 的 30 次冷提交/呈现 p95 为 43.5/83.2 ms，1,500 次热移动提交/rAF p95 为 12.6/9.4 ms，各轮完整 CPU p95 3.1–3.2 ms、scene 0.7–0.8 ms、submit 2.1 ms、read 0.3–0.4 ms；0 long task 和 0 个超过 25 ms 间隔，资源账本峰值 57,701,518 bytes，50 次销毁 DOM 为 0、GC 后 heap 增长 0.118%。见 [B2 候选原始数据](./browser-B2-reference-candidate.json)。B3 真实百万记录输入/adapter/索引分别 682.6/0.6/2093.6 ms；30 次冷提交/呈现 p95 为 15.7/33.2 ms，1,500 次热移动提交/rAF p95 11.3/8.8 ms，各轮完整 CPU p95 2.4–2.5 ms、scene 0.6 ms、submit 1.5–1.6 ms、read 0.4 ms；0 long task，1 个超过 25 ms 的间隔，资源账本峰值 19,744,174 bytes，50 次销毁 DOM 为 0、GC 后 heap 下降 0.029%。未经阶段 GC 的 heap 采样在输入前/输入后/索引后分别为 93,066,139/224,445,517/749,587,473 bytes，不能当作精确独占驻留。见 [B3 候选原始数据](./browser-B3-reference-candidate.json)。两份结果均不是冻结构建或原定 60 Hz 环境的正式结论。

实现方独立计数表明 23 px 偏移的候选有 5,033 个实际可见 hit，超过原有 5,000 上限，因此拒绝本身属于容量诊断，不应删掉可见数据来强行通过。另在 4aaf7e 中实际运行 1–20 px，均可提交，但读取次数从 8 增至 103，末帧约 170 ms，仍需解决缓存和性能。23 px 拒绝后返回原点，页面恢复 complete 和 5,000 可见项；返回前后的原点 SVG outerHTML 完全一致，均 5,898 后代，SHA-256 `e9f27a42f8d1719be7f8527bdf3ee114a14d8af20156619dbf88b7d262fac160`。见 [容量和恢复原始数据](./B5-capacity-recovery.json)，其中运行 bundle 与另行读取的 build.json 因服务器更新而不同，文件已明确注明。

同 4aaf7e 的 B3 实际完整数据源重建到呈现测量执行 30 次，p50 3389.1 ms、p95 3524.9 ms、最大 3601.2 ms，见 [端到端候选原始数据](./browser-B3-end-to-end-candidate.json)。该链路含生成、adapter 和索引，耗时明显高于 500 ms；原 500 ms 指标从数据、首屏元数据和 marks 已就绪时开始，因此不能据此直接判定该指标失败。预建供数源后的控制器冷帧也不能替代这条完整链路的披露。独立 headless Chromium 加 `--disable-gpu` 的 240 个空闲 rAF 间隔 p50 8.3 ms、p95 10.1 ms，仍约 120 Hz，没有获得原定 60 Hz 环境。

预算修正后的 SHA `e73e53494bb0a67612c5cf93fc4ef24b44651a8ff355a0ca7020ba72ee065130`，B5 stress 在 0–20 px 内 1,500 帧移动，提交/rAF p95 11.2/10.1 ms；各轮完整 CPU p95 4.7–4.9 ms、scene 3.2–3.4 ms、submit 1.0–1.1 ms、read 0.4 ms；无 long task、无超过 25 ms 间隔，每轮热源读取为 0、eviction 为 0，账本峰值 130,733,796 bytes。30 次冷控制器提交/呈现 p95 为 202.4/236.5 ms。首次 50 次生命周期后 DOM 为 0，但 GC heap 从 98,545,744 增至 109,979,105 bytes，增长 11.602%，超过 10% 门槛；见 [原始结果](./browser-B5-stress-reference-candidate.json)。随即在同页单独重复 50 次，GC heap 从 97,157,833 增至 98,126,379 bytes，增长 0.997%，DOM 为 0。前次 after 到本次 before 下降约 12.8 MB，可能涉及回收时序或一次性暂留，原因未确定；后一次结果不能抹去首次超限，需确定标准回收过程并在冻结构建复测。

同 e73e 标签的独立诊断在每个边界保持一个已挂载控制器，执行两次 rAF、GC、再两次 rAF、GC；每组中间执行 50 次销毁与重建。三组 heap 分别变化 +0.944%、-0.034%、+0.056%，各组销毁后 DOM 为 0，没有观察到线性增长。见 [对称回收探针](./B5-lifecycle-settle-probe.json)。这个探针比较的是已挂载边界，不等同销毁后的标准基线；首次 11.602% 的结果仍保留。

## 冻结候选复验

最终候选 demo bundle SHA-256 `7fc3407c5b5984826fe7424a5a40b46d3cf11190eb79f5cb60be2fee72fb7e24`，benchmark bundle SHA-256 `39006c5067100fccb2225f4f66f0893ef0009e9f368e27189a101ec954116f14`。独立 B1 harness 源见 [semantic-harness.ts](./semantic-harness.ts)，其本地生成 bundle SHA-256 `7bb099032ca6ae62fb98a1290b53adc7501aa75cf77ed9e4ca76fe099a2fed44`。Chromium 实际切换八个 B1 fixture 的 Canvas/SVG；双轴 3、5、10、20 层分别保留对应最大路径深度，均有 2 × 2 叶、2 个非空 pane 和 2 个 hit，后端 command/hit 数一致。Furniture/Chair 与 Office/Paper 的同轴、跨轴 fixture 均只产生两个非空 pane，空交叉无伪记录；长中英文 fixture 完成。实际点击并 Meta 点击两个点，返回 East/Chair 和 West/Paper 的原始值。此独立 harness 不代表 GW 产品接入或 A01–A16 全覆盖。

冻结 demo 在 Chromium 和 Firefox 158.0 各实际切换十个场景及两个后端，均 complete、无 alert，场景 command/hit 数在两后端一致且各有单根。Chrome 的 Paged 先 loading、0 项，释放后 24 hits；Preview 明确 preview、无 alert。实际 PNG 和 SVG 下载分别见 [PNG](./viewport-final.png)、[SVG 页面](./range-page-final.svg)；PNG 解码为 1270 × 558 RGBA，含 488 色。六页 6 × 4 导出按范围保留 East/West 和 2025/2026 父头；导出途中切换到 line 后，所有页面仍为 u1 snapshot 1。第一页后取消，active/queued/consumers 和 export 分区均为 0；程序化 huge 源未访问范围导出读取次数 127→140，得到六页。Safari 26.5.2 原生窗口刷新后，Canvas/SVG regional complete；SVG Paged 从 loading 0 项经实际释放到 complete 20 项，Preview 显示 incomplete input。Firefox 和 Safari 不以 Playwright WebKit 冒充正式 Safari，Safari 此轮仍是上述 smoke 范围。

A14 辅助技术证据来自真实键盘及 Chromium CDP 无障碍树：表格摘要提供可见窗口的行列数和起点；H 焦点到 West 表头时为 expanded=true，Enter 后宿主 accepted，AX 返回 expanded=false；方向键到 East / Boston 时名称含完整路径且无展开属性。H 回数据项时名称含 Region、City、Year、Quarter、Category 和 Value，pressed=false。B2 的 864 个可见项打开 Visible data 后 AX 树暴露 table、100 条数据行及 Previous/Next；实际点 Next 后首条从 B2:0:0:0 变为 B2:0:5:0，Previous 启用；可核对 [第一页 AX 快照](./ax-visible-data-first.yml)和 [下一页 AX 快照](./ax-visible-data-next.yml)。焦点项提供语义路径，数字位置为窗口起点；没有执行 VoiceOver 听读或实际触控板，因此这些不算读屏或触控板实测。

以下四组均在同一冻结 benchmark bundle、Headless Chromium 132、1440 × 900 CSS px、DPR 2、约 120 Hz 环境进行；30 次独立冷控制器、5 × 300 次控制器滚动、50 次对称销毁回收。CPU 为同步计算，提交与读取单列，commit 包含调度；rAF 间隔不是 CPU。运行时账本不含完整输入、供数索引和位图。未把此环境称为 60 Hz。

| Case | 冷提交/呈现 p95 ms | 热 commit/rAF p95 ms | 分轮 CPU/Scene/submit/read p95 ms | long task；超 25 ms / 超实际周期 1.5 倍 | 账本峰值 bytes | GC heap 变化 |
| --- | --- | --- | --- | --- | ---: | ---: |
| [B2](./browser-B2-final-candidate.json) | 42.4 / 83.6 | 12.6 / 9.3 | 3.3–3.5 / 1.0 / 2.1–2.3 / 0.3 | 0；0 / 0 | 48,560,198 | -0.019% |
| [B3](./browser-B3-final-candidate.json) | 18.2 / 33.3 | 12.0 / 9.5 | 2.7 / 0.8–0.9 / 1.6 / 0.3–0.4 | 0；3 / 3 | 17,040,847 | -0.0067% |
| [B5](./browser-B5-final-candidate.json) | 60.6 / 109.5 | 12.5 / 9.3 | 3.5–3.8 / 1.4–1.5 / 1.9–2.0 / 0.3–0.4 | 0；0 / 0 | 48,560,486 | +0.121% |
| [B5 5,000 项](./browser-B5-stress-final-candidate.json)，0–20 px | 194.1 / 225.0 | 13.0 / 16.7 | 7.9–8.5 / 6.0–6.8 / 1.7–1.8 / 0.4 | 0；6 / 275 | 130,735,136 | +0.422% |

每组销毁后 DOM 为 0；heap 基线为保留已销毁控制器的宿主，两端相同执行两帧、GC、两帧、GC。初始 e73e 的不对称回收结果 11.602% 及实质清理缺口和后续探针保留在上文，不能抹去。B5 stress 的 23 px 输入经独立 scene 计数为 5,033 可见 hit，超过既定 5,000 上限，明确拒绝后返回 0 恢复，不能通过截断数据掩盖。上述历史性能数据的 120 Hz 与原定 60 Hz 不同，当时正式环境是否接受尚待决定；现已另按原定 60 Hz 完成复验，见最终报告。S3 产品 roundtrip、屏幕阅读器和触控板不在这一历史测量中。

冻结 bundle 的普通 B2/B5 还各执行 1,500 次 0–120 px 连续像素滚动。B2 commit/rAF p95 为 12.2/8.7 ms，各轮 CPU/scene/submit/read p95 3.3–3.5/1.0–1.1/2.2/0.3 ms，无 long task、无超过实际周期 1.5 倍间隔，账本峰值 49,454,498 bytes，50 次对称回收 heap 增长 3.75%。B5 为 11.4/9.4 ms，各轮 CPU/scene/submit/read p95 1.9–2.0/1.0/0.7/0.3 ms，无 long task、1 个超过实际周期 1.5 倍间隔，账本峰值 49,454,786 bytes，50 次回收 heap 增长 0.337%。原始结果见 [B2 像素滚动](./browser-B2-pixels-final.json)和 [B5 像素滚动](./browser-B5-pixels-final.json)。

冻结 bundle 的 B3 完整数据源重建 30 次，输入 p95 585.2 ms、adapter 0.3 ms、索引 2158.7 ms、已备 records 到呈现 2219.8 ms、输入生成到呈现 2775.2 ms；见 [B3 端到端](./browser-B3-end-to-end-final.json)。索引、已备 records 到呈现与预建源冷控制器帧分别记录。

B2 真实 200,000 记录、864 个初始可见项的独立交互 harness 中，Playwright 对两个点交替各实际点击 50 次。pointerdown 到 selectionChange p95 在 Canvas 为 4.7 ms、SVG 为 1.4 ms；到下一 native rAF 的 p95 为 9.0/8.1 ms，SVG 单次最大 66.2 ms。rAF 回调是下一帧时点，不等同物理呈现完成。见 [交互样本](./B2-interaction-final.json)与 [harness 源](./interaction-harness.ts)；独立 bundle SHA-256 `552e7c970dd2e3138f4ccda259f84cdc376b0035bf8bd35decadc0d9bdeac4f0`。

冻结 39006c 构建再次实际尝试 stress 偏移 (23, 23)，得到明确 resource-limit；返回 (0, 0) 后摘要为 5,000 项 complete，SVG outerHTML 与初始完全一致、5898 后代。当时 AX 与键盘只证明名称和状态可被浏览器辅助技术接口读取，未能证明真实读屏操作；后续真实 VoiceOver 复验见文末。

补充受控表头延迟：2026-11-06 对冻结 4178 示例用 Chromium 实际按键触发，分别 10 次 West 折叠/展开与 10 次同一 West 升序请求。包装真实宿主 `view.update`，从调用到 committed 返回并等待两次 rAF：折叠样本 p95 15.2 ms，排序样本 p95 14.1 ms，均小于 150 ms。另各 12 次由 keydown 到可见 `Waiting for host` DOM 出现，最大分别 0.2 ms、0.8 ms，低于 100 ms。宿主故意等待 550 ms 后才提交，该等待不计入提交到画面时间；DOM mutation 不是物理屏幕光子时间。p95 使用最近秩，10 个样本即最大值。重复同一排序请求并非不同排序键的广泛覆盖。[原始数值和测量方法](./controlled-interaction-timing.json)。

计时复现脚本为 [controlled-interaction-timing.cjs](./controlled-interaction-timing.cjs)。仓库根目录启动同一冻结 4178 服务后运行 `node docs/verification/s2/controlled-interaction-timing.cjs`；`HEADLESS=1` 可运行隔离版，环境与前述 headed 数值不同，不能将其当作原始样本。

A07 指定两元组补测：使用 [a07-tuples-harness.ts](./a07-tuples-harness.ts) 和既有 B1 `exact-selection-tuples` 源，在隔离 headless Chromium 的 400 × 300 Canvas 视口实际点击 East/Chair，程序化滚动到末尾后以 Meta+点击 West/Paper。selectionChange 依次为 replace 1 项、toggle 2 项，最终 datumKeys 恰为 `east-chair`、`west-paper`，原值分别 East/Chair、West/Paper，没有两项之外的交叉组合。滚回首位后保留两项；宿主重建相同 source/snapshot 的数据源，提交行成员顺序 West、East，同时切到 SVG，committed 后 SVG 表头反映新顺序，两个 key 和原值保持，未产生额外 selectionChange。这里是宿主程序化提交排序和后端变化，不是用户通过表头菜单排序，也没有生成查询谓词。临时 browser bundle SHA-256 `e012f60f0c500bf500892aaa6ccb365640b2f15fac13b4ae25e7a490394b170a`。从仓库根目录用 esbuild 将该文件打包到 work，HTML 中设置 400 × 300 `#host` 并加载 bundle 即可复现。

A06 滚动/后端补测：隔离 headless Chromium 在 scope 示例依次选择 shared、prefix、pane，记录 scene 中与 pane 身份绑定的 y 轴 tick 文本，向下移动 70 px 后比较仍共同可见的 tick，三种 scope 各 9 个均相同；在该位置从 Canvas 切 SVG 后各 12 个 tick 均相同。prefix 首窗口 East 的端点为 −128/108、West 为 −1,280/1,080；pane 首窗口还出现 −32/27 和 −320/270，说明未把所有 pane 意外并到同一域。本次比较的是共同可见 pane 的刻度，不足以单独证明每个 pane 的完整输入域；fixed domain、堆叠累计端点和不同单位仍以其他专项证据为准。

同一 scope 数据在宿主直接把 Value 的固定域设为 [−500, 500] 后，Canvas 的刻度为 −500/0/500；滚动 70 px 和通过宿主切 SVG 后共同可见刻度不变，complete。以上固定域是程序化 presentation 更新。scope 生成数据每个 pane 有完整 9 条记录，按生成公式 East/Local 的极值为 −32/27，East/Metro 为 −128/108；pane 模式对应刻度与各自全量极值一致，即使视口只显示部分 pane。这个数值核对基于仓库固定 fixture，不推广为其他数据的证明。

堆叠样例同样在隔离 Chromium 核对。三组 series 按 category 分别提供正值和负值；根据固定 fixture，最大正累计值为 (22 + 27) × 3 = 147，最小负累计值为 −32 × 3 = −96。共享轴刻度显示 −96/26/147，滚动到可用末位置 22 px 后 9 个共同刻度及后续 SVG 后端刻度均一致、complete。该验证覆盖此固定数据的正负累计端点，不覆盖任意堆叠数据。

最终补充结论：[VoiceOver 独立复验](./accessibility-final.md)已通过实际字幕和键盘导航确认库内摘要、位置、展开状态和按需数据行；未录音。B4 的完整程序化源、混合普通/压缩轴、resize、键盘、原生滚动条拖动及受信任小数双轴 wheel 和递减模拟惯性已按报告所述范围通过。物理触控板硬件未实测。其余浏览器功能按上述证据通过；其后已在实际 60 Hz 环境完成性能复验，详见 [60 Hz 最终复验](./performance-60.md)。

A08 实际绘制补证：隔离 Chromium 对冻结 4178 的 bar、line、rect、text、point 五个示例，在 Canvas 后端拦截真实 2D context 的每条 clip、绘制坐标和文字，再切 SVG，读取实际 `data-command` 元素坐标、CTM 和各级 clip 的有效交集。396 条 Canvas 命令均有对应 SVG 元素，2,862 个数值最大差 0 CSS px，文字内容逐条一致；每组命中数量及 ID 相同。长中英文 B1 fixture 额外比较 21 条命令、145 个数值，最大浮点差约 5.7×10⁻¹⁴ CSS px，中文完整文本及英文省略后的文本一致，命中 ID 相同。这里比较浏览器收到的 Canvas 绘制调用和 SVG 几何属性，而非仅比较共同 Scene；未断言字形轮廓或抗锯齿像素相同。原始记录和可执行探针见 [五场景结果](./geometry-result.json)、[五场景脚本](./geometry-acceptance.cjs)、[长文本结果](./geometry-long-result.json)、[长文本脚本](./geometry-long-acceptance.cjs)。长文本页面用现有 [semantic-harness.ts](./semantic-harness.ts) 打包，bundle SHA-256 `7bb099032ca6ae62fb98a1290b53adc7501aa75cf77ed9e4ca76fe099a2fed44`，临时 HTML 提供 `fixture`、`backend` select 和 1440 × 900 `worksheet` 容器。

R07 DPR/resize 补测：隔离 Chromium 使用 CDP 将设备比例 1→2→1，并在每次变化时将视口宽度 1440→1200→1440，实际触发 matchMedia change 和 ResizeObserver。工作表 CSS 尺寸恢复为 1270 × 558，Canvas 位图依次为 1270 × 558、2540 × 1116、1270 × 558；逻辑滚动位置均为 (0,100)，24 个命中 ID 和坐标逐项相同，均 complete。仅改变 CDP deviceScaleFactor 而不改变视口时，该 headless Chromium 虽显示 `devicePixelRatio=2` 和 media query 结果变化，却未派发 matchMedia change，位图未刷新；这个仿真限制不能证明真实系统纯 DPR 切换的行为，也不能据此判产品缺陷。以上正向结果覆盖 DPR 与实际 resize 同时发生的路径。[探针](./dpr-browser-probe.cjs)及[原始结果](./dpr-browser-result.json)。

非首位锚点补测：隔离 Chromium 将受控示例的宿主高度设为 280 px，滚到 y=200，此时首个可见行是 West/Portland，位于该行内偏移 20 px。宿主接受 Portland 所在同级的升序后，Portland 从第二行移到第一行，逻辑 y 自动变为 20，首行仍是 West/Portland。再折叠 West，原叶被隐藏，首行回退到祖先 West、y=0，显示 complete。请求通过公开宿主 API 发出并由示例真实异步提交，不是鼠标表头操作。[探针](./anchor-probe.cjs)与[记录](./anchor-result.json)。

不同单位补测：临时宿主复用 nested IChart 和固定记录，将 Sales 的 prepared column 标为 USD、Profit 标为 percent，适配并显示在同一 SVG 工作表。实际 SVG 轴文本分别为 Sales 0/97.5/195 和 Profit −31/0/31，两个单位没有共享同一数值域，工作表 complete。[宿主源码](./unit-domain-harness.ts)，临时 bundle SHA-256 `b748af858528e92e98b3ddd48dea9ca0d5a15e468e81f27ed545f3bf36fd8220`。单位由宿主 prepared column 指定，非 GW 编辑器单位配置。
