# S3 independent code review

结论：代码审查 PASS，仅对应下列冻结候选。复核范围内没有尚未解决的新增 P0/P1/P2 代码问题。该结论不代表 S3 或首版整体完成，不替代独立浏览器验收、性能门禁或最终构建与包消费检查。

审查日期：2026-11-06。独立审核模型为 `gpt-6.1-sol`，reasoning effort 为 `xhigh`。审查者只读生产代码，修复由实现方完成。本轮写入此报告、提交保留的 ownership 探针和结果，以及未纳入提交的 `work/s3-review/` 临时脚本。

## 冻结范围与 hash

- 候选工作树：`/Users/observedobserver/.codex/worktrees/native-worksheet-s3-results/graphic-walker`。
- 冻结 S2 比较基线：`/Users/observedobserver/.codex/worktrees/native-worksheet-renderer/graphic-walker` 的当前产品文件。
- 清单：[candidate-manifest.json](./candidate-manifest.json)，76 个相对 S2 的产品、测试、配置及 README 增量文件。
- 独立重算 fingerprint：`04f08b1acc58d29a9d609e3dcb645b859973a79035fba05eba724289865aa6b6`。

已逐一核对 76 个候选 SHA-256 与对应的 76 个 S2 baseline SHA-256，全部匹配。fingerprint 将条目按 path 排序，以 `${path} ${sha256}` 用换行连接且无末尾换行，再对 UTF-8 字节计算 SHA-256。

S3 相对 Git HEAD 的 diff 含未提交的 S2 实现，因此本轮逐文件比较两工作树，没有把 S2 全量 diff 当作 S3 新代码。`public/chartinfo.json` 与 `stoinfo_v2.json` 是仓库原有 gitignore 排除的 gen-schema 产物，不属于新增源文件。报告和 work probes 不进入产品 fingerprint。

## 问题与修复复核

| 编号 | 首轮问题 | 最终复核 |
| --- | --- | --- |
| R1，P2 | `binCount` 的数字桶号被声明为 interval；标准 ordinal bin 又被 adapter 当作 band interval 拒绝 | binCount 按 number 保留；已有 computed bin interval 绑定连续位置。真实 GW 元数据的 bar histogram probe 与新回归通过，未新增计算 |
| R2，P2 | VL facet/color sort 被接受后丢弃；位置 string sort 也会变为 GW measure 排序。组件 mapper 还忽略已接受 title | 无法保真的显式 sort/order 返回属性级诊断；直接 mapper 保留 title。原 probe 重跑通过 |
| R3，P2 | 旧 renderer 的 passive unmount cleanup 可覆盖新 native 的 AppRoot 导出方法，旧异步完成也可误写状态 | 旧路径按函数归属释放 API，并限制异步状态回写。native API 在父 AppRoot handle 存在后的 passive effect 注册。真实旧 renderer 挂载后的 handoff 已进入工程回归 spec |
| R4，P2 | theme memo 没有依赖其读取的编码/聚合语义；缓存 scale map 还可能保留旧 range | 编码与 defaultAggregated 依赖已补齐；source 缓存仅保留显示 sort domains，当前 adapted scales 提供最新 cosmetic ranges |
| R5，P2 | fold 阶段与绑定校验不足，合法导入后可能忽略 fold、缺列或提前计算虚拟值 | 缺失输出、原 fold source 编码、虚拟输出 bin、任意 occurrence 的错误角色、多个有效 value aggregator 均明确拒绝；相同 aggregator 的多 occurrence 保留 |
| R6，P2 | loose equality 被改成严格 membership，null 与 string `"null"` 等既有 GW filter key 碰撞会改变结果 | loose `==`/`!=` 与有编码碰撞的 membership 值明确拒绝；普通严格标量比较保留，未改计算引擎 |
| R7，P2 | 保留已卸载 public handle 可经 hook 词法 context 保留 getter/result | forwarded handle 工厂移到模块级，仅保留小型 API ref；dispose 解除 factory getter；实际卸载释放 hook getter。修复前后 V8 GC probe 与旧方法拒绝 probe 通过 |
| R8，P2 | 新共享时间准备错误要求隐藏编码的未查询列，导致旧 point/text/arc/line 图抛错 | 仅准备最终 mark 实际消费且原 geom 查询支持的字段，details 同样遵守查询边界；有效字段缺列仍拒绝。独立原始 probe 与 8 个正反回归通过 |
| R9，P2 | 新时间 helper 拒绝旧 Vega 路线接受的有效 JS Date 对象 | 仅 legacy 列准备把有效 Date 转 ISO 输入同一显示公式，保留 raw Date 对象与旧偏移。invalid Date 仍拒绝，native 原 string/number/null 合同不扩展。旧/新实际 Vega compile+View probe 均成功 |
| R10，P2 | Vega 全局 selection/click 配对丢首次点击；简单改为 Promise.then 读 live signal 又可能将 A 事件配成 B selection | 移除全局 click/selection Subjects。每个 view 使用真实 listener item，在 queued run 的实际 postrun 克隆本 view 的 geom snapshot，再按原事件派发，双 active guard 防卸载后回调；队列 probe 通过 |
| R11，P2 | 旧查询 Error 501 污染新图；初修遗漏 GraphicRenderer，且 passive cleanup 前仍有 commit 竞态 | Editor 与 GraphicRenderer 均按原 payload 的内部 ownership 报错；layout 阶段维护 committed request，组合 active guard。最终真实 useRenderer production/StrictMode 的 commit、unmount、display-only 六个窄 probe 全通过 |

