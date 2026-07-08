# Explain Data 重构 · 分工与进度跟踪

> 性质：临时工作文档（重构完成后归档或删除）
> 方案依据：[explain-data-redesign.md](./explain-data-redesign.md)（本文件不重复方案细节，只管分工与进度）
> 创建：2026-07-07

## 1. 协作模型

两个角色：

| 角色 | 承担者 | 职责 |
|------|--------|------|
| **Kernel**（内核/架构） | Fable（主 agent） | 数学与统计内核、打分公式、架构接口、engine 编排语义、评审执行方产出 |
| **Executor**（工程执行） | 执行 agent（handoff） | 解释器接线、UI 重写、i18n、测试 fixture、死代码清理、构建与回归验证 |

**分工原则（判断任何新任务归属时用这条）**：

> 错误会**静默污染结果**的代码 → Kernel。错误会**被测试或肉眼立刻发现**的代码 → Executor。

具体地：一个写错的 JS 散度会产出"看起来合理但排序全错"的解释列表，没人能靠观察发现，所以它必须由 Kernel 写并配单测锁死；一个写错的卡片组件会直接渲染坏掉，验收标准就能兜住，交给 Executor。

**冻结边界（Executor 必须遵守）**：

- `lib/explain/stats/**` 与各 explainer 的 `analyze()` 打分逻辑为 **frozen**：Executor 只可调用，不可修改。发现问题 → 记录到 §5 进度日志并升级给 Kernel，不要自行"顺手修"。
- `lib/explain/types.ts` 的接口签名为 frozen：需要加字段时先在日志中提出。
- 所有取数必须走 `plan(): IDataQueryPayload[]`（workflow DSL）。任何直接访问原始数据源的代码都是违规，评审时一票否决。

**升级触发条件**（Executor 遇到以下情况停下并记日志，等 Kernel 决策）：

1. stats 单测失败，或金标准测试（E6）找不到植入的信号 / 产生误报；
2. 规格有歧义、或实现中发现方案文档没覆盖的分支；
3. 需要修改任何 frozen 文件才能继续；
4. 双端计算（客户端 vs DuckDB-WASM）结果不一致。

**评审节奏**：Executor 每完成一个 E 任务，在 §5 追加一行日志（任务号、改动文件、验证方式、遗留问题）；每个里程碑收口时 Kernel 过一遍 diff 再进入下一阶段。

## 2. 任务清单

任务编号：`K-*` = Kernel，`E-*` = Executor。状态：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 完成 / `[!]` 阻塞。

### 阶段一 · M0 止损（可独立发布）

| # | 任务 | 状态 | 说明 / 验收标准 |
|---|------|------|----------------|
| K-1 | 修复散度打分：完整 JS 距离（零概率按定义计入）+ Laplace 平滑 + 删除覆盖率权重，先以独立纯函数落在 `lib/explain/stats/divergence.ts`（M0 阶段由旧代码引用） | [x] | 单测覆盖：零值边界、单类别集中分布得高分、对称性、有界 [0,1] |
| K-2 | siblings 基线：从「视图维度+候选维度」查询结果减出其余标记分布（sum/count 派生），替换现在的 child-vs-parent 比较 | [x] | 单测：大占比标记不再被自我稀释 |
| E-1 | ~~查询合批与并行~~（并入 M1：新 engine 天然按维度合批 + 并发上限 4 + 哈希去重，旧路径未单独修补即整体下线） | [x] | 由 engine.test.ts 并发/去重用例覆盖 |
| E-2 | ~~M0 UI 修正~~（并入 M1 全量 UI 重写 E-3，旧图表未单独修补） | [x] | — |

### 阶段二 · M1 引擎骨架 + 极端值

