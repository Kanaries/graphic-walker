# Handoff：扩充 playground 的 TerseSpec 示例

> 写给下一个负责扩充 example 的 agent。前置产物：TerseSpec 文法与实现见
> `docs/terse-spec-design.md`，页面骨架已建成并复核（提交 8b6e0bf 样式重构 317aa1e）。
> 你的任务只有一件事：**往 `TERSE_EXAMPLES` 数组里追加更多文法示例**，并按本文的
> 验证标准逐条自测。

## 1. 现状与唯一扩展点

页面：`packages/playground/src/examples/pages/terseSpec.stories.tsx`，
路由 `/examples/TerseSpec`（examples 应用侧边栏最后一项）。

页面机制（不需要你改动）：编辑器里的 terse JSON 经
`normalize(spec, fields)` 展开为 canonical IChart，喂给 `GraphicRenderer`
渲染；normalize 抛错会显示在红色告警框（错误信息自带近似字段候选，是教学的
一部分）；勾选 "show expanded canonical spec" 可查看展开产物。

**唯一扩展点**是文件顶部的 `TERSE_EXAMPLES` 数组，往后追加即可：

```ts
{
    name: 'Basic bar chart',            // 短名词短语，不带序号（序号由 index 自动渲染）
    description: 'Reference fields by NAME and ...',  // 一句话讲清这一课教的文法点
    spec: { mark: 'bar', x: 'Manufacturer', y: 'mean(Price_in_thousands)' },
},
```

规范：
- **一个示例只教一个文法点**。description 必须点名它教的是什么，不要写成图表说明。
- spec 保持最小：能省的键全省，别把已有示例教过的知识点再堆进来。
- 已有三个示例（name 引用 + 聚合简写 / computed + filter + sort / timeUnit 钻取）
  的语义**不要改**；样式、布局、页面机制也不要动。若确有页面级改动需求，先停下来
  向用户说明。

## 2. 数据集

页面固定使用 carsales（`DATASET_URL = '/datasets/ds-carsales-service.json'`，
本地由 vite 插件兜底提供，无需网络）。选它是因为字段 name ≠ fid，最能体现按名引用。
可用字段（name → fid → 类型）：

| name | fid | 类型 |
|---|---|---|
| Manufacturer | col_0_64 | nominal dimension |
| Model | col_1_62 | nominal dimension |
| Sales_in_thousands | col_2_70 | quantitative measure |
| __year_resale_value | col_3_70 | quantitative measure |
| Vehicle_type | col_4_90 | nominal dimension（取值 Passenger / Car）|
| Price_in_thousands | col_5_59 | quantitative measure |
| Engine_size | col_6_37 | quantitative measure |
| Horsepower | col_7_59 | quantitative measure |
| Wheelbase / Width / Length | col_8_73 / col_9_38 / col_10_51 | quantitative measure |
| Curb_weight | col_11_23 | quantitative measure |
| Fuel_capacity | col_12_2 | quantitative measure |
| Fuel_efficiency | col_13_60 | quantitative measure |
| Latest_Launch | col_14_36 | temporal dimension（"2/2/2012" 格式，2008–2012）|
| Power_perf_factor | col_15_54 | quantitative measure |

共 157 行。所有新示例必须在这个数据集上有效；**不要**为单个示例引入新数据集
（如果某课非换数据集不可，说明它可能不属于本页，先向用户提出）。

## 3. 建议扩充的示例（按教学价值排序）

每条给出教学点和 spec 骨架，字段可自行斟酌，骨架仅供参考：

1. **Raw scatter（关闭聚合）** — 教 `aggregate: false`：
   `{ mark: 'point', x: 'Horsepower', y: 'Price_in_thousands', color: 'Vehicle_type', aggregate: false }`
2. **count() 与 fid: 前缀** — 教两个引用逃生门：
   `{ mark: 'bar', x: 'fid:col_0_64', y: 'count()' }`（description 里说明 fid: 何时用：重名/生成式场景）
3. **bin 直方图** — 教 `computed.bin`：
   `computed: [{ name: 'FE_bin', bin: { field: 'Fuel_efficiency' } }]`，x 用 `'FE_bin'`，y 用 `'count()'`
4. **log 变换** — 教 `computed.log`：
   `computed: [{ name: 'log_sales', log: { field: 'Sales_in_thousands', base: 10 } }]`（注意 base 仅 2/10 有 conformance 覆盖，别用其他 base）
5. **饼图（无 x/y 通道）** — 教 theta + color 路由：
   `{ mark: 'arc', theta: 'sum(Sales_in_thousands)', color: 'Vehicle_type' }`