R3 的初始判断依据为 React effect 顺序与真实 cleanup 源码，未将其写成已独立运行的浏览器结果。工程 spec 现在先证明真实 Vega/Plot 已挂载，再切 native 检查 AppRoot 元数据，覆盖了原来深层 unsupported 空态测试不能覆盖的路径。实际浏览器运行证据归工程报告与独立验收所有。

## 定向复现与最终验证

共享时间候选 af200f24…02893 上独立执行了以下定向检查，均退出 0。后续 d95dca43…34256 增量修改了 ReactVega 点击桥，最终 04f08b1…aa6b6 再增量处理 render-query 错误归属。原定向单元测试结果按各自文件版本保留，最终 ownership helper 的 3 个目标测试及真实 useRenderer 的 6 个短浏览器 probe 已独立执行。

| 检查 | 结果 |
| --- | --- |
| GW `vlImport.test.ts`、`nativeCanonical.test.ts`、`legacyCapabilities.test.ts` | 3 suites，53/53 tests PASS |
| GW `temporalDisplay.test.ts`、`observablePlot.test.ts` | 2 suites，52/52 tests PASS，含实际 Vega compile+View、隐藏字段正反对照与 Date 兼容 |
| worksheet `native-results.test.ts`、`native-display.test.ts`、`labels.test.ts`，esbuild bundle 后由 Node test runner 执行 | 24/24 tests PASS，0 skip |
| `bin-probe.ts` | 标准 ordinal bin `[0,10]` 与 binCount `1` 的 preparation/adapter 均无 error |
| `vl-probe.ts`、`fold-import-probe.ts` | 无法保真的 sort 与不完整 fold 绑定均在 import 阶段拒绝；title 保留 |
| `fold-bin-probe.ts` | 原先被接受后由真实 transformData 抛错的 virtual bin 现于 `encoding.x.bin` 拒绝 |
| `fold-phase-probe.ts` | 多 agg、value dimension 混用、key measure 混用均于 fold 路径拒绝 |
| `filter-fixed-probe.ts` | loose equality、null 与 string `"null"` 均拒绝；`=== 1` 仅保留 number `1` |
| `retained-handle-probe.ts`、`retained-api-probe.ts`，Node `--expose-gc` | 保留已卸载旧 handle，或同时保留 disposed factory 对象/handle/exportChart 时，4 MiB result 都可回收；五个旧 API 方法均以 AbortError 拒绝 |
| `vega-click-queue-probe.mjs`、`vega-postrun-noop-probe.mjs`，真实安装的 Vega View | pending pulse 下 A/B snapshot 保持 A/A、B/B；无 touched 的连续 bridge run 仍各执行一次 View postrun |

GC probe bundle 真实 `useNativeExportApi`/`createNativeExportApi` 源码，仅用最小 hook stub 执行 setup/cleanup，以 WeakRef 和 V8 GC 检查引用链。修复前，保留旧 forwarded handle 时 result 存活，释放 handle 后可回收。最终代码在仍保留旧 handle/API 时已可回收。该证据证明此闭包保留路径已解除，不冒充真实 React 浏览器堆验收。

实现方另有真实 React development StrictMode 组件复测，其执行与范围记录在 [component-engineering.md](./component-engineering.md)。生产 StrictMode 不发生 effect replay，不能把生产浏览器通过替代该项。

早期独立运行过完整 worksheet suite，225/225 PASS；那次处于并行修改阶段，不作为最终冻结版整套结果。最终整套测试、production build、外部 tarball consumer 与独立浏览器结论应引用各自最终报告，不能由本报告的定向检查代替。

## 共享时间与 Plot 格式追加复核

在前一候选 `0e13fed…fcf71` 后，复核了共享 `lib/temporalDisplay.ts`、native compatibility re-export、getSingleView 别名列、toVegaSpec 正式 data.values、Plot 格式与实际 GW fixtures、WeakMap metadata 和事件桥的增量。

