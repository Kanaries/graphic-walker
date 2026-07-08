# Graphic Walker Two-Layer DSL Design Review and Refactoring Direction (Archived)

> Archived: 2026-07-06
> Sources: a systematic survey of the codebase (UI-layer spec types and the Vega-Lite compilation pipeline / the compute-layer Workflow and expression system / import-export and version migration mechanisms), plus the subsequent discussion of state coupling and a progressive DSL.
> Status: discussion converged, engineering implementation in progress.
>
> **Revision 2026-07-07**: Phase one (the Workflow conformance suite) is complete and accepted (branch `feat/workflow-conformance`). Decisions A/B in §3.3 and the §4 action list are revised under the constraint of "persisted-specification compatibility first" — this is an open-source project with no real user data to scan, and enterprise users rely on the specs the system imports/exports for chart persistence and dashboard building. Therefore the canonical/persistence layer is frozen for this iteration (zero changes to existing fields, purely additive at most), and all changes converge onto the newly added terse layer.

---

## 0. Overview: the compiler perspective

The two private DSLs inside Graphic Walker (the UI-layer chart spec and the compute-layer Workflow) together actually form the shape of a compiler:

```
(the missing surface syntax / authoring format)
        │
        ▼
IChart —— canonical AST (the sole internal circulating form)
        │
        ├──► Workflow (data-query IR) ──► JS executor (Web Worker)
        │                              └► gw-dsl-parser ──► SQL (DuckDB / remote database)
        │
        └──► Vega-Lite spec (render IR) ──► vega-lite / observable-plot
             (maps go through leaflet, tables go through PivotTable, bypassing the render IR)
```

**Overall conclusion: the existing system has a fairly good IR layer and codegen layer, but is missing two things:**

1. **a human-writable surface syntax** (i.e., the "progressive DSL" / TerseSpec);
2. **a contract whose "semantics are defined by a specification rather than by the implementation"** (especially in the compute layer, where the JS executor and the SQL translator are two independent implementations with no arbiter).

The structural decisions of both DSL layers are basically correct; the problems are concentrated on the **degree of normalization**.

---

## 1. UI-layer DSL (IChart) review

### 1.1 Current core structure

`IChart` (`packages/graphic-walker/src/interfaces.ts:695`):

```typescript
export interface IChart {
    visId: string;
    name?: string;
    encodings: DraggableFieldState;   // 16 encoding channels + dimensions/measures pools
    config: IVisualConfigNew;         // semantic config: 5–6 fields
    layout: IVisualLayout;            // render/theme config: ~28 fields
}
```

- `DraggableFieldState` (`interfaces.ts:283`): 16 channels — `dimensions` / `measures` (field pools), `rows` / `columns`, `color` / `opacity` / `size` / `shape` / `theta` / `radius`, `longitude` / `latitude` / `geoId`, `details` / `filters` / `text`. Of these, rows/columns/details have no count limit (`CHANNEL_LIMIT` is `Infinity`).
- `IVisualConfigNew` (`interfaces.ts:449`): `defaultAggregated` / `geoms` / `coordSystem` / `limit` / `folds` / `timezoneDisplayOffset`.
- `IVisualLayout` (`interfaces.ts:409`): formatting, scale, resolve, size, geo data (geojson/geoUrl/geoMapTileUrl), stack, renderer selection, etc. — ~28 keys.
- Field-level `IViewField extends IField`: `fid` / `name` / `aggName` / `semanticType` / `analyticType` / `sort` / `timeUnit` / `computed` / `expression` / `offset` / `basename` / `path` / `geoRole` / `cmp` / `aggergated` (the last two are dead fields, see 1.3).
- The overall configuration surface: config + layout has ~33 top-level options, plus 16 channels and field-level options.

### 1.2 Verifying the four original design intents one by one — all are realized in the code

