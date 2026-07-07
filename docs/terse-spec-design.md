# TerseSpec 设计草案(v0)

> 状态:设计评审已完成(2026-07-07),§7 开放问题已全部按"不改变既有行为"原则收敛,**可以开始第三阶段实现**。接入方式见 §6。
> 前置阅读:`docs/dsl-design-review.md`(§1.4、§3.3 修订版)。
> 核心原则:TerseSpec 是 **authoring format(为人写)**,canonical IChart 是**持久化与机器格式**。TerseSpec → `normalize()` → canonical 单向转换;canonical → TerseSpec 是可选的**有损投影**(丢弃未被图表引用的字段),持久化永远走 canonical。

## 1. 设计目标与非目标

**目标**

1. 一个懂数据的人在文档陪伴下 5 分钟内能手写出第一张图;
2. 全字段可省略:最小合法 spec 是 `{}`(得到空图表)或 `{ x: "Region", y: "sum(Sales)" }`(得到一张柱状图);
3. 渐进式:TerseSpec 与 canonical 不是两门语言,而是同一 schema 的省略程度谱系——任何 canonical 片段都可以混写在 terse spec 里做精细控制,normalize 都接得住;
4. 自包含:被引用的 computed 字段定义内联在 spec 内,离开原 workspace 依然有效;
5. LLM 友好:字段按名字引用、结构浅、与 Vega-Lite 的心智模型对齐,便于模型生成。

**非目标**

- 不替代 canonical IChart(持久化、undo/redo、store 内部一律不变);
- 不描述 dashboard/多图布局(单图表 spec);
- 不引入新的计算能力(表达式仍是 `IExpression` 的能力边界);
- v0 不支持 paint(画笔字段无法合理手写,投影时遇到 paint 字段报 warning 并跳过)。

## 2. Schema 草案

```typescript
/** 字段引用:名字或 fid;或带 per-channel 覆盖的对象形式 */
type TerseFieldRef =
    | string // 'Sales' | 'sum(Sales)' | 'fid:sales'(见 §3、§4)
    | {
          field: string; // 名字、shorthand 或 'fid:' 前缀引用
          aggregate?: IAggregator; // 与 shorthand 二选一,重复时报错
          sort?: 'ascending' | 'descending';
          timeUnit?: (typeof DATE_TIME_DRILL_LEVELS)[number];
      };

/** 过滤器:四种规则的字面语法 */
type TerseFilter =
    | { field: string; oneOf: any[] }
    | { field: string; notIn: any[] }
    | { field: string; range: [number | null, number | null] }
    /** 毫秒时间戳,与 computation.md §3 temporal range 逐字对齐;v0 不做字符串日期解析(见 §7 决议 2) */
    | { field: string; timeRange: [number | null, number | null] };

/** 内联 computed 字段定义(自包含的关键) */
interface TerseComputedField {
    name: string; // terse 内的引用名,亦作展示名
    /** 三选一的定义方式 */
    expr?: string; // SQL-like 表达式,如 'sales * 0.85'
    bin?: { field: string; count?: number }; // 等宽分箱
    log?: { field: string; base?: number }; // 对数变换
    analyticType?: 'dimension' | 'measure'; // 缺省按定义方式推断
}

interface TerseSpec {
    /** 版本戳,可选;缺省视为最新 terse 版本 */
    $schema?: string; // 'https://graphic-walker.kanaries.net/tersespec_v1.json'

    /** 图表类型,对应 config.geoms[0];缺省 'auto' */
    mark?: string;

    name?: string;

    /** 主轴:x → columns,y → rows;数组表示多字段(facet/多度量) */
    x?: TerseFieldRef | TerseFieldRef[];
    y?: TerseFieldRef | TerseFieldRef[];

    /** 视觉通道,单字段 */
    color?: TerseFieldRef;
    opacity?: TerseFieldRef;
    size?: TerseFieldRef;
    shape?: TerseFieldRef;
    text?: TerseFieldRef;
    /** 多字段通道 */
    details?: TerseFieldRef | TerseFieldRef[];
    /** 极坐标 / 地理通道 */
    theta?: TerseFieldRef;
    radius?: TerseFieldRef;
    longitude?: TerseFieldRef;
    latitude?: TerseFieldRef;
    geoId?: TerseFieldRef;

    filters?: TerseFilter[];

    /** 内联 computed 字段;只需列出本图用到的 */
    computed?: TerseComputedField[];

    /** 常用旋钮的扁平化提升(高频配置不该藏在两层深处) */
    aggregate?: boolean; // → config.defaultAggregated,缺省 true
    stack?: 'none' | 'stack' | 'normalize' | 'center'; // → layout.stack
    limit?: number; // → config.limit
    sort?: 'ascending' | 'descending'; // 应用于最后一个度量,与 Tableau 心智一致

    /** 渐进式逃生舱:任何 canonical 片段,最后浅合并(见 §5 优先级) */
    config?: Partial<IVisualConfigNew>;
    layout?: Partial<IVisualLayout>;
}
```

