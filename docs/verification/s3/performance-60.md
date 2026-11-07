# S3 独立 60 Hz 最终性能复验

独立验收 gpt-6.1-terra / xhigh。最终 S3 源码 76 文件指纹 `04f08b1acc58d29a9d609e3dcb645b859973a79035fba05eba724289865aa6b6`；核心 benchmark bundle SHA-256 `36fbfc498de9108b2bc11ca706046064364b6e3c65e3348b2e2070e6d163367f`，该 core 未受其后 GW 入口 owner 修复影响。最终 GW 浏览器 bundle `d8a42531535a4b20f38305dac42a7b987ebadbc9b4bbfd7c8df9372976c75812` 的产品行为见 [浏览器验收](./browser-acceptance.md)。已测 S3 浏览器和 Node 性能门禁 PASS。

| 场景 | 冷呈现 p95 | 每轮 CPU p95 | commit / rAF p95 | 50 次销毁后 heap 变化 / DOM |
| --- | ---: | ---: | ---: | ---: |
| B2 Canvas | 85.3 ms | 2.9–3.0 ms | 20.9 / 18.2 ms | +0.09% / 0 |
| B3 Canvas | 35.3 ms | 2.2–2.3 ms | 20.2 / 18.2 ms | +0.01% / 0 |
| B5 SVG | 85.4 ms | 3.9–4.0 ms | 22.2 / 18.5 ms | +0.102% / 0 |
| B5 stress SVG | 163.2 ms | 4.0–4.1 ms | 22.1 / 18.2 ms | +2.849% / 0 |

冷呈现均 <500 ms；Canvas CPU <16 ms、rAF <33 ms，SVG commit <32 ms；heap 增长均 <10%。B3 完整输入重建 p95 2399.9 ms、最大 2420.4 ms；输入生成/adapter/索引各自 p95 376.2/1.8/1952.7 ms，减去输入生成后到呈现 p95 2034.5 ms。完整索引时间低于 3500 ms 预算。各列 p95 分别计算，并非同一次样本相加。

实际 pointer 事件到 tooltip / 下一 rAF 的 p95：Canvas 0.7/1.0 ms，SVG 1.3/1.5 ms；点击到 selectionChange / 下一 rAF：Canvas 3.1/17.2 ms，SVG 2.6/16.1 ms。见 [交互原始数据](./performance-60/interaction-s3.json)。此独立 harness bundle SHA `7b19f56ed1ca7a0613ca48d0264f66ca4dc90333daabaa3ee96b820d9929db07`。

受控折叠/排序：真实 60 Hz rAF p50/p95 16.7/17.5 ms；宿主提交至 committed 加两帧 p95 28.5/28.6 ms，等待态最大 0.3/0.2 ms，分别低于 150/100 ms。使用最终 core 重打包的 demo bundle SHA `753496718a219e516338defa44e469ed0e106516a9da9fe5faa8a2d34fa2791b`，见 [原始记录](./performance-60/controlled-interaction-s3.json)。先前 1280 × 720、DPR 1 的补测保留为[历史记录](./performance-60/controlled-interaction-s3-1280-dpr1.json)，不用于统一参考环境结论。

最终 S3 Node B3 实际完整输入和索引在显式 GC 后 `heapUsed + arrayBuffers` 为 1,038,536,335 bytes，低于 1.25 GiB；最大 RSS 1,396,998,144 bytes，低于 2 GiB。原始记录 [node-B3-final.json](./node-B3-final.json)，复现：`node --expose-gc packages/worksheet-renderer/bench/run-node.mjs --case B3 --profile reference --output work/node-B3.json`。

## 方法及复现

机器 Apple M4 Max、64 GiB、macOS 26.5.2。系统内建显示器实际设置 60 Hertz 并读回；新启动 Headless Chromium 151.0.7922.34 的空闲 rAF 180 间隔 p50 16.7 ms、p95 约 17.6 ms。基准和受控交互补测视口均为 1440 × 900 CSS px、DPR 2；补测前两个新页面分别读回相同视口与 DPR，rAF p50/p95 均 16.7/17.5 ms。各性能组串行，30 次冷呈现、5 × 300 次控制器滚动、50 次挂载销毁；stress 为 5,000 可见项的 0–20 px 像素轨迹。完整 B3 另执行 30 次输入生成、adapter、索引、首帧端到端重建。冷呈现从预备数据就绪后开始，完整重建单列。rAF 为浏览器回调，非光子呈现测量；滚动轨迹是程序化控制器输入，wheel 输入合同见 B4 补充。

在各自冻结源码根目录启动 `BENCH_PORT=端口 node packages/worksheet-renderer/bench/serve.mjs`，顺序运行下列命令（`BENCH_URL` 和 `OUT_DIR` 指向对应端口及新目录）；不要覆盖本报告原始记录：

```sh
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s3/performance-runner.cjs B2 reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s3/performance-runner.cjs B3 reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s3/performance-runner.cjs B5 reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s3/performance-runner.cjs B5-stress reference
BENCH_URL=http://127.0.0.1:端口/ OUT_DIR=work/new-results node docs/verification/s3/performance-runner.cjs B3 end-to-end
```

交互探针源码为 `interaction-60-harness.ts` 和 `interaction-60-runner.cjs`。将本目录 `interaction-s3.html` 复制到 `work`，以 esbuild 从对应阶段源码打包 harness 至 `work/interaction-s3.js`，将该目录通过端口 4191 提供，再设 `OUT_DIR=work/new-results` 运行 `node docs/verification/s3/interaction-60-runner.cjs s3`。每后端前 50 次是实际浏览器 pointermove 引起 tooltip 更新，随后 50 次实际点击引起 selectionChange；原始 hover 还包含点击过程中产生的移动，表中仅取前 50 次。记录事件到 DOM 更新或回调以及其后一次 rAF，并非物理设备延迟。

受控交互使用本目录 `controlled-interaction-timing.cjs`：启动对应源码 demo 后以 `HEADLESS=1 DEMO_URL=http://127.0.0.1:端口/ node docs/verification/s3/controlled-interaction-timing.cjs` 运行。每种操作 12 次，提交耗时丢弃各自前两次预热后取 10 次 p95；等待态记录全部 12 次。550 ms 为 fixture 模拟宿主延迟，不计入宿主 `view.update` 到 committed 加两帧的测量。等待态从真实 keydown 到可见状态 DOM；运行前记录新页面 rAF。60 Hz 源数据保存在 `performance-60/`，与原 120 Hz 数据分开。
