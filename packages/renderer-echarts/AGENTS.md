# AGENTS.md

## Renderer-ECharts Rules

- ECharts options **must** use the top-level `dataset` to provide data; writing `data` directly in any `series` is strictly prohibited.
- After adding or modifying an option builder, run `yarn tsx scripts/dump-echarts-options.ts` first and make sure that `totalViolations` in `output/echarts-options/report.json` is `0`.
- If your changes affect the rendering results, you must at least run a regression test for the affected cases using `PLUGIN_ID=plugin:echarts CASE_IDS=<ids> yarn compare:case`; for large-scale changes, run all echarts cases by default.