**JSON 示例**

最小:

```json
{ "x": "Region", "y": "sum(Sales)" }
```

典型:

```json
{
    "mark": "bar",
    "x": "Region",
    "y": ["sum(Sales)", "mean(Profit)"],
    "color": "Segment",
    "filters": [{ "field": "Year", "oneOf": [2024, 2025] }],
    "stack": "normalize",
    "limit": 20
}
```

含内联 computed 字段与精细控制:

```json
{
    "mark": "point",
    "computed": [
        { "name": "Net Sales", "expr": "sales * 0.85", "analyticType": "measure" },
        { "name": "Sales Bucket", "bin": { "field": "Sales", "count": 10 } }
    ],
    "x": "Sales Bucket",
    "y": "sum(Net Sales)",
    "size": { "field": "Profit", "aggregate": "mean" },
    "layout": { "size": { "mode": "fixed", "width": 800, "height": 600 } }
}
```

## 3. 字段引用解析(name → fid)

解析在 `normalize()` 内进行,依赖传入的 `meta: IMutField[]`,规则按序:

1. **`fid:` 前缀直引**:`'fid:sales'` 绕过名字解析直接引用 fid。用于重名兜底与程序化生成;
2. **精确名字匹配**:与 `meta[].name` 精确相等(区分大小写);
3. **内联 computed 匹配**:与 `computed[].name` 精确相等;
4. **fid 直接匹配**:与 `meta[].fid` 精确相等(容忍用户把 fid 当名字写);
5. **大小写不敏感兜底**:唯一命中时接受并产生 warning;多命中报错。

**错误报告格式**(实现约束,不是建议):找不到字段时,错误信息必须包含:输入的引用串、最相近的 3 个候选名(编辑距离)、可用字段总数。重名(两个字段同名)时:报错并要求 `fid:` 前缀,错误信息列出冲突各方的 fid。

**为什么不做模糊匹配**:LLM 与人都会写错字段名,但静默容错会把错误图表当正确结果交付;显式报错 + 候选提示的纠错回路更短。

## 4. 聚合 shorthand 文法

```
shorthand := aggName '(' fieldRef ')' | fieldRef
aggName   := 'sum' | 'count' | 'max' | 'min' | 'mean' | 'median'
           | 'variance' | 'stdev' | 'distinctCount'
```

- `'sum(Sales)'` ≡ `{ field: 'Sales', aggregate: 'sum' }`;
- `aggName` 全集与 `IAggregator` 对齐,唯 `expr` 除外(聚合表达式必须走对象形式 + 内联 computed,shorthand 里没有合理的语法位置);
- `'count()'` 无参形式映射到内置 count 字段(`gw_count_fid`);
- 字段名本身含 `(` 的用 `fid:` 前缀或对象形式绕开;shorthand 解析只在**最外层一对括号且前缀恰为合法 aggName** 时触发,否则整串按字段名处理——`'log(x)'` 不是合法 aggName,按名字解析,不会静默变成聚合。

## 5. Normalize 展开规则(terse → canonical)

按序执行,每步都是纯函数:

1. **解析引用**:全部 `TerseFieldRef` / `TerseFilter.field` / `TerseComputedField` 内的字段引用按 §3 解析成 fid;内联 computed 字段生成确定性 fid(`gw_t_` + name 的短哈希,同名同 fid,保证幂等);
2. **构建池子**:`dimensions/measures 池 = meta 全体字段(newChart 语义,含 count/mea_key/mea_val 合成字段) + 内联 computed 字段`。这正是 dsl-design-review §3.3 的重建规则——terse 不含池子,池子是推导物;
3. **通道映射**:`x → columns`、`y → rows`,其余通道同名映射;`TerseFieldRef` 展开为完整 `IViewField`(从池子取字段对象,叠加 aggregate/sort/timeUnit 覆盖);
4. **旋钮映射**:`mark → config.geoms[0]`、`aggregate → config.defaultAggregated`、`stack → layout.stack`、`limit → config.limit`、`sort → 最后一个 y 度量的 sort`;
5. **canonical 片段合并**:`config`/`layout` 字段浅合并,**优先级最高**(显式的 canonical 写法压过扁平旋钮;两处都写时产生 warning);
6. **进入既有管线**:结果作为 `PartialChart` 走 `fillChart` → `algebraLint` + `lintExtraFields` → `$schema` 戳——与 normalize 现有出口完全一致。