| # | 任务 | 状态 | 说明 / 验收标准 |
|---|------|------|----------------|
| K-3 | `lib/explain/types.ts` + `engine.ts`：IExplainer/IExplanation/ExplainContext 定稿；查询哈希去重、并发执行、AsyncGenerator 流式交付 | [x] | engine 单测：同构 workflow 只执行一次；B/D 共享查询自动成立 |
| K-4 | `stats/quantile.ts`（q1/q3/IQR）+ A 类解释器 `explainers/extremeValue.ts` 完整实现（预筛条件、impact 打分、降级路径） | [x] | 金标准：植入单条极端记录的合成数据集被以 strong 检出 |
| K-5 | D 类解释器 `explainers/uniqueMark.ts`：基于 K-1/K-2 内核 + G 检验门槛，迁入 engine | [x] | 旧路径直接下线（E-4）；新增 ROW_DOMINANCE_RATIO 护栏防极端记录质量泄漏进 sum 份额 |
| E-3 | UI 重写：按类分组的解释卡片（A → B/C → D 固定顺序）、三档强度标签、渐进加载（AsyncGenerator 消费）、证据图渲染 | [x] | 裸分数不展示；vega spec 由 explainer 的 `evidence.chartSpec` 提供，UI 不自行拼 spec |
| E-4 | 删除死代码：`lib/insights/explainValue.ts`、`explainByChildren.ts`、`utils/normalization.ts` 中不再被引用的 `compareDistribution*` / `normalizeWithParent` 等；`lib/insights/` 目录清空后移除 | [x] | 全仓 grep 无残留引用，tsc + 现有测试通过 |
| E-5 | i18n：所有解释文案走 `descriptionKey` + 参数，补齐 en-US / zh-CN / ja-JP 三份 locale；文案遵循关联性措辞规范（"有助于预测/与…相关"，禁用因果词） | [x] | 硬编码英文标题全部清除；评审修正：删除重复的旧顶层 explain 块 |
| E-6 | 金标准测试基建：合成数据集（植入极端记录 / 强相关度量 / 构成差异维度 / 纯噪声对照组），接入 jest（原文误写 vitest） | [x] | 改由 Kernel 在 K-4~K-7 中一并完成（golden.test.ts / goldenModel.test.ts + testUtils 无 worker DSL 执行器）；噪声对照零输出 |

### 阶段三 · M2 模型类

| # | 任务 | 状态 | 说明 / 验收标准 |
|---|------|------|----------------|
| K-6 | `stats/ridge.ts`：闭式解 ridge、标准化、LOO λ 选择、固定种子置换检验（内置 PRNG，禁用 Math.random） | [x] | 与解析解对拍；同输入必同输出（可复现性） |
| K-7 | B 类 `contributingDim.ts` + C 类 `contributingMeasure.ts`：特征构造（top-K rates / 二阶项）、holdout 打分、护栏，完整实现 | [x] | 金标准：植入的相关字段检出，无关字段不出现；确定性用例通过 |
| E-7 | B/C 证据图与文案：散点证据图由 Kernel 随解释器内置（scatterSpec），Executor 补齐 B/C i18n 键 | [x] | 暗色主题目视验收留给阶段四真实 UI 测试 |
| E-8 | ~~DuckDB-WASM 双端一致性~~ → 改为 workflow payload 快照契约测试（仓库内无服务端实现，DSL payload 快照即双端契约；DuckDB 对拍列为 M3 开放项） | [x] | planSnapshot.test.ts：4 快照 + B/D 共享查询相等断言 + 数值候选 bin 断言 |
| E-9 | 性能护栏：候选维度默认上限 20（`ctx.candidateLimit`，Kernel 实现），UI 显示"已扫描 N/M"并提供"分析更多字段"按需加码 | [x] | 无静默截断：`candidateTruncation()` 显式暴露 |

### 阶段四 · M3 产品层（进入前重新评估分工）

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| K-8 | headless API `explainMark(ctx): AsyncGenerator<IExplanation>` 定稿并导出 | [ ] | 含 API 文档 |
| E-10 | 行动按钮：解释字段加入视图 / 过滤到该段 / 排除离群行 | [ ] | 复用 vizStore 现有 action |
| E-11 | 字段元数据标注（可控/固定/忽略/敏感）与解释文案联动 | [ ] | 待 K-8 后细化 |

## 3. Handoff 交接物清单

进入每个阶段的工程执行前，Kernel 必须交付齐以下内容，Executor 才开工：

- [ ] 对应 K 任务代码合入，`stats/` 单测绿；
- [ ] 一个**端到端参考实现**可运行（M1 阶段 = A 类 + D 类完整跑通 engine），Executor 照此模式接线，不需要理解统计内部；
- [ ] 金标准数据集的**生成规格**（字段结构、植入信号的参数、期望输出），E-6 据此实现 fixture；
- [ ] 证据图的 vega-lite spec 模板（E-3/E-7 只做接线与主题适配）；
- [ ] 本文档 §2 中该阶段 E 任务的验收标准无歧义（Executor 开工前先通读，有疑问先提）。

