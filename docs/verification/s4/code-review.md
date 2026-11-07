# S4 independent code review

结论：代码审查 PASS，仅对应下列静止候选。审查范围内没有尚未解决的新增 P0/P1/P2 代码问题。本报告不替代浏览器验收、最终构建、外部包消费或性能测量，也不宣告 S4 整体完成。

审查日期：2026-11-07。独立审核模型为 `gpt-6.1-sol`，reasoning effort 为 `xhigh`。审查者只读生产代码，修复由实现方完成。本轮只写此报告和未纳入提交的 `work/s4-review/` 定向探针，未修改生产代码、未提交。

## 候选与范围

- 工作树：`/Users/observedobserver/.codex/worktrees/native-worksheet-renderer/graphic-walker`。
- 比较基线：阶段 S3 完成后的 HEAD `799b87377a7599bef68fd8c91504bb78ef528285`。
- 清单：[source-manifest.json](./source-manifest.json)，51 个产品、测试、demo 与 README 增量文件。
- 清单文件 SHA-256：`73ebd4e6db155a6625c3021fea1c1276e344c1483220f2e925edde72721f9638`。
- 独立重算产品 fingerprint：`0e4eae5a7caafa11c21a857c37aff4bb23a62db7bd8938a77fea4a1a006f520c`。

逐一读取 51 个文件并重算 SHA-256，全部与清单一致。`packages/` 下全部已跟踪与未跟踪增量均在清单内，没有漏列的产品改动。fingerprint 按 path 字典序排列条目，将 `${path} ${sha256}` 以换行连接且无末尾换行，再计算 UTF-8 字节的 SHA-256。

同时审阅了未提交的设计、实现、集成、VL import 文档增量，以及 [worksheet-renderer-chart-types.md](../../worksheet-renderer-chart-types.md)。这些文档和验收记录不在产品 fingerprint 中；后续纯验收状态更新不改变此代码结论。

本轮覆盖 circle、tick、area、trail、arc、boxplot，bar/area 的 zero、normalize、center，rect 面积、text 字号，以及共同的 Canvas/SVG Scene、SVG 导出、窗口读取、缓存、命中、选择和 GW 集成。新增箱图统计位于 GW 计算结果阶段；独立渲染库仅验证和消费准备好的角色行。

## 问题与修复复核

| 编号 | 首轮问题与可复现影响 | 当前代码复核 |
| --- | --- | --- |
| R1，P2 | 单度量箱图中，lower/q1/median/q3/upper 全为 null 且没有 empty 角色时，库仍接受 complete pane，错误数据变成无诊断空白 | [core/boxplot.ts](../../../packages/worksheet-renderer/src/core/boxplot.ts) 仅在其他计划数值槽有有限值时允许当前槽为 null。所有数值槽为 null 的 statistic/outlier 明确拒绝；empty 要求所有数值槽均为 null。原 probe 现在抛出 `A boxplot statistic or outlier must belong to a finite measure slot.`，多槽投影与合法 empty 回归同时通过 |
| R2，P2 | arc 的实际 size 默认按 `[0, π·outerLimit²]` 映射面积，图例却使用通用 `[16,256]`，size=0 的无图形记录仍显示正半径图例 | [scene/arc.ts](../../../packages/worksheet-renderer/src/scene/arc.ts) 的 `createArcRadiusScale` 同供实际图形和 [scene/build.ts](../../../packages/worksheet-renderer/src/scene/build.ts) 图例使用。图例按 `9 / outerLimit` 等比缩小，domain、zero、reverse、显式 range 与半径 cap 共用。原 size=0/100 probe 的图例半径已是 0/9，中点为 6.363961；实际最大半径为 78，比例相符 |
| R3，P2 | 箱图将同一 measure 同时用于统计位置和 color/details 时，original alias 的 rawColumnKey 仍指向已被统计角色覆盖的 measure。视觉值为 8，公开选择值的 raw 却为 null | [native/results.ts](../../../packages/graphic-walker/src/lib/native/results.ts) 让未变换的 original alias 自身作为 raw 列。原复现现在 visualValue=8、selectionRaw=8；新增回归直接调用公共 `selectionTarget`，逐条验证 value/raw 都为 8 |
| R4，P2，由独立浏览器验收发现 | donut 内孔距内边沿不足 3 CSS px 的点仍被 pointer 容差选中，违反孔洞排除合同 | [scene/hit.ts](../../../packages/worksheet-renderer/src/scene/hit.ts) 在弧、径向与角边容差前先拒绝 `distance < innerRadius`，内边界仍可选。最终新增 innerRadius 减 0.01/1/3 px 的默认 `hitTest` 拒绝断言，保留内边界与外沿 2 px 容差断言，arc 15/15 tests PASS |

