# S2 benchmark fixtures and initial measurements

Date: 2026-11-06. These fixture checks and Node baselines come from the S2 work in progress. They are not an S2 acceptance pass. Browser painting, input, cache, export and lifecycle acceptance remain separate measurements.

## Fixtures

Seed: `0x5eed2026`. All fixtures use existing IChart inputs and explicitly prepared results. Adapter mapping has its own timing stage. Large arrays are generated only when a caller prepares a case; the browser HTML contains no records.

| Case | Actual input and structure | Scope |
| --- | --- | --- |
| B1 | Both axes at 3/5/10/20 levels; sparse Furniture/Chair and Office/Paper on one axis and separate axes; long Chinese/English labels; exact East/Chair and West/Paper tuples | Eight additional IChart fixtures, checked through source and Scene |
| B2 | 200,000 records; 100 × 100 leaves; 10,000 nonempty panes; 20 points per pane | Six uneven facet levels on each axis; Node windows contain at most 80 panes and 1,600 records |
| B3 | 1,000,000 actual records; 100,000 × 1,000 leaves; 100,000,000 logical slots; 1,000,000 nonempty panes | Six uneven levels per axis; ten occupied columns per row; one record per occupied pane; real occupied windows |
| B4 | Programmatic random access to 1,000,000,000 rows × 1,000,000 columns | No complete record array/index; generated records at requested positions, including the far edge; separate from B3 |
| B5 | Same dimensions, point values and grain as B2 | SVG browser case. Optional stress input has 203,000 records, with 50 in each of the first 100 panes, for 5,000 visible marks |

Unequal boundaries split child groups at parent boundaries. No field or depth is removed for performance. Six fixture tests pass, including the full B3 record count, ten records per row, 1,000 records per column, final datum identity and 5,000-mark Scene.

The new B1 tests cover A01/A03/A04/A07/A08/A10 where applicable. Existing adapter, domain, Scene, controlled-request, backend, window-contract and runtime tests remain the other B1 evidence. These eight fixtures do not independently certify all A01–A16 product workflows.

## Execution and API

Run from `packages/worksheet-renderer`:

```sh
node --expose-gc --max-old-space-size=6144 bench/run-node.mjs --case B3 --profile reference --output ../../docs/verification/s2/node-B3-new.json
node ../../node_modules/typescript/bin/tsc -p bench/tsconfig.json
node bench/serve.mjs
```

The browser harness serves at `http://127.0.0.1:4182`; `BENCH_PORT` overrides the port. Generated bundles/build metadata are ignored by Git.

- `createBenchmarkFixture('B2' | 'B3' | 'B5', options)` returns chart, column metadata, actual records, datum-key callback, expected counts, layout and deterministic windows.
- `adaptBenchmarkFixture(fixture)` maps the IChart separately.
- `prepareBenchmark(case, options)` separates input generation, adapter, source-index and manifest timings.
- `createB4Plan()` / `createB4Source(plan)` provide the independent long-coordinate source.
- `renderWindow(prepared, window)` reads, validates and constructs the Scene. It does not paint or use the controller cache.

Browser API examples:

```js
await worksheetBenchmark.prepare('B3', { backend: 'canvas' });
const report = await worksheetBenchmark.run({ profile: 'reference', lifecycle: true });
worksheetBenchmark.state();
await worksheetBenchmark.jumpToSample(19);
worksheetBenchmark.download();

await worksheetBenchmark.prepare('B5', { backend: 'svg', svgStress: true });
const svgReport = await worksheetBenchmark.run({ profile: 'reference' });

// Full record/source reconstruction for every sample, measured separately.
const endToEnd = await worksheetBenchmark.runEndToEnd('B3', { samples: 30, backend: 'canvas' });
```

`run` measures 30 independent controller mounts after source preparation, then five rounds of 300 committed scroll frames. Its four-position hot trace fits the bounded cache. `runEndToEnd` releases the old controller/source and rebuilds records and indexing for each sample. Keep both measurements in final reporting. Browser GC runs between full rebuilds when explicitly exposed.

The real worksheet accepts wheel, keyboard and pointer input. Automated scrolling uses the public controller API and browser painting; native-input acceptance is a separate interactive check. Harness state reads use scalar frame IDs and do not clone or retain Scene getters.

Runtime `cpuMs`, `sceneMs`, `submitMs` and `readMs` distributions are separate from commit wall time. `readMs` includes read/scheduler elapsed time and is not pure network waiting. Commit time includes animation-frame scheduling and is not the 16 ms CPU metric. Source tracing separates synchronous call time from promise-await time; asynchronous provider work can occur during the latter.

## Node baseline