| Intent | Conclusion | Code evidence |
|---|---|---|
| **Feature extension** (scenarios Vega-Lite doesn't natively support) | **Holds; this is the hardest value of this abstraction layer** | Maps bypass Vega-Lite entirely: the POI / choropleth paths in `components/leafletRenderer/index.tsx`, triggered by `coordSystem === 'geographic'`. Facet × Repeat: in `lib/vega.ts`, `rowRepeatFields × colRepeatFields` generates an array of M×N Vega-Lite specs that are then stitched together — Vega-Lite's native repeat can't express this |
| **Analysis-oriented** (high-dimensional configuration of many Dimensions/Measures in one chart) | **Holds** | The rows/columns channels have no count limit; the shelf algebra of "multiple dimensions + multiple measures placed on one axis" is closer to Tableau-style analytical interaction than Vega-Lite |
| **Compatibility and fallback** (over-limit fallback, non-graphical forms like tables) | **Holds** | `renderer/specRenderer.tsx:66`: `geoms[0] === 'table'` goes through PivotTable, entirely bypassing Vega |
| **Architectural decoupling** (swappable underlying charting library) | **Partially holds** | `layout.renderer: 'vega-lite' \| 'observable-plot'` has proven feasibility; but the decoupling is not clean — `resolve`, `interactiveScale`, `useSvg`, `showActions` are Vega concepts leaking directly into the spec layer; `encodeFid()` (`vis/spec/encode.ts:66`) is a Vega escaping requirement leaking into the spec layer. If you plugged in something like ECharts, these fields would be either meaningless or need reinterpretation |

**This abstraction layer is worth keeping**, and the reasoning is simple: the three render paths (Vega-Lite / Leaflet / table) share one spec; delete this layer and use Vega-Lite directly, and maps and tables have nowhere to go.

### 1.3 Diagnosis: the real source of redundancy is three structural problems

**① Field objects are copied by value rather than by reference (the single biggest source of the poor hand-authoring experience).**
A field is stored once as a full `IViewField` in the `encodings.dimensions` pool, and when dragged into `rows` a full copy of the object is stored again. When hand-writing, the same field's `fid/name/semanticType/analyticType/aggName` must be written multiple times, and the two copies may disagree. Vega-Lite is by-name reference.

**② Dead fields and parallel representations.**

| Field | Problem |
|---|---|
| `IField.cmp` | Not used by any code |
| `IField.aggergated` | Typo, and never read or written |
| `IField.computed` | Fully redundant with `expression !== undefined` |
| `IField.timeUnit` | The same thing as `expression`'s dateTimeDrill, expressed two parallel ways |
| `showTableSummary` | The old `IVisualConfig` and new `IVisualLayout` each have a copy |

**③ Forced completeness.**
All 16 encoding channels must exist (even as `[]`); `PureRenderer` has zero tolerance for partial input; nested objects (`size` / `format` / `resolve`) are not recursively merged.

**The root cause of hand-writing difficulty is the fid mechanism:**

- everything in the spec is referenced by `fid` rather than `name`; the user must know the schema first;
- synthetic fields (`gw_count_fid`, `gw_mea_key_fid` / `gw_mea_val_fid`, `gw_paint_fid`, see `constants.ts:1-20`) are auto-injected by `newChart()`, which the user neither knows about nor controls;
- special characters need `encodeFid()` escaping — which was originally a Vega implementation detail, leaking through yet another layer;
- no version stamp: there is no version field in the spec at all; old vs. new format is duck-typed by `'layout' in x` (`parseChart()`, `models/visSpecHistory.ts:721`), which will get out of control at the next structural change.

### 1.4 Progressive DSL review: strongly in favor, and cheaper than expected

Key finding: **about 70% of the normalize pipeline's parts already exist**, just scattered around with no unified entry point:

| Existing mechanism | Location | Role |
|---|---|---|
| `fillChart()` | `models/visSpecHistory.ts:608` | partial IChart → full IChart (with default merging; size has nested merging) |
| `visSpecDecoder()` / `forwardVisualConfigs()` | `utils/save.ts:124 / 134` | fills in sparse encodings / config |
| `parseChart()` + `convertChart()` | `models/visSpecHistory.ts:721 / 666` | v1 IVisSpec → v2 IChart automatic migration |
| `VegaliteMapper()` | `lib/vl2gw.ts` | Vega-Lite spec → IChart |
| `renderSpec()` + `Specification` | `store/visualSpecStore.ts:866`, `interfaces.ts:26` | an embryonic minimal spec (but too weak: half the fields unused, still requires fid, whole-replace rather than merge; recommend deprecating and replacing) |
| `algebraLint()` | inside the store | geom↔channel legality validation, usable directly as normalize's validation pass |
| Default-value pools | `emptyEncodings` / `emptyVisualConfig` / `emptyVisualLayout` (save.ts), `GEOM_TYPES` / `CHANNEL_LIMIT` (config.ts) | the source of defaults for normalize |

This is isomorphic to Vega-Lite's internal normalize mechanism (shorthand / unit spec → normalized spec, after which the compile passes only handle the normalized form; source directory `normalize/`).

**Landing path (three steps):**

**Step 1: establish the canonical-form contract (lowest cost, highest return).**
Declare that "the full IChart is the sole internal circulating form; every entry point normalizes at the boundary," and provide a single entry:

```typescript
normalize(input: TerseSpec | PartialChart | IVisSpec | VLSpec, meta: IMutField[]): IChart
```

Internally dispatch to the existing functions in the table above, plus add a `$schema` version stamp.

**Step 2: design TerseSpec, with two key decisions:**

- **by-name reference + shorthand.** Name→fid resolution is done at normalize time by looking up `IMutField[]`. Example:

```jsonc
{
  "mark": "bar",
  "x": "Region",              // name or fid both accepted
  "y": "sum(Sales)",          // agg shorthand, expanded at normalize time
  "color": "Category",
  "filters": [{ "field": "Year", "oneOf": [2024, 2025] }]
}
```

- **Don't eliminate redundancy in the canonical layer; eliminate it in the terse layer.** Problems like field-by-value copying and the forced presence of 16 channels — changing the canonical structure is a bone-deep breaking change; but the terse layer uses references + normalize-time expansion, so the user never faces the redundancy. Canonical is optimized for machines, terse for humans.

**Step 3 (optional, at a major version):** clean up the `cmp` / `aggergated` / `computed` dead fields and redundant markers, and converge `timeUnit` into `expression`.

---

## 2. Compute-layer Workflow review

### 2.1 Current core structure

Workflow types (`interfaces.ts:616-644`):

```typescript
type IDataQueryWorkflowStep = IFilterWorkflowStep | ITransformWorkflowStep | IViewWorkflowStep | ISortWorkflowStep;
// inside the view step: IAggQuery | IFoldQuery | IBinQuery | IRawQuery
// aggregation operators: sum | count | max | min | mean | median | variance | stdev | distinctCount | expr
```

The expression system (`interfaces.ts:136-183`): `IExpression`, with ops including `bin / binCount / log / log2 / log10 / one / dateTimeDrill / dateTimeFeature / paint / expr`; the parameter `IExpParameter` supports `type: 'expression'` for recursive nesting; `toWorkflow()` uses `walkExpression()` for dependency extraction + tree-shake ordering.

The pipeline generated by `toWorkflow()` (`utils/workflow.ts:127-370`):

```
[filter raw rows] → [transform computed fields] → [filter computed fields] → [view: aggregate|raw] → [filter after aggregation] → [sort]
```

The backend contract (`interfaces.ts:480`):

```typescript
type IComputationFunction = (payload: IDataQueryPayload) => Promise<IRow[]>;
```

Three verified backends: the client-side JS executor (`computation/clientComputation.ts` + `lib/op/*`, parallelized via Web Worker), duckdb-wasm (`packages/duckdb-wasm-computation`, converted to SQL via `@kanaries/gw-dsl-parser`), and remote SQL services.

### 2.2 Overall verdict: the skeleton is correct

This design is essentially **a restricted subset of relational algebra, specialized for chart-rendering needs**. The positioning is reasonable: decidable, translatable into a single SQL statement, and covering ~95% of BI charting needs. Far better than the alternative of "generating SQL directly from chart state."

Specific things done well:

- **three-stage filtering** (raw rows → computed fields → after aggregation) has clear semantics;
- **expression tree + tree-shake dependency ordering** supports composition (e.g., `log(bin(x))`);
- **dual-timezone model**: `offset` (data timezone) + `displayOffset` (display timezone);
- **fold/unfold round-trip semantics are complete** (the `MEA_KEY_ID` / `MEA_VAL_ID` convention);
- **backend-agnostic**: the `IComputationFunction` contract is minimal and pluggable.

### 2.3 The biggest risk: semantics are defined separately by two implementations, with no arbiter

**This is the single biggest problem of the whole Workflow, exceeding any expressiveness shortfall.** The JS executor and gw-dsl-parser (an external Rust/WASM package) are two independent implementations, while `computation.md` is only descriptive documentation, not a specification. Known points of divergence:

- null is treated as falsy in filters (range predicates simply fail) but is counted in aggregation (count / distinctCount); there is no IS NULL-style predicate;
- the `regexp` filter rule may not be supported on the SQL side;
- transform-level `bin` (which produces a `[min, max]` tuple) and view-level `IBinQuery` produce inconsistent output structures;
- `temporal range` only accepts millisecond timestamps, not ISO-8601 strings.

For a system where "the existing SQL conversion mechanism is in production use," the same workflow producing different results in client-side preview versus server-side execution is the most insidious class of bug.

### 2.4 The expressiveness ceiling: there's a structural way out, the builder just doesn't use it

Current gaps: window functions (rank / lag / running sum), multi-level aggregation (sum of avg), transforms referencing aggregation results. These make it a "chart-query DSL" rather than a general-purpose compute DSL — that positioning itself is acceptable, but it should be made explicit.

Worth noting: **`IDataQueryWorkflowStep[]` is itself an array, the client executor is a sequential fold, and cascading multiple view steps is already supported at both the data-structure and executor level** — `toWorkflow()` just never generates a second view step. When building year-over-year / period-over-period / percent-of-total in the future, the extension point is already there: formally acknowledge cascaded multiple view steps + add window-type view query ops, with no need to overturn the pipeline design.

### 2.5 Other design debt (ordered by severity)

1. **The `expr` raw-SQL escape hatch breaks backend-agnosticism**: `replaceFid()` (workflow.ts:379) does plain-text substitution (with an injection surface), and the client additionally has its own SQL evaluator (`lib/sql.ts`) — meaning there are two dialect implementations. Recommendation: pin down an explicit expression-subset grammar and share the parser; or explicitly mark `expr` as a backend capability, so unsupported backends error out rather than silently diverge.
2. **Implicit conventions lack type guarantees**: the `MEA_KEY_ID` magic string triggers fold reassembly (workflow.ts:138-149); post-aggregation filter/sort depend on the `asFieldKey` naming convention like `sum_Sales`; sort is only generated when `limit && limit !== -1` (workflow.ts:277). These are couplings between builder and executor; changing either side may silently break the other.
3. **No validation pass**: a cyclic dependency among computed fields makes tree-shake loop forever (no DAG cycle detection); a nonexistent field is only exposed at runtime (no schema validation).
4. **limit is not pushed down**: it only slices at the tail of the pipeline (clientComputation.ts:47), affecting only the client executor (the SQL side has the database optimizer); when a large dataset goes through the client, all intermediate results are fully materialized.
5. **The paint operation**: only supports 2D spatial hashing, is asynchronous and expensive, and is tightly coupled to a specific hashing algorithm.
6. **Timezone logic has no single source of truth**: `displayOffset` is only injected into `dateTimeDrill` / `dateTimeFeature`; the temporal range filter does its own offset handling separately (lib/filter.ts:25).

### 2.6 Interplay with the UI layer: architectural positioning

**The writability investment should be placed entirely on the UI layer's TerseSpec; the Workflow should remain a pure compile target (IR) and not aim to be human-writable.** The user expresses "what chart / what analysis I want," and the workflow is derived from the canonical IChart; the scenario of hand-writing a workflow directly should not exist. From this, the division of labor between the two DSL layers is fully clear:

```
surface (terse, for humans) → canonical (IChart, for state management) → IR (workflow + vega spec, for machines) → backend
```

---

## 3. Verifying export/import state and the "field-pool coupling" problem

### 3.1 Verification conclusion: exports exist at two granularities, and together they form duplicate storage

**① App-level export**: `DataStore.exportData()` (`store/dataStore.ts:69`) returns `IStoInfoV2` (`interfaces.ts:1176`):

```typescript
interface IStoInfoV2 {
    $schema: 'https://graphic-walker.kanaries.net/stoinfo_v2.json',
    metaDict: Record<string, IMutField[]>;    // dataset meta, keyed by metaId
    datasets: Required<IDataSource>[];         // raw data sources
    specDict: Record<string, string[]>;        // charts under each metaId (serialized strings including undo history)
}
```

**② Chart-level export**: `visualSpecStore.exportCode()` returns `IChart[]`, and each IChart's `encodings` carries the full `dimensions` / `measures` pools.

**Conclusion: IChart is not a clean substate of application state, but a hybrid of "chart state + field-list snapshot."** The app-level `IStoInfoV2` has actually already pulled meta out separately (`metaDict`), yet inside IChart the meta is copied again — the same field information exists in two places in the export file.

The left-hand Field List does read the current chart's pools directly (`store/visualSpecStore.ts:153`: `get dimensions() { return this.currentEncodings.dimensions }`); delete the pools and the left panel goes empty.

### 3.2 Decisive evidence: the system itself admits the pool is decomposable

The old-format migration code (`store/dataStore.ts:58`): old exports had no metaDict, so on import the system must guess which dataset each chart belongs to, and the method it uses is to hash **the non-computed fields** in the pool as a dataset fingerprint:

```typescript
encodeMeta(x.encodings.dimensions.concat(x.encodings.measures).filter((x) => !x.computed))
```

This line is the system itself admitting the identity:

> **A chart's dimensions/measures pool = dataset meta (the non-computed part) + per-chart transformation delta (computed fields, drill fields, etc.)**

Since the pool can be decomposed this way, it is derivable and should not be stored twice as first-class data.

### 3.3 Decoupling plan (revised 2026-07-07: converged under the "persistence-format freeze" constraint)

> Revision background: this is an open-source project with no real user data to scan; enterprise users rely on the specs the system imports/exports (`exportCode()`'s `IChart[]` and the app-level `IStoInfoV2`) for chart persistence and dashboard building. Therefore a hard constraint is established: **the canonical/persistence layer is frozen for this iteration — zero changes to existing fields, purely additive at most (e.g., an optional `$schema`); all decoupling converges onto the newly added terse layer.**

**Decision A (revised): the pool is kept as-is in the canonical/persistence layer; decoupling happens only in the terse layer.**

- the terse spec does not contain the dimensions/measures pool; at normalize time the pool is rebuilt from dataset meta + the spec's inlined computed-field definitions for the system to use;
- exporting terse is a **newly added projection capability**: walk channels, filters, and folds to collect the fids actually referenced, and serialize only those fields' definitions; the existing `exportCode()` is left untouched;
- **terse is a lossy projection; persistence always goes through canonical**: computed fields not used by the chart are dropped in the terse projection (intended design, to be documented explicitly); the canonical round-trip stays lossless.

**Decision B (revised): defer.** Computed fields keep the status quo per-chart ownership; dataset-level virtual fields (the Tableau calculated-field model) are left for a future major version. Rationale: once canonical is frozen there is no way to land an ownership migration, and there is no user data to support a frequency judgment on "per-chart analyticType/name divergence." The terse layer solves the human-writing experience via "definitions inlined at the point of use," with no need to touch the ownership model.

The original three-tier ownership model is still the long-term direction, but this iteration only lands the rebuild/projection rules on the terse side:

```
terse → canonical: pool = dataset meta + the spec's inlined computed-field definitions (rebuild)
canonical → terse: only carry fields referenced by channels/filters/folds (projection, lossy)
```

**Key detail — inlining guarantees self-containment**: if the terse spec stores only references and not definitions, it stops working once it leaves the original workspace. As long as **the referenced** virtual-field definitions are inlined into the spec (similar to Vega-Lite's transform array), the spec is self-contained and pasteable across environments, while unused fields don't leak in. You get both.

**Three directions for compatibility (turning "best effort" into an executable guarantee)**:

1. Old spec into the new system: the existing `parseChart` / `forwardVisualConfigs` migration chain stays untouched; `normalize()` just wraps them into a unified entry;
2. New export into an old system (forward compatibility): canonical only adds incrementally; `IStoInfoV2` already has a `$schema` field, but adding an optional `$schema` onto a bare `IChart[]` requires empirically verifying old readers' (mostly object-spread) tolerance of unknown fields — do not assume it;
3. Compatibility fixture suite: collect old-version export JSON as golden fixtures and assert that "import → normalize → downstream pipeline output" is unchanged, turning the compatibility promise into a hard CI constraint.

### 3.4 Terminology: the canonical layer and the terse layer

- **Canonical form**, a standard term: when multiple spellings express the same meaning, pick a single standard representative from each equivalence class. Canonical IChart = the sole complete form circulating inside the system — all options filled with defaults, all references resolved to fid, all 16 channels present, field objects fully expanded. **Redundancy is allowed, because it serves machines.** The accompanying discipline: internal code only handles the canonical form, and all external input passes through `normalize()` at the boundary.
- **Terse (the condensed form)**, i.e., the authoring format: optimized for human hand-writing — reference by name, shorthand available, everything omittable can be omitted. Multiple terse spellings map to the same canonical form, and the direction is one-way: terse → normalize → canonical.
- Ready analogies: CSS's `margin: 4px 8px` (authoring shorthand) → four longhand properties (the computed style is the canonical); Vega-Lite's `"y": "mean(price)"` → normalize expands it into a full field def, and the compile passes after the `normalize/` source directory only see the normalized spec.
- The precise meaning of **progressive**: terse and canonical are not two languages but **a spectrum of omission degrees over the same schema**. The user can write just `{x: "Region", y: "sum(Sales)"}`, or layer on any canonical field for fine control, and normalize catches it all — there is no cliff between "easy mode / expert mode."
- Its relationship to 3.3, in one sentence: **the dimensions/measures pool belongs to the canonical form (machines need it, rebuilt at normalize time), not to the authoring form (humans shouldn't write it, projected away at export).** The two problems are two sides of the same design.

---

## 4. Action recommendations (revised 2026-07-07)

Revision note: item 1 is complete; the original item 3 "field-ownership model decision" is dissolved by the persistence-freeze constraint (see §3.3 revision), and its content is demoted to the rebuild/projection rules within item 3's TerseSpec design; item 2's scope is broadened to include the compatibility fixture suite and a TerseSpec schema draft.

1. **Workflow conformance test suite + semantic normalization. —— ✅ Complete (accepted 2026-07-07)**
   Branch `feat/workflow-conformance` (commit 933d8d9 + rework 893db12). `computation.md` has been upgraded to a specification; the `packages/computation-conformance` dual-backend consistency suite is 49 passed / 2 skipped; 12 divergences are recorded in `docs/computation-divergences.md`. Outstanding: the paint and expr dialect contracts are not covered (flagged in spec §8); DVG-009 (population variance) and DVG-010 (null ordering) are two decisions deferred for review at a version checkpoint; on the gw-dsl-parser side, 9 `test.failing` divergences await a fix in the parser repo.

2. **Unified `normalize()` entry + `$schema` version stamp + compatibility fixture suite. —— ✅ Complete (2026-07-07, commits 3849b16 + 58b70c4, single-subagent re-review passed)**
   Establishes the canonical-form contract: a single entry accepting `TerseSpec | PartialChart | IVisSpec | VLSpec`, internally dispatching to the existing parts (`fillChart` / `parseChart` / `VegaliteMapper`, etc. — ~70% already exist), and outputting a full IChart. **Purely additive: the existing import/export paths are byte-for-byte unchanged.** `$schema` reuses the existing `gen-schema` pipeline (`scripts/create-json-schema.js` already generates `public/chartinfo.json` / `stoinfo_v2.json` from types); before adding an optional `$schema` onto `IChart`, old readers' tolerance must be empirically tested. In parallel, build the compatibility fixture suite (golden old-version spec → import → assert downstream output unchanged). A TerseSpec schema design doc is drafted alongside this phase (the normalize entry signature depends on it); the implementation is deferred to the next phase.

3. **TerseSpec implementation (the core deliverable of the progressive DSL). —— ✅ Complete (2026-07-08, commits d80afb2→a046d70, single-subagent three-round re-review, final PASS with no open findings)**
   by-name reference + agg shorthand (`sum(Sales)`) + all fields omittable; does not contain the dimensions/measures pool (rebuilt at normalize time from dataset meta + inlined definitions; on projection export, collected by the actual references in channels/filters/folds); referenced computed-field definitions are inlined into the spec to guarantee self-containment (including recursive dependency chains); it is made explicit that terse is a lossy projection and persistence goes through canonical; output passes `algebraLint` validation before emission. The existing `Specification` interface (`interfaces.ts:26`) is deprecated with no compatibility. The finalized design and residual boundaries are in docs/terse-spec-design.md.

4. **Workflow validate pass. —— ✅ Complete (2026-07-08, `src/utils/workflowValidate.ts`)**
   Field-existence validation (the decision domain = pool ∪ dataset meta, run only when meta is provided — existence can only be judged relative to the dataset, and a computed expression referencing raw data columns outside the pool is legal) + DAG cycle detection over computed-field dependencies + duplicate-fid detection; `normalize()`, as the strict entry, always runs the intrinsic structural checks. **Fact correction**: `treeShake` does not loop forever on a cycle (a strictly-shrinking work queue necessarily terminates); the actual harm is that it produces an unsatisfiable transform order that silently computes wrong data — the validator's value is catching this class of silent corruption before execution, and a characterization test now pins this behavior.

5. **(At a major version) Canonical-layer cleanup and deep-water decisions.**
   Remove `IField.cmp`, `aggergated` (a misspelled dead field), `computed` (redundant with `expression`); converge `timeUnit` into `expression`; deduplicate `showTableSummary`; pin down the backend-capability boundary of `expr`; revisit DVG-009/010; and, at that point, reconsider dataset-level virtual-field ownership (§3.3 Decision B).

---

## Appendix: key code index

| Topic | Location |
|---|---|
| Core types (IChart / DraggableFieldState / IVisualConfigNew / IVisualLayout / IField) | `packages/graphic-walker/src/interfaces.ts:48-470, 695-709` |
| Workflow / expression types | `packages/graphic-walker/src/interfaces.ts:136-183, 616-644` |
| App-level export format (IStoInfoOld / IStoInfoV2) | `packages/graphic-walker/src/interfaces.ts:1167-1183` |
| Synthetic-field constants (gw_count_fid, etc.) | `packages/graphic-walker/src/constants.ts:1-20` |
| Vega-Lite compilation (repeat stitching) | `packages/graphic-walker/src/lib/vega.ts` |
| Single-view compilation / fid escaping | `packages/graphic-walker/src/vis/spec/view.ts` / `encode.ts:66` |
| Workflow building (toWorkflow / processExpression / replaceFid) | `packages/graphic-walker/src/utils/workflow.ts:127-451` |
| Client executor | `packages/graphic-walker/src/computation/clientComputation.ts`, `lib/op/*`, `workers/*` |
| SQL backend integration (gw-dsl-parser) | `packages/duckdb-wasm-computation/src/index.ts:129-155` |
| Migration/normalize parts (fillChart / parseChart / convertChart / visSpecDecoder) | `packages/graphic-walker/src/models/visSpecHistory.ts:572-723`, `utils/save.ts:69-142` |
| Vega-Lite → IChart | `packages/graphic-walker/src/lib/vl2gw.ts` |
| Old Specification interface / renderSpec | `packages/graphic-walker/src/interfaces.ts:26-38`, `store/visualSpecStore.ts:866` |
| DataStore (metaDict / visDict / encodeMeta fingerprint) | `packages/graphic-walker/src/store/dataStore.ts` |
| Map rendering (bypassing Vega) | `packages/graphic-walker/src/components/leafletRenderer/index.tsx` |
| Table mode | `packages/graphic-walker/src/renderer/specRenderer.tsx:66` |
