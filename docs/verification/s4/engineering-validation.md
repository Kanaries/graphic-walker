# S4 工程验证

日期：2026-11-07。这是实施方检查记录；独立结论分别见 [代码审核](./code-review.md) 和 [浏览器验收](./browser-acceptance.md)。

验证对象是 [51 文件清单](./source-manifest.json) 所列的 S4 增量，基线为 2026-11-06 的 `feat(graphic-walker): integrate native worksheet renderer`，提交 `799b87377a7599bef68fd8c91504bb78ef528285`。清单自身 SHA256 为 `73ebd4e6db155a6625c3021fea1c1276e344c1483220f2e925edde72721f9638`；文档与证据不混入产品指纹。

| 检查 | 结果 |
| --- | --- |
| Worksheet package tests | 298/298；[日志](./core-tests.log) |
| Graphic Walker Jest | 473/473、4 snapshots、42 suites；[日志](./gw-tests.log) |
| Worksheet strict typecheck | 通过 |
| Graphic Walker strict typecheck | 通过；生产声明生成也通过 |
| Root production build | 最终几何修复后重建通过；[日志](./production-build.log) |
| 仓库外 fresh tarball consumer | 最终几何修复后重新打包、全新安装与 Vite 构建通过；[日志](./consumer-smoke.log) |
| `git diff --check` | 通过 |

Worksheet 测试脚本将包名解析到当前源码，避免 adapter 测试误读过期 dist。真正的构建产物解析、ESM/UMD、声明与包依赖另由生产构建及仓库外 tarball consumer 检查。

本轮新增测试覆盖各 mark 的几何与身份、相邻段事件、四种堆积与完整域、圆弧/圆环精确框选、指针容差及内孔排除、固定域缓存、compound box 选择，以及 native/legacy 查询隔离。箱图单独验证 Type-7 分位数、实际须端点、小样本须落箱内、原始离群观测、多度量槽、别名原值、空组压缩、过滤与默认完整 raw 查询。

S0–S3 的百万输入和 60Hz 性能原始报告保留原版本身份。本轮没有将其重新标为 S4 的性能测量；浏览器报告只描述实际执行的新增图形滚动和资源稳定性检查。
