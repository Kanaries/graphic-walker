# S2 独立 60 Hz 最终性能复验

独立验收 gpt-6.1-terra / xhigh，S2 冻结源码 81 文件指纹 `36de7207`，benchmark bundle SHA-256 `39006c5067100fccb2225f4f66f0893ef0009e9f368e27189a101ec954116f14`。已测浏览器性能门禁 PASS；VoiceOver、B4 软件 wheel、功能覆盖和限制见 [浏览器验收](./browser-acceptance.md)。此前约 120 Hz 的结果和失败保留在那里。

| 场景 | 冷呈现 p95 | 每轮 CPU p95 | commit / rAF p95 | 50 次销毁后 heap 变化 / DOM |
| --- | ---: | ---: | ---: | ---: |
| B2 Canvas | 84.3 ms | 2.8–2.9 ms | 19.9 / 17.3 ms | +0.089% / 0 |
| B3 Canvas | 34.4 ms | 2.1–2.2 ms | 19.4 / 17.5 ms | +0.0103% / 0 |
| B5 SVG | 84.3 ms | 3.3–3.5 ms | 20.8 / 17.6 ms | +0.1008% / 0 |
| B5 stress SVG | 166.2 ms | 3.9–4.0 ms | 22.0 / 18.1 ms | +2.8557% / 0 |

冷呈现均 <500 ms；Canvas CPU <16 ms、rAF <33 ms，SVG commit <32 ms；heap 增长均 <10%。B3 完整输入重建 p95 2401.4 ms、最大 2448 ms；输入生成/adapter/索引各自 p95 为 385.7/2.0/1956.6 ms，减去输入生成后到呈现 p95 2025.4 ms。完整索引时间低于 3500 ms 预算。各列 p95 分别计算，并非同一次样本相加。

实际 pointer 事件到 tooltip / 下一 rAF 的 p95：Canvas 0.5/16.8 ms，SVG 1.3/16.0 ms；点击到 selectionChange / 下一 rAF：Canvas 3.3/16.8 ms，SVG 2.3/16.1 ms。见 [交互原始数据](./performance-60/interaction-s2.json)。本补充使用 bundle SHA `4ab2b9964829ea14b9dcc1a169016cabbada428ca5a381ed8f404aef3510e371`。

受控折叠/排序：实际 60 Hz rAF p50/p95 16.7/17.6 ms；宿主提交至 committed 加两帧 p95 28.0/28.2 ms，等待态最大 0.3/0.3 ms，分别低于 150/100 ms。见 [原始记录](./performance-60/controlled-interaction-s2.json)。

## 方法及复现

机器 Apple M4 Max、64 GiB、macOS 26.5.2。系统内建显示器实际设置 60 Hertz 并读回；新启动 Headless Chromium 151.0.7922.34 的空闲 rAF 180 间隔 p50 16.7 ms、p95 约 17.6 ms。基准视口 1440 × 900 CSS px、DPR 2；受控交互补测为 1280 × 720、DPR 1。各性能组串行，30 次冷呈现、5 × 300 次控制器滚动、50 次挂载销毁；stress 为 5,000 可见项的 0–20 px 像素轨迹。完整 B3 另执行 30 次输入生成、adapter、索引、首帧端到端重建。冷呈现从预备数据就绪后开始，完整重建单列。rAF 为浏览器回调，非光子呈现测量；滚动轨迹是程序化控制器输入，wheel 输入合同见 B4 补充。

在各自冻结源码根目录启动 `BENCH_PORT=端口 node packages/worksheet-renderer/bench/serve.mjs`，顺序运行下列命令（`BENCH_URL` 和 `OUT_DIR` 指向对应端口及新目录）；不要覆盖本报告原始记录：

```sh
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s2/performance-runner.cjs B2 reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s2/performance-runner.cjs B3 reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s2/performance-runner.cjs B5 reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s2/performance-runner.cjs B5-stress reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s2/performance-runner.cjs B3 end-to-end
```

交互探针源码为 `interaction-60-harness.ts` 和 `interaction-60-runner.cjs`。将本目录 `interaction-s2.html` 复制到 `work`，以 esbuild 从对应阶段源码打包 harness 至 `work/interaction-s2.js`，将该目录通过端口 4191 提供，再设 `OUT_DIR=work/new-results` 运行 `node docs/verification/s2/interaction-60-runner.cjs s2`。每后端前 50 次是实际浏览器 pointermove 引起 tooltip 更新，随后 50 次实际点击引起 selectionChange；原始 hover 还包含点击过程中产生的移动，表中仅取前 50 次。记录事件到 DOM 更新或回调以及其后一次 rAF，并非物理设备延迟。

受控交互使用本目录 `controlled-interaction-timing.cjs`：启动对应源码 demo 后以 `HEADLESS=1 DEMO_URL=http://127.0.0.1:端口/ node docs/verification/s2/controlled-interaction-timing.cjs` 运行。每种操作 12 次，提交耗时丢弃各自前两次预热后取 10 次 p95；等待态记录全部 12 次。550 ms 为 fixture 模拟宿主延迟，不计入宿主 `view.update` 到 committed 加两帧的测量。等待态从真实 keydown 到可见状态 DOM；运行前记录新页面 rAF。60 Hz 源数据保存在 `performance-60/`，与原 120 Hz 数据分开。
