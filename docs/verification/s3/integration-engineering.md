# S3 产品接入回归记录

日期：2026-11-06。本记录是实现方回归，独立门禁分别见代码审核和浏览器验收报告。本阶段按最终冻结候选提交；前一候选通过不代表后续修改自动通过。

## 最终候选

76 文件候选 `04f08b1acc58d29a9d609e3dcb645b859973a79035fba05eba724289865aa6b6`，生产浏览器资产指纹 `d8a42531535a4b20f38305dac42a7b987ebadbc9b4bbfd7c8df9372976c75812`。GW 全量 **42 suites、473 tests、4 snapshots**，严格 TypeScript 检查及根目录生产构建均通过。Chromium、Firefox、WebKit 的完整生产浏览器回归 **114/114 通过**。worksheet 核心未再变更，保留同一核心版本的 **226/226** 回归。最终两个 tarball 在仓库外新项目和独立 Yarn cache 中安装成功，真实 Vite consumer 构建通过；没有依靠 monorepo 的包链接或已发布 worksheet 版本。最终规模性能在浏览器报告中单列。

Safari 补验发现编辑器切换数据和图表后，旧 computation 的错误仍会触发全局 501。修复以原始 payload 的内部 WeakMap 记录请求寿命，编辑器和 GraphicRenderer 只报告当前请求的错误，仍向调用者抛出原始错误。独立 Sol 又复现了 React commit 后、passive cleanup 前的窄窗口，最终由 layout effect 标记已提交请求；不在 render 阶段让未提交的请求夺走所有权。当前查询仅因颜色或后端改变不会失去错误上报资格。真实 production 与 development StrictMode 的独立六组探针覆盖 commit、卸载和 display-only 三种路径，见 [代码审核](./code-review.md) 与 [探针源码](./ownership-commit-probe.tsx)。

新增浏览器回归分别通过真实 GraphicWalker 与 GraphicRenderer 检查样例切换、已运行旧请求失败、显示修改后当前请求失败。最终 bundle 的真实 Safari bin→fold、两个宿主的旧请求拒绝及当前错误均由独立 Terra 复验。以下早期候选记录保留，不替代上述最终结果。

## 已执行检查

67 文件候选指纹 `0e13fed073b66761c17d16bb6981883632af9b0aa185f42247278c8c294fcf71` 已通过以下检查：

| 检查 | 实际结果 |
| --- | --- |
| GW 全量 Jest | 40 suites、447 tests、4 snapshots 通过，无失败 |
| 根目录生产构建 | worksheet 的 core/react ESM 与声明、GW ESM/UMD 与声明、原 schema 生成均完成 |
| 独立 Sol 定向复核 | GW 53 项、worksheet 24 项通过，67 个候选和 S2 基线文件 hash 匹配 |
| 卸载引用回收 | 独立 V8 WeakRef 探针确认宿主持有旧 handle/API 时结果可回收；已销毁的导出方法返回 AbortError |
| React 开发模式 StrictMode | 卸载引用修复后，6 个直接组件案例通过，包含真实 effect replay 与导出 API 所有权交接 |

此前生产候选的 48 个 Playwright 案例通过，覆盖 Chromium、Firefox 和 WebKit。该轮先于最终导出引用清理修复，不能当作本候选的最终浏览器回归。WebKit 结果也不能称为正式 Safari 结果。仓库外 tarball 安装与 Vite consumer 构建此前通过；最终发布候选仍需按其产物复核。

## 产品路径

真实宿主 fixture 使用 `getComputation` 执行现有 workflow，再由 renderer hook 提交同一批结果及其版本。测试覆盖 PureRenderer、GraphicWalker 编辑器、GraphicRenderer/AppRoot 的既有公开接口。直接 native 组件 fixture 单独验证生命周期、controlled callbacks 和显示更新。