另复核了实现方在本轮主动发现的两项问题。固定 domain 的临时 wrapper 不再让滚动和选择重复构建几何，缓存依据 `begin` 的完整 plan/version/layout signature 与 fieldRef，改计划仍会失效。arc 行列分面仅在 `renderer='native'` 时进入 query grain，旧 Vega/Plot 和省略 renderer 的调用保持原有字段集合。store、workflow 与 chat 已传递各自现有 renderer；没有广泛改变其他 mark 的查询 grain。

## 独立验证

在清单 SHA-256 为 `6a548ec…08fd5` 的静止候选上，重新 bundle 真实源码后运行以下七个定向 Node test 文件，76/76 PASS，0 fail，0 skip。最终候选仅再修改 `scene/hit.ts` 与 `arc-marks.test.ts`，补充排除近边沿孔洞点；已独立重读此两文件并重新 bundle 运行 arc 15/15 tests，通过后逐文件重算上列最终清单 hash。

- `arc-marks.test.ts`
- `boxplot-marks.test.ts`
- `boxplot-computation.test.ts`
- `extended-contracts.test.ts`
- `extended-marks.test.ts`
- `native-extended-marks.test.ts`
- `scene-cache.test.ts`

运行目录为仓库根目录。可按以下命令复现，`@kanaries/worksheet-renderer` 显式指向当前源文件，避免误测旧 dist：

```sh
mkdir -p work/s4-review
node --input-type=module <<'JS'
import {build} from 'esbuild';
import {resolve} from 'node:path';
for (const name of ['arc-marks','boxplot-marks','boxplot-computation',
  'extended-contracts','extended-marks','native-extended-marks','scene-cache']) {
  await build({
    entryPoints: [`packages/worksheet-renderer/tests/${name}.test.ts`],
    outfile: `work/s4-review/${name}.test.mjs`,
    bundle: true, format: 'esm', platform: 'node', target: 'node20',
    tsconfig: 'packages/graphic-walker/tsconfig.json',
    alias: {'@kanaries/worksheet-renderer': resolve('packages/worksheet-renderer/src/index.ts')}
  });
}
JS
node --test work/s4-review/arc-marks.test.mjs \
  work/s4-review/boxplot-marks.test.mjs \
  work/s4-review/boxplot-computation.test.mjs \
  work/s4-review/extended-contracts.test.mjs \
  work/s4-review/extended-marks.test.mjs \
  work/s4-review/native-extended-marks.test.mjs \
  work/s4-review/scene-cache.test.mjs
```

这组检查覆盖环形扇区真实命中与孔洞排除、完整域和半径范围、Canvas/SVG 参数、boxplot 角色完整性、多槽位、稳定 summary/outlier 身份、raw provider 样本与过滤、统计列碰撞、all-null empty、面积与变宽轨迹断段/裁剪、堆积端点、作用域域、复合目标高亮及缓存失效。三项首轮独立探针也在最终源码重跑，修复结果与上表一致。

## 计算和兼容边界

GW hook 对 native boxplot 请求完整过滤后的 raw 结果，不带展示 limit；公共结果阶段计算 Type 7 分位数、实际观测须端点和离群观测，未新增 provider 查询操作或持久化 DSL。已有请求所有权与版本检查仍包住该阶段。适配层只生成角色行和身份，worksheet 包没有分位数或原始观测统计执行器。

小样本须端点可以落在箱体内。例如 `[1,2,3,100]` 的 Q3 为 27.25、upper whisker 为 3。当前校验没有误加五值整体单调限制。全 null 组用一条 empty 角色保留成员，其他度量槽的 null 仅是投影。外部 `IComputationFunction` 只返回数组，无法从现有协议识别 provider 未声明的截断；文档已明确要求 provider 返回完整请求结果。

normalize/center 的绝对值厚度、每个完整 pane 的布局端点、零组和溢出规则由 core 与 scene 共用。raw 数值与符号没有被显示端点覆盖。序列排序使用带域的 rank Map，新增路径段和环形命中不扫描整个逻辑网格；箱图计算按组排序样本，渲染和命中消费准备好的角色与离群行。审查中未发现新增明显的二次方全数据循环。

本轮未独立重跑完整 build、全量 GW 测试、浏览器或性能矩阵。实现方报告的 core 298 tests、GW 473 tests/4 snapshots 和 production build 不能改写为本审查者执行结果。最终跨浏览器、外部 tarball consumer 与阶段完成结论应引用各自验收记录；旧 S0–S3 性能数据不代表新增 mark 的测量结果。