Each reference case uses 30 fresh read/Scene samples and five rounds of 300 actual reads. Indexing occurs once and is reported separately. Node does not paint Canvas/SVG, use the controller cache, measure compositor frames, or exercise native input. Its cold samples are not browser cold-frame results.

Machine: Apple M4 Max, 64 GiB RAM, Node v24.11.1. Raw JSON records OS release, architecture, V8, CPU count, Git revision/dirty state, exact bundle SHA-256, seed, viewport, fonts, process arguments and timestamps. These were shared development-session measurements, not an isolated performance lab.

| Case | Input ms | Adapter ms | Index ms | Cold p95 ms | 1,500-read p95 ms | Peak process RSS MiB | Final GC heap MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B2 | 92.82 | 1.05 | 2,187.83 | 18.05 | 15.84 | 905.2 | 137.2 |
| B3 | 573.69 | 1.14 | 13,078.89 | 3.76 | 3.05 | 2,696.6 | 1,084.2 |
| B4 | 0.10 | 1.19 | 0.27 | 4.09 | 2.44 | 219.4 | 6.4 |
| B5 | 113.15 | 1.10 | 2,287.58 | 17.24 | 16.02 | 912.5 | 137.2 |

Raw records: [B2](node-B2-reference.json), [B3](node-B3-reference.json), [B4](node-B4-reference.json), [B5](node-B5-reference.json). Files include per-round and merged p50/p95/max, every sample, loaded pane/record counts, visible marks, commands and separate read/validation/Scene CPU and wall durations. Process CPU includes worker/GC CPU and can exceed wall time.

B3 loads 80 records in 80 panes per sample and displays about 43 marks. Its maximum pipeline wall duration was 137.02 ms despite a 3.05 ms p95. This sparse case does not stand in for a dense 20,000-mark frame. B2/B5 load 1,600 records per Node window; a separate B5 capacity test supplies and draws 5,000 marks.

Memory includes original complete input, the source's immutable copy and its index. B3 phase snapshots were 367.5 MiB heap after generation and 2,421.2 MiB after indexing before forced GC. The final 1,084.2 MiB heap still includes input and source. The retained scroll delta was about 0.9 MiB. These are not the isolated 128 MiB runtime-cache metric, and the delta is not a lifecycle acceptance result.

## B3 profile and optimization handoff

The read-only CPU profile sampled 13.34 seconds of the million-record, six-plus-six-level fixture. [Profile summary](profile-B3-summary.json) and [profile-run measurements](node-B3-profile.json) are separate from the reference result.

| Function | Measurement | Sampled time |
| --- | --- | ---: |
| `createAxisIndex` | Inclusive | 7.849 s, 58.85% |
| `typedValueKey` | Self | 3.890 s, 29.17% |
| `pathKey` | Self | 1.166 s, 8.74% |
| `validatePath` | Inclusive | 1.382 s, 10.37% |
| Garbage collector | Self | 1.338 s, 10.03% |
| `buildDomain` | Inclusive | 1.264 s, 9.48% |

Self and inclusive values overlap. Do not add them together. Code inspection suggests:

1. Avoid a complete temporary six-member path per record per axis and the additional visible-member wrapper array. B3 repeats row paths ten times and column paths 1,000 times. Intern paths or insert into the member index directly.
2. Retain full validation for external explicit paths, while avoiding repeated JSON serialization of implicit paths derived from checked records.
3. `buildDomain` currently scans every record for all 14 bindings, including twelve facet-only fields. Follow actual display-domain needs and preserve explicit handling of other domain requests.
4. Check shared scope before constructing per-record scoped domain keys.
5. Reuse the empty series identity and compact ordinals instead of representing the same tuple separately for every record.

The data-core agent owns production optimizations. Typed identities, complete domains, ordering, explicit paths and immutable snapshots must remain intact. Preserve these baseline files and write optimized measurements to new files.

## Browser environment limits

macOS reports the main screen as **1728 × 1117 @ 120.00 Hz**, with 3456 × 2234 Retina pixels. No display setting was changed. A 60 Hz physical screen configuration has not been verified.

The harness fixes a 1440 × 900 CSS-pixel drawing viewport and effective DPR 2. It records actual device pixel ratio, requested fonts/font checks, rAF intervals, available long-task observations, SVG node counts, Canvas bitmap dimensions and lifecycle DOM counts. A headless Chromium run must identify its own measured compositor cadence. If a controlled 60 Hz input schedule is used, keep native rAF measurements separate and do not relax the original latency thresholds.

No browser performance budget, three-browser result, isolated runtime-memory budget or 50-mount retained-heap threshold is marked passed here.

## Pixel scrolling and capacity