## 6. 与 `normalize()` 的接入方式(第三阶段)

- `detectSpecKind` 探测顺序(实现定稿,2026-07-07):① vega `$schema` → vega-lite;② tersespec `$schema` → terse;③ VL 独占键(`encoding`/`spec`/`layer`/`concat` 系)→ vega-lite;④ terse 特征键(`x`/`y`/`computed`/`filters`)存在且无 `encodings` → terse(**排在 layout 规则之前**,使 terse 的 `layout` 逃生舱不会把 spec 误路由到 chart);⑤ 裸 `mark`(无 terse 通道)→ vega-lite(维持现状);⑥ `layout` → chart;⑦ legacy config 键 → vis-spec;⑧ 其余 → partial-chart;
- `normalize()` switch 增加 `case 'terse': chart = expandTerse(input, meta)`,之后共用现有出口管线;
- 新增 `projectTerse(chart: IChart): TerseSpec` 反向投影(实现名,原设计名 `project` 因过于泛化改名):遍历 channels/filters 收集实际引用的字段(folds 经 config 逃生舱携带),computed 字段内联为 `TerseComputedField`,未引用字段全部丢弃(有损,文档明示);`dateTimeDrill` 投影为对象形式的 `timeUnit`;`paint`/`binCount`/`dateTimeFeature` computed 字段与 `regexp` 过滤器无法表达,跳过并 warning;字段名与 shorthand 文法冲突或重名时回退 `fid:` 前缀形式;非默认的 config/layout 残差经逃生舱携带以满足往返标准;
- `gen-schema` 管线新增 `tersespec_v1.json` 产物,`$schema` URL 指向它;
- 废弃 `Specification` 接口与 `renderSpec()`(标 `@deprecated`,下个 major 删除)。

## 7. 开放问题决议(2026-07-07 评审收敛)

> 决议原则(压倒一切):**本迭代不改变任何既有运行时行为;terse 的新语法只允许映射到既有语义,凡需要新语义的特性一律砍出 v0**。理由:本次迭代体量已经很大;且外部系统(如 gw-dsl-parser 及其下游)依赖当前行为,尤其时区语义历史上有过坑,任何"顺手改进"都可能破坏跨层兼容。

1. **`sort` 的作用目标 → 维持 v0 定义,不扩展**。扁平旋钮 `sort` 是"最后一个 y 度量"的纯语法糖,对象形式的 per-field `sort` 直接映射到既有 `IViewField.sort`——两者都不引入新语义。多度量 + facet 的 per-field 扁平语法不做。
2. **`timeRange` 字符串日期 → 砍出 v0,只接受毫秒时间戳**。计算层规范与 conformance 套件规定 temporal range 只收毫秒;ISO 字符串解析必须选定新的时区语义,属于新行为,且直接踩在 gw-dsl-parser 历史坑位上。v0 与 computation.md §3 逐字对齐;字符串日期支持若未来要做,须与 parser 层时区语义一起评审(横跨两层 DSL 的联合决策),并先在 conformance 套件加用例。
3. **内联 computed 的 fid 生成 → name 短哈希(`gw_t_` 前缀)+ 单图冲突检测**。此机制只存在于 terse 展开这一新领地,不触碰既有行为(canonical 图表的 fid 永远显式携带,UI 内建字段仍走 `gw_` + nanoid)。同名同 fid 保证幂等;单图内同名不同表达式报错;跨图冲突理论存在但与现状(nanoid 随机)相比不劣化。表达式哈希方案(fid 随表达式变化)因破坏重命名稳定性被否。
4. **投影往返标准 → 采纳 canonical 层等价**:`normalize(project(normalize(t))) ≡ normalize(t)`。这是测试标准而非运行时行为,不涉及兼容风险;shorthand 的多种等价写法不可能也不需要逐字往返。
5. **mark 数组 / layer → 明确不做**。GW 的 `geoms` 是单值语义,layer 是全新的渲染能力而非语法问题,不在 DSL 层解决。terse 的 `mark` 保持单值;layered Vega-Lite spec 由 `detectSpecKind` 显式路由到 VL 路径并在能力边界处报错(不静默吞掉)。

## 8. 与现有机制的关系速查

| 现有物 | TerseSpec 落地后 |
|---|---|
| `Specification` + `renderSpec()` | 标 `@deprecated`,功能被 TerseSpec 全量覆盖 |
| `spec` prop(root.tsx) | 下个 major 换为接受 TerseSpec |
| `vlSpec` prop | 保留(vega-lite 路径已在 normalize 内) |
| `chart` prop / `importCode` | 完全不变(canonical 层) |
| `exportCode()` | 完全不变;新增可选的 `exportTerse()` 投影 |