## 4. Executor 工作守则

1. **改动范围**：只动本阶段 E 任务列出的文件域；顺手发现的其他问题记日志，不动手。
2. **验证闭环**：每个 E 任务完成后依次跑 ① 相关单测 ② `npm build`（graphic-walker 包） ③ playground 目视验证。注意 playground 引用的是**构建产物**：需重新 build graphic-walker 并清除 playground 的 `.vite` 缓存才能看到改动。
3. **提交粒度**：一个 E 任务一个 commit，message 前缀 `feat(explain)` / `refactor(explain)` / `test(explain)`，正文引用任务号。
4. **不确定就停**：满足 §1 任一升级触发条件时，停止该任务、记日志、切换到其他不受阻塞的 E 任务。
5. **日志格式**：见 §5 表头，append-only，不改写历史行。

## 5. 进度日志（append-only）

| 日期 | 角色 | 任务 | 记录 |
|------|------|------|------|
| 2026-07-07 | Kernel | — | 方案文档与本分工文档创建；等待方案评审后启动 K-1 |
| 2026-07-08 | Executor | E-3 | 重写 `components/explainData/index.tsx`：接入 `explainMark()` 流式结果、按类型分组、卡片化展示、证据图/证据表渲染、空状态与加载状态；验证：`npx tsc --noEmit -p tsconfig.json`、`npx jest --silent` 通过。 |
| 2026-07-08 | Executor | E-4 | 删除旧 Explain Data 路径文件与 `utils/normalization.ts`，移除无剩余引用的旧解释接口/谓词/检查辅助函数；验证：旧路径 grep 无输出，`npx tsc --noEmit -p tsconfig.json`、`npx jest --silent` 通过。 |
| 2026-07-08 | Executor | E-5 | 为 en-US / zh-CN / ja-JP 补齐 `explain.*` 文案，描述保持关联性措辞；验证：locale JSON 解析通过，禁用因果词 grep 无输出。 |
| 2026-07-08 | Executor | Verification | 阻塞项：按要求执行 `git status --short packages/graphic-walker/src/lib/explain/` 非空，显示该 frozen 目录下已有未跟踪文件；Executor 未修改该目录，需 Kernel 确认这些文件的归属后该检查才能为 empty。 |
| 2026-07-08 | Executor | Verification | 补充：最终状态还显示 `packages/graphic-walker/src/lib/explain/index.ts` 有 tracked 修改；该文件属于 frozen 边界，Executor 未编辑，保留给 Kernel 处理。 |
| 2026-07-08 | Kernel | Review | 澄清 Executor 两条阻塞项：frozen 目录下的未跟踪/修改文件均为 Kernel 并行开发的 K-6/K-7（ridge、B/C 解释器）与 E-9 内核侧改动（candidateLimit），非违规；Executor 判断正确。E-5 评审修正一处：新 locale 键与遗留顶层 explain 块重复（JSON 后者覆盖前者导致新键失效），已删除遗留块。 |
| 2026-07-08 | Kernel | K-6/K-7 | ridge 内核 + B/C 模型类解释器完成：LOO-CV R² 增益 + holdout 预测增益 − 固定种子置换校准；金标准（12 标记，植入 traffic/channel 信号 + 噪声对照）通过。发现并修复 D 类缺陷：单条极端记录使所有无关维度的 sum 份额构成虚高（ROW_DOMINANCE_RATIO 护栏）。 |
| 2026-07-08 | Executor | E-7 | 补齐 B/C 与 skip.noDerivableTarget、truncation 的三语文案；验证：JSON 解析通过、顶层 explain 唯一。 |
| 2026-07-08 | Executor | E-8 | 新增 planSnapshot.test.ts：四类解释器的 workflow payload 快照 + B/D 计划相等断言 + 数值候选 bin 断言；两次运行快照稳定。 |
| 2026-07-08 | Executor | E-9 | UI 接入 candidateLimit / candidateTruncation：截断提示 + "分析更多字段" 按钮（+20 重跑）；验证：jest 21 套件 277 测试、tsc 通过。 |
| 2026-07-08 | Kernel | 收口 | M0~M2（阶段一~三）全部完成并提交；全量 jest + tsc + vite build 通过。阶段四（M3 产品层）待用户真实 UI 验收后再评估分工。E-8 的 DuckDB 真机对拍列为 M3 开放项。 |