The browser runner now supports `run({profile: 'reference', trajectory: 'pixels', maxPixelOffset: 20, lifecycle: true})`. It performs actual one-pixel diagonal movement in both directions, with 30 cold samples, five rounds of 300 committed frames and 50 mount/dispose cycles. Ordinary B2/B5 pixel runs use a 120 px span to cross pane boundaries. Cell-offset and pixel trajectories are reported separately. The runner samples idle native rAF cadence and reports both intervals above the original 25 ms reference and intervals above 1.5 times the measured cadence. It does not replace native rAF with a test clock.

The original 203,000-record stress fixture remains unchanged. At offset 0–20 px it has 5,000 visible hits. At 23 px it has 5,033 visible hits and about 6,491 SVG elements because marks at both clipped edges intersect the viewport. The latter deliberately tests the 5,000-hit diagnostic and recovery; it cannot count as a valid frame within that capacity. No mark is dropped to keep the result below the limit.

A nominal 10×10 grid can intersect 11×11 panes after one-pixel scrolling. Required reads include these partial boundary panes, while the visible hit and SVG-element budgets remain unchanged. Source read counts, geometry-cache evictions and total accounted bytes accompany every hot trajectory.

## 冻结候选浏览器测量

最终候选 browser bundle SHA-256 `39006c5067100fccb2225f4f66f0893ef0009e9f368e27189a101ec954116f14`。Apple M4 Max、64 GiB、macOS 26.5.2、Headless Chromium 132、1440 × 900 CSS px、DPR 2，空闲 rAF 约 120 Hz；这不是原定 60 Hz，环境替换仍待用户确认。种子 1592598566，字体 Arial / Noto Sans CJK SC / sans-serif。30 个冷控制器样本、5 × 300 次移动、50 次对称销毁与回收。详细口径、初始失败和修复历史见 [独立浏览器验收](./browser-acceptance.md)，原始 JSON 随表链接。

| Case | 冷提交 / 呈现 p95 ms | 滚动提交 / rAF p95 ms | 分轮 CPU / submit p95 ms | long task；超过 25 ms / 超过实际周期 1.5 倍 | 账本峰值 bytes | 50 次 GC heap 增长 |
| --- | --- | --- | --- | --- | ---: | ---: |
| [B2](./browser-B2-final-candidate.json) | 42.4 / 83.6 | 12.6 / 9.3 | 3.3–3.5 / 2.1–2.3 | 0；0 / 0 | 48,560,198 | -0.019% |
| [B3](./browser-B3-final-candidate.json) | 18.2 / 33.3 | 12.0 / 9.5 | 2.7 / 1.6 | 0；3 / 3 | 17,040,847 | -0.0067% |
| [B5 SVG](./browser-B5-final-candidate.json) | 60.6 / 109.5 | 12.5 / 9.3 | 3.5–3.8 / 1.9–2.0 | 0；0 / 0 | 48,560,486 | +0.121% |
| [B5 5,000 项，0–20 px](./browser-B5-stress-final-candidate.json) | 194.1 / 225.0 | 13.0 / 16.7 | 7.9–8.5 / 1.7–1.8 | 0；6 / 275 | 130,735,136 | +0.422% |

普通 0–120 px 连续滚动的 1,500 次样本，B2 commit/rAF p95 12.2/8.7 ms、B5 11.4/9.4 ms，分别见 [B2](./browser-B2-pixels-final.json)、[B5](./browser-B5-pixels-final.json)。冻结 B3 的 30 次完整重建，输入 p95 585.2 ms、adapter 0.3 ms、索引 2158.7 ms、已备 records 到呈现 2219.8 ms、输入生成到呈现 2775.2 ms，见 [原始样本](./browser-B3-end-to-end-final.json)。完整输入、索引和位图不算入运行时账本；heap 的详细阶段采样见验收报告。B2 真实 200,000 记录的各 50 次实际点击，pointerdown 到 selectionChange p95 为 Canvas 4.7 ms、SVG 1.4 ms，下一 native rAF 时点 p95 为 9.0/8.1 ms，见 [交互样本](./B2-interaction-final.json)。rAF 时点不等于物理呈现完成。

## Final Node B3 memory and indexing

The final [Node B3 report](./node-B3-final.json) uses the same one-million-record, six-level-per-axis fixture. Input generation took 665.93 ms, adapter 1.13 ms and index construction 2284.82 ms. This is one index construction, not an index p95. Browser repeated-index p95 is reported separately above.

Process high-water RSS was 1,403,322,368 bytes, including input, index, runtime and process baseline. After-scroll explicit-GC heapUsed was 1,005,381,216 bytes and arrayBuffers 32,810,495 bytes, totaling 1,038,191,711 bytes. Both remain below the specified 2 GiB RSS and 1.25 GiB heap-plus-array-buffer limits. The raw report also preserves RSS, external and baseline phases; external is not added again because it includes array buffers. These process totals are separate from the 128 MiB runtime resource ledger.