共享逻辑保留原逐值显示公式，明确处理 null、epoch 0、混合 ISO/date-only、行重排及每个 fid/offset occurrence。它不执行计算表达式、不改查询结果、不新增持久字段。getSingleView 和 native 都把显示坐标放入独立列，原值列保留；Vega/Plot 直接使用已准备值，不再依赖旧首行决定的 calculate transform。相同 fid/有效 offset 复用列，不同 offset 分列，生成列避让所有原始 key。

legacy scale callbacks 继续得到完整 raw values。Vega point selection 继续引用原 fid；事件桥借弱键 metadata 映射直接 temporal line 分组键，renderer 删除了旧时间 O(N) 原值反查。metadata 不进入返回的 specification JSON，重复 view 各自携带正式 prepared values，原输入不被改写。

独立 `temporal-line-probe.ts` 经实际 Vega compile+View 证实，直接时间分组的 `__gw_time_N` 能映射到原字段。旧路径对带 timeUnit 的派生 line 分组键，例如 `utcyearmonth___gw_time_N`，仍不能通过此 map 还原原 fid。该缺陷在旧 raw fid 路线也存在，本轮未扩展为依赖 Vega-Lite 内部命名的修复。保留 timeUnit 声明不等于已验证该选择组合，不得将其作为三后端选择等价的通过案例。native 已准备 dateTimeDrill 的原值回调不受此旧路径边界影响。

Plot 格式补丁仅映射数值/时间轴的既有静态格式，未增加查询或任意 transform 执行。真实 GW bin/binCount fixtures 从 raw Amount 经既有 transform 和 count 得到结果；同名 fold fixture 从 raw RevenueA/B 聚合；mixed temporal fixture 保留两条 DST ISO、一条 date-only 与 null，未换成同质数据绕过兼容问题。实际三后端坐标与点击、真实 development StrictMode 和独立浏览器验收仍由各自工程/验收报告证明，本代码报告不冒领这些执行结果。

## Vega 点击桥追加复核

工程三浏览器回归与独立 UI 验收发现，旧全局 `selection$.withLatestFrom(click$)` 在 selection 先于 click 时丢首个回调。第二次点击还可能借用前一事件。最终修复只改 ReactVega 的事件桥，跨 view 的业务 filter stream 保留。

审查者在真实安装的 Vega View 上运行队列 probe，先挂起一个 pulse，再依次排入 A/B 两个点击。过早检查 `event.item` 得到空结果。取消该检查但在 Promise.then 读取 live signal，得到 `A/B`、`B/B`，证明 selection 与事件错配。把读取固定到每个 queued run 的 postrun 后，得到正确的 `A/A`、`B/B`。

最终代码从 listener 的第二参数捕获真实 item，不依赖异步 eventExtend 提前填好 event.item。`runAsync` 的实际签名是 `encode, prerun, postrun`，最终代码精确 cast 后调用第三参数，未把第二参数 prerun 当成 postrun。每个 view 在 postrun 中 `structuredClone` 当前 geom，Promise.then 仅派发该 snapshot；捕获与派发都检查 effect 的 active 标志。当前 handler 用 ref 更新，每个 listener 绑定自己的 view/spec，消除了全局跨图配对。

还单独检查了安装的 View.evaluate 覆写，并以 no-op probe 连续执行两次无 touched 的 bridge run。View 仍各调用一次 postrun，不会因 Dataflow 提前返回而漏掉 snapshot。typed cast 保留了 `run.call(view, ...)` 的 this。这里没有新查询、计算语义或 renderer 自动切换。

实现方报告新 bundle 的 Chromium/Firefox/WebKit 定向首次点击与三后端坐标用例 3/3 通过，旧 bundle 三者均失败。此处将其列为工程运行结果，不冒充审查者独立浏览器执行。最终全量测试、生产构建及 Terra 新页面首击/下一点复验仍应引用各自报告。

前一共享时间候选 af200f24…02893 的代码审查结论作为历史保留。该点击桥候选的结论作为历史保留，当前 PASS 绑定页首 04f08b1…aa6b6 fingerprint，不把后续修复倒算为旧候选已通过。

## 查询错误归属追加复核

最终增量涉及 App、RendererApp、renderer hook、内部 ownership helper 及对应回归。原 payload 作为 WeakMap key，不增加公开字段，不改 host 收到的对象或 DSL。App/RendererApp 的 catch 在 owned Promise finally 释放前检查归属，stale 错误仍向调用者 reject，但不触发新图的 Error 501；未注册 owner 的原有调用者仍可报告错误。成功、异步拒绝和同步 throw 均释放 metadata。