6. **多字段通道（数组形式）** — 教 `y: [a, b]` 的分面行为：
   `{ mark: 'bar', x: 'Manufacturer', y: ['mean(Price_in_thousands)', 'mean(Horsepower)'] }`
7. **filter 三兄弟补全** — 教 `notIn` / `range` /（可选）`timeRange`：
   一个示例里放 `range: [20, 40]`（Price）+ `notIn`；timeRange 若加，务必用 epoch 毫秒并在 description 里点明
8. **归一化堆叠** — 教 `stack: 'normalize'`：
   在示例 1 的骨架上加一个键，教"渐进披露"的感觉
9. **月度钻取（季节性）** — 教 timeUnit 的另一档位：
   `x: { field: 'Latest_Launch', timeUnit: 'month' }`，与已有 year 示例呼应
10. **config/layout 逃生舱** — 教 canonical 键的直通合并：
    比如 `layout: { showActions: true }` 或 `config: { coordSystem: 'generic' }`，description 里说明"逃生舱最后合并、优先级最高"

不必全做完；优先 1–5（覆盖文法主干），6–10 视排版密度取舍。tab 太多时可以停下问
用户是否要分组。

## 4. 文法红线（写 spec 时最容易踩的坑）

- `expr` 里的字段引用**必须加双引号**：`'"Horsepower" / "Curb_weight"'`。
  不加引号会被 SQL parser 小写化导致解析到错误字段（PostgreSQL 语义）。
- 简写与显式 aggregate **不能同用**：`{ field: 'mean(X)', aggregate: 'sum' }` 是错误。
- `timeRange` 只接受 epoch 毫秒，不接受日期字符串。
- `computed` 的 `expr` / `bin` / `log` 三选一，不能混填。
- TerseFieldRef 的 `aggregate` 不含 `'expr'`（表达式聚合不是 terse 面向的能力）。
- 完整文法契约看 `docs/terse-spec-design.md` §2–§5 与
  `packages/graphic-walker/src/interfaces.ts` 的 `TerseSpec` 类型（720 行附近）。

## 5. 验证标准（每加一个示例都要走完）

### 5a. 管线预验（写进浏览器之前先过一遍真实管线）

在 `packages/graphic-walker/tests/` 下建临时测试（**测完删除，不要提交**），模板：

```ts
jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));
import { normalize } from '../src/models/normalize';
import { chartToWorkflow } from '../src/utils/workflow';
// META：照抄本文 §2 的字段表构造 IMutField[]
test('new example', () => {
    const chart = normalize(NEW_SPEC, META);
    const payload = chartToWorkflow(chart);
    expect(Array.isArray(payload.workflow)).toBe(true);
    expect(normalize(chart, META)).toEqual(chart); // 幂等性
});
```

跑 `cd packages/graphic-walker && npx jest tests/<临时文件>`。三条断言缺一不可
（normalize 不抛错、能编译出 workflow、幂等）。

### 5b. 浏览器实测

- 本页只改 playground，**无需**重建 graphic-walker；但如果你拉了新代码或改了
  gw 源码，必须 `yarn workspace @kanaries/graphic-walker build` 并
  `rm -rf packages/playground/node_modules/.vite`（playground 消费的是构建产物）。
- 启动：`npm run dev --prefix packages/playground`（端口 3000，被占用时读 PORT 环境变量）。
- 每个新示例逐个点击 tab 确认：图表渲染出 canvas、无红色告警框、勾选
  "show expanded canonical spec" 能看到 `$schema` 与解析出的 fid。
- 控制台已知噪音（非你的问题，不要试图修）：`rowSize`/`colSize` styled-components
  警告来自 gw 内部组件；其他 example 页的 "Failed to fetch" 是它们用了外网
  r2.dev 数据源。**新增的报错**才需要处理。
- 亮/暗两个主题各截一次图确认（顶栏右侧太阳图标切换）。

### 5c. 静态检查与提交

- `cd packages/playground && npx tsc --noEmit`（`ds.stories.tsx` 的两个报错是
  既有问题——duckdb-computation 未构建——忽略）。
- `npx eslint src/examples/pages/terseSpec.stories.tsx`。
- 提交只含 `terseSpec.stories.tsx`（除非用户另有指示）。commit message 用
  `feat(playground): ...` 前缀，逐条列出新增示例教的文法点。

## 6. 边界（不要做的事）

- 不要改 `packages/graphic-walker` 的任何源码——发现 normalize/terse 层疑似 bug
  时，记录最小复现并停下来报告，不要顺手修。
- 不要改已有三个示例、页面布局、`examplePage.tsx` 外框。
- 不要引入新依赖、新数据集、新路由。
- 不要提交临时测试文件和截图。