已覆盖的集成回归包括查询竞态、错误恢复、过滤、字段拖入、undo/redo、图表保存与重载、四公开 ref 方法、IGW 导出、旧 Vega 的导出处理函数移交、真实 Plot 图表切换到 native，以及深层图表在旧后端明确诊断后由用户选择 native。仅变更 renderer、Canvas/SVG 和主题不发起新查询。数值计算继续由已有 GW computation 执行。

独立浏览器验收发现同一份 `layout.format.numberFormat = '.1f'` 在 Plot 坐标轴中丢失。该项按 A15 修复，未缩减兼容声明。另补充通过真实 computation 的标准 bin、binCount、同名度量 fold 和原始时间字段样例。上述变更将产生新候选指纹；此处保留前一候选的检查结果。

后续混合时间样例还发现旧 Vega 按首行格式决定整列 offset，Plot 则未执行该显示 transform。新候选将逐值时间规则提取到 GW 共享 helper，并保留原列及独立显示别名。Vega/Plot 直接消费已准备的显示列，不执行任意表达式。相同字段、相同 offset 只转换一次，不同 offset 使用不同别名；内部 WeakMap 保存别名到原字段的映射，供旧 Vega 线图点击还原分组键，映射不会写入保存的 IChart 或生成的 JSON specification。

73 文件候选 `bbf145bd73bf3e50cba829cfa563bf97ed7788779d71ce13879312c5b303c5d1` 的 GW 全量测试为 **41 suites、461 tests、4 snapshots 通过**，worksheet **226/226 通过**，根目录生产构建通过。新增直接测试包含真实 Vega-Lite compile 和 Vega View 执行。该候选的生产浏览器回归、独立审核和 tarball 消费正在执行，不能沿用前一候选的通过结论。

后续审查修复了两个旧后端回归：时间准备只处理当前 mark 实际消费且查询会返回的字段；旧 JS 数据源中的有效 Date 对象仍可用，原对象保留，显示偏移沿用旧 ISO 分支。新增八个隐藏字段/有效缺列用例及一个 Date 用例后，全量 GW 为 470 项测试通过。

73 文件候选 `af200f24b80b88266d42512a922ac509106bcc5cc05b8407cbbf694ec6d02893` 的全浏览器回归曾得到 **93/96 通过**。三项失败均为不同引擎中的第一次 Vega 标记点击未返回选择；该结果保留。独立浏览器确认首击丢失，第二次点击才返回当前值。实现移除了跨组件的全局 click/selection 配对，改为本 view 的点击队列任务完成时复制选择快照，再向当前宿主回调。独立真实 Vega 队列探针覆盖待完成 pulse 和连续 A/B 点击，得到 A/A、B/B 对应关系。

当前 73 文件候选 `d95dca43c420bd9bfe8a60b26a95e3081e5af6fe9d5ac32a7e48ce7a74234256` 的三浏览器首击定向用例 **3/3 通过**，GW **470/470**、4 个快照及生产构建通过；全量浏览器和最终产物消费仍在收尾。旧 Vega 的 timeUnit 派生 line 分组键选择限制未在此次修复，未把该情形计入跨 renderer 选择等价的通过证据。

## 复现入口

从仓库根目录执行：

```sh
npm --workspace @kanaries/graphic-walker test -- --runInBand
npm --workspace @kanaries/worksheet-renderer test
npm run build
node scripts/consumer-smoke-test.mjs
```

生产浏览器回归从 `packages/graphic-walker` 执行，`GW_E2E_PORT` 可避免与其他工作树端口冲突：

```sh
GW_E2E_PORT=4186 ../../node_modules/.bin/vite build --config tests/e2e/vite.config.ts
GW_E2E_PORT=4186 node ../../node_modules/@playwright/test/cli.js test
```

测试输出、独立审查的临时探针和本地依赖链接不作为产品发布物。最终提交只包含源代码、回归 fixture、接入文档和验收证据。

最终集成按76文件manifest逐项核对S2基线与最终内容SHA后转入PR工作树，产品指纹保持04f08b；转入后的生产构建与内容复核见实施记录。