审查先发现 GraphicRenderer 的旧 withErrorReport 入口遗漏，实现方已补成与 Editor 相同的 guarded wrapper。随后用真实 React production commit/microtask probe 证实，仅 passive active 标志仍有窗口。原失败顺序为 `layout1 → setup1 → layout2 → catch1(current=true) → cleanup1`，新图已 commit，旧错误仍被报告。最终 hook 改由 layout effect 维护 committedRequest，predicate 同时要求 active 与同一 committed request；没有在 render 写 ref，也没有比较 chart 对象身份。query 调用及成功/失败 settle 都使用该 predicate。

最终独立短 probe 使用真实 useRenderer：production 与 development StrictMode 各覆盖 commit、卸载、display-only 三种情形，共 6/6 通过。commit/卸载后旧 reject 为 current=false，无报告；新图成功值保留。display-only 切换完整 chart 对象、backend/color 后没有重查，当前查询仍为 current=true，合法错误正常报告。StrictMode effect replay 未增加实际源调用。

可提交复现源码为 [ownership-commit-probe.tsx](./ownership-commit-probe.tsx)，完整原失败 log 与最终六项结果在 [ownership-probe-results.json](./ownership-probe-results.json)。前置失败 log 来自真实 React、真实 ownership helper 与旧 passive guard 的隔离复现，最终六项直接使用产品 hook。它们不冒充全产品浏览器验收。

从仓库根目录构建该短 probe，不执行产品 build：

```sh
node --input-type=module <<'JS'
import { build } from 'esbuild';
for (const mode of ['production', 'development']) {
  await build({
    entryPoints: ['docs/verification/s3/ownership-commit-probe.tsx'],
    outfile: `work/s3-review/ownership-${mode}.js`,
    bundle: true, format: 'iife', platform: 'browser', target: 'chrome120',
    tsconfig: 'packages/graphic-walker/tsconfig.json',
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
  });
}
JS
npx --yes --package @playwright/cli playwright-cli -s=ownership-review open about:blank
```

使用 CLI 的 run-code 加载对应 bundle，并分别以 production/strict=false 和 development/strict=true 执行三种 scenario。例如 development：

```sh
npx --yes --package @playwright/cli playwright-cli -s=ownership-review run-code 'async (page) => {
  await page.setContent("<main>Ownership probe</main>");
  await page.addScriptTag({path: "work/s3-review/ownership-development.js"});
  return await page.evaluate(async () => {
    const results = [];
    for (const scenario of ["commit", "unmount", "display-only"])
      results.push(await window.runOwnershipCommitProbe({scenario, strict: true}));
    return results;
  });
}'
npx --yes --package @playwright/cli playwright-cli -s=ownership-review close
```

将 bundle 改为 ownership-production.js、strict 改 false 即可复现 production 三项。工具版本及浏览器可执行环境需由复现环境提供。本轮没有启动产品完整 build/e2e；那些结果仍归实现与独立验收报告。

## 接入边界检查

- query request 与 settled result 以同一对象配对，render 阶段同步排除旧 request 的 rows。active 标记阻止乱序完成及卸载后发布。queryRows、workflow 和 result version 一起跨 renderer 边界。
- native preparation 不调用 computation。identity 使用 typed 原值与既有 aggregate group keys。raw 无宿主 key 时明确限制为 snapshot；fold sidecar 区分同名分支；temporal 坐标保留原值列。
- Canvas/SVG 切换使用同一控制器与 Scene 合同。后端与纯样式变更复用 prepared source；sort/collapse 只改变显示，缺少父值时保持空白，不补聚合值。
- public ref、AppRoot API、selection 字段引用及旧 renderer guard 均保留原 IChart。普通 rows/columns 不再 crossLimit 截断，旧路径超出能力时显示诊断并由用户显式选择 native。
- VL-like 输入先验证再转换。无法保真的 transform、params、expression 与 fold 组合不能静默丢弃。canonical IChart 的既有 SQL/计算 DSL 路线保持独立。
- worksheet 包没有引入查询、聚合、LOD 或另一份持久 DSL。S3 schema 与公开依赖、类型入口、构建顺序及 consumer tarball 配置已检查。

此 PASS 只对上述 76 文件 fingerprint 有效。后续产品、测试或配置变更应重新确认受影响范围与 hash。S2 的既有未完成门禁、S3 独立验收及整个 PR 的关闭条件保持各自状态。

## 提交收口的补充审核

同一独立Sol审核者静态复核根`.gitattributes`的新规则 `docs/verification/**/*.json linguist-generated=true`，结论PASS。它仅标记验证文档目录中的JSON，保留原始数据，不匹配packages/src的产品源码；原`* text=auto`保留。本次不改变76文件产品候选和其审核结论，也未重复运行产品测试。
