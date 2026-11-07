# S2 独立代码审核

日期：2026-11-06。审核模型：`gpt-6.1-sol`，reasoning effort：`xhigh`。工作树：`feat/native-worksheet-renderer`。

结论：**PASS，仅针对下述冻结候选的 S2 代码门禁。** 当前没有未解决的 P1/P2 代码审核阻断项。阶段 commit 仍须取得同一冻结产品版本的独立 Terra 浏览器验收通过；本报告不代替该门禁，也不表示 S3 产品接入、全部 R01–R17、A01–A16 或 B1–B5 已完成。

## 审核快照

基线为 2026-11-06 的 `feat(worksheet): add marks, display scopes and controlled interaction`，提交标识 `6534b263`，关联 [draft PR #528](https://github.com/Kanaries/graphic-walker/pull/528)。本次审核其后的 S2 工作树变更。

实现方冻结产品、测试和 benchmark 源码后，审核者独立核对 81 个文件。最终检查前后的指纹一致：

```text
SHA-256 36de720796ecae4b74e9ca465397f6aecb9ebf155d79d9c5e8d91b61f4a8b516
```

指纹范围为 `packages/worksheet-renderer/{src,tests,scripts,demo,bench}` 下的 `.ts/.tsx/.mjs/.js/.json/.html/.css`、该包 `package.json` 和 `tsconfig.json`，以及 `packages/graphic-walker/src/lib/native` 的同类文件。生成的 `.bundle.*` 和 `build.json` 不在范围内。每个文件先计算 SHA-256，再对按路径排序的 `{path, sha256}` 列表进行紧凑、键名排序的 JSON 编码并计算总 SHA-256。

README、需求与实施台账、验收报告及原始测量文件的后续文档更新不改变这一产品指纹。上述产品文件若再次改变，须复核相关检查，不能沿用本报告批准新的源码。

## 实际审核范围

- 对照设计 v0.4、需求、alignment、实施记录及 S1 审核记录，检查本阶段调度、窗口与几何缓存、预览和补页、资源预算、分页导出及生命周期。
- 检查 source 对象身份、完整版本和计划签名隔离，owned immutable response 与完整窗口验证缓存，稳定 datum key 合并、覆盖矩形、续页限制和读取限额。
- 检查默认物理并发 4、优先级、共享消费者独立取消、超时及不响应 abort 的 source；检查已销毁 reader 发起的共享排队任务仍可供其他消费者完成。
- 检查 cache key/id/entry 成本、各类数据缓存、选择、已呈现帧、候选帧、只读副本、导出工作集及共享 pane 几何的计数与释放。
- 检查最多 256 项的 pane 局部几何缓存、跨滚动帧的共享保留、Canvas 全局命令与 SVG 局部组/滚动变换的共同语义，以及冻结头、选择、焦点、命中和导出。
- 检查真实规模 fixtures、benchmark 计时边界、对称回收基线、正式构建和包消费。

新实现仍消费既有 IChart 的适配结果与已准备记录。未新增计算 DSL、SQL 执行器、业务聚合、LOD 或 VizQL，也未引入新的用户持久化 specification。堆叠端点、完整显示域、索引和几何属于已有设计允许的显示计算。根入口未加载 React、GW runtime、Vega 或 Plot。

## 发现与修复复审

| 发现 | 冻结候选中的处理及独立复核 |
| --- | --- |
| P1：导出在 scheduler 内用 `withAbort` 提前结束 provider wrapper，真实读取尚未停止就释放物理槽位 | scheduler 内等待真实 provider promise；导出和 reader 消费者在外层及时取消。独立 maxConcurrent=1 探针连续取消三次，真实读取与 active 均保持 1，没有额外启动读取。 |
| P2：完整 pane 已返回且完整域已就绪，但缺少矩形覆盖时仍显示 Loading | 完整 pane 可证明其非空槽位；覆盖继续负责空槽和完整终页的确认。独立续页探针得到 1 个实际 hit，只有未确认槽位保留 Loading。 |
| P2：可选 overscan 与必需视口合并后，两个合法的 11,000-record 窗口一起触发 20,000-record 限额 | 可选与必需任务在 pending、active containment 和底层任务身份中隔离；新 render 取消旧预取。两个独立窗口均完整成功，失败的大预取不影响小视口。 |
| P1：合批读取的总记录额度随消费者取消而缩小，未取消的同伴也失败 | flight 在创建时固定总额度；每个消费者对切片结果执行自己的限额。取消一个 11,000-record 消费者后，另一个仍完整取得 11,000 条记录。 |
| P2：扫描无关 pane 缓存也调用 cacheGet，改变 LRU 顺序；完整缓存缺少全部复用条件 | 相交范围先筛选，完整缓存使用 source 对象身份、完整版本、完整计划签名和验证限额；source/host 的后续修改不能改写已验证 bundle。独立旧/新 LRU 对照及冻结回归通过。 |
| P2：计时遗漏缓存/合并/估算工作，benchmark 读取不存在的字段 | reader 对同步 continuation 计时，排除 provider 同步部分、异步等待和宿主进度回调；provider 同步耗时单列。独立 busy-provider 与 busy-cache 探针通过，热完整缓存不再重复验证。 |
| P2：B5 名义 10×10 容量被无条件多取一行一列拒绝；连续像素滚动需要实际相交边缘格 | 范围按精确视口端点计算；名义容量与相交边缘格分开，内部最多 202 格/40,400 条整 pane 记录。可见 20,000 marks、SVG 5,000 hits/10,000 元素和 128 MiB 限制保留。需求与 README 记录修正原因，未采样或删除数据。 |
| P2：候选帧提前双计尚未创建的只读副本及不可变字符串，B5 5,000 标记首帧被拒绝；缓存键成本漏账 | 按实际保留结构计量，惰性只读副本单独计费；cachePut 计入 key/id/entry。独立控制器探针提交 5,000 hits/5,699 全局命令；1 MiB key 在 1 KiB 预算下被拒绝。 |
| 共享几何缓存优化需要同时保护旧帧和候选帧，不能让 LRU 淘汰漏掉活引用 | shared reservation 按对象身份计唯一 base，exclusive 部分分别计费，逐 pane pin，失败替换保持旧 owner；缓存项仍独立计费。独立 3,000 次 owner 替换/释放/分区迁移，账本始终等于参考模型且不超限。 |
| P1：宿主持有 disposed controller 时，source 索引和 SVG backend 的已移除节点仍被闭包保留 | 清 SVG backend、semantic 内容、reader 的 source/plan/prefix/队列/描述符及 initial input。独立 WeakRef 探针在跨任务显式 GC 后，Canvas/SVG source 和 SVG 标记节点均可回收，账本归零。 |
| P1：上述清理一度使首个 reader 发起的共享排队任务改读 disposed stub，取消其他消费者 | 每个 scheduled job 捕获独立的 source/plan/prefix 和版本校验上下文。独立阻塞物理槽位后销毁首个 reader，describe、axis、domains、locate、panes 五类存活 export 消费者均完整成功；WeakRef 回收仍通过。 |

浏览器初验发现的实际 prepared preview 含不完整 series 时错误拒绝也已修复。预览可以保留明确未知占位，只有完整 pane 和必需完整域才绘制；终页完整性校验仍严格，未将 preview 当作完整输入。

## 独立执行的最终验证

环境为本机 Node `v24.11.1`。下列最终检查均在上述稳定指纹上实际执行，未以实现方的检查摘要替代。

| 检查 | 结果 |
| --- | --- |
| 子包 `npm test` | **202/202 通过**，无跳过、取消或失败，包含新队列隔离和 GC 保留引用回归。 |
| 子包 `npm run typecheck` | strict TypeScript 检查通过。 |
| benchmark TypeScript | `tsc -p packages/worksheet-renderer/bench/tsconfig.json` 通过。 |
| 正式构建 | `npm run build` 通过，生成 core/react ESM 和声明。 |
| strict NodeNext 消费 | 隔离消费工程导入 core、RenderPlan、范围/视口导出类型及 `/react`；`skipLibCheck:false`，通过。 |
| 原生 Node ESM | 实际导入正式 core 与 `/react` 产物成功，根入口无需 DOM/window。 |
| 根依赖图 | esbuild 检查 128 个输入，无 React、GW runtime、Vega/Vega-Lite 或 Plot；根 bundle 无外部 runtime import。 |
| `npm pack --dry-run --json` | 44 个发布文件，含入口与完整声明；未发布包。 |
| prepared 语义差分 | 与 S1 prepared 实现对照 60 个计划组合，覆盖五 mark、shared/pane/prefix、默认/逆序 ordinal、单/多度量槽；manifest、轴、pane、记录、域和 series 元数据一致。 |
| 缓存 Scene 差分 | 10 个合法 IChart 场景 × 6 个连续像素偏移；缓存与非缓存的全局 commands、hits、选择/焦点、框选和点命中一致，数值比较精度为 1e-7。 |
| 共享预算不变量 | 3,000 次独立随机 owner/共享 base/分区操作通过，检查原子拒绝、唯一 base 成本、分区总和及最终释放。 |
| 独立异常与生命周期探针 | 物理并发、补页完整 pane、预取隔离、同伴取消、计时、B5 控制器容量、大 key、共享排队五类方法及 WeakRef 回收均通过。 |
| diff 与冻结复核 | `git diff --check` 通过；最终 81 文件指纹与开始时一致。 |

独立探针、日志和消费工程保留在本聊天工作区的 `work/s2-review-*`，未改产品源码或测试。DOM mock 只验证控制器、几何、预算和引用生命周期，不证明浏览器像素、原生输入、SVG 原生布局性能或屏幕阅读器行为。审查期间也实际运行过百万真实记录的 B3 索引/窗口补充探查；开发中探查的性能值没有作为本冻结候选的正式性能通过证据。

## 批准边界

本次通过覆盖 S2 代码实现及上述合同回归。资源账本是保留量估算，不是浏览器总 heap 或进程 RSS；完整输入、供数索引和位图仍须按需求另列。source 忽略 abort 时，消费者可及时结束，真实物理读取及其必要引用须保持到 provider 真正结束，不能将其提前报告为已释放。

正式冷帧、滚动、交互、实际 heap、50 次生命周期及浏览器矩阵以独立 [浏览器验收](./browser-acceptance.md) 和 [规模记录](./benchmark-data.md) 为准。旧构建的 pilot、后一次较低的 GC 增长、预建 source 的 500 ms 冷帧，均不能替代冻结构建或完整 B3 重建链路的测量。60 Hz 与实测 120 Hz 的参考环境条件应按用户最终确认记录，本代码审核不代替环境变更确认。

S3 的生产 GW renderer、canonical 输入保留、保存/重载/历史/导入导出、公开事件适配及旧 renderer 回归仍在后续范围。当前 S2 代码 PASS 不关闭这些要求，也不代表完整首版发布就绪。
