# Vega-Lite-like import compatibility

The canonical saved format remains `IChart`. `normalize()` and the existing `vlSpec` component prop use the same `VegaliteMapper` preflight. Conversion does not run a Vega-Lite compiler or execute expressions. An unsupported property throws `VegaLiteImportError` with `code: 'unsupported-vega-lite'` and property-level `diagnostics`. Component imports report that error through `onError` and retain the current chart and history. The input object is not modified.

These import rules are narrower than the worksheet library's static `RenderPlan` configuration. In particular, the library supports axis title/grid/tickCount/hidden, channel constants, and more scale options. Those settings do not all have a persistent position in the current `IChart` schema. Importing one of them produces a diagnostic; it does not create a second stored specification or silently drop the property.

## Persistent conversion list

| Input | Canonical result |
| --- | --- |
| Supported single `mark`, or `mark.type` | `config.geoms`; bar, point, circle, line, area, rect, text, tick, arc and boxplot retain their existing geometry names. Existing interval→bar and heatmap→circle aliases remain. Native renderer capability checks still apply after import. |
| `mark.color`, `background` | `layout.primaryColor`, `layout.background` |
| String chart `title`; numeric positive `width` and `height` together | Chart name; fixed `layout.size` |
| `x/y`, row/column facets, color/opacity/shape/size/text/theta/radius, detail/details | Existing field channels. Names must resolve unambiguously; fids are accepted. Detail arrays preserve their fields. Repeated facet/position instances on an axis are retained. |
| `type` | The field's quantitative/temporal/ordinal/nominal semantic type |
| Existing aggregate names on value channels | Field `aggName` and `config.defaultAggregated`; computation remains in GW |
| Default `bin: true` | Existing computed bin field, evaluated by GW; explicit bin parameters are rejected rather than ignored |
| Explicit `sort` and `order` | Rejected with a path diagnostic; Vega-Lite member/domain order is not GW's measure-driven sort |
| `stack: zero/true/normalize/center/null` | Existing global `layout.stack`; contradictory axis stacks are rejected |
| Numeric scale `type: linear/log/pow/sqrt/symlog`, two-number domain/range | Existing `layout.scale` type and endpoint fields |
| Position scale `zero` | Existing global `zeroScale`, only when numeric position axes do not require conflicting values |
| Numeric/temporal `axis.format`; `config.numberFormat/timeFormat` | Existing global `layout.format`; different formats of the same value type are rejected because they cannot be stored independently |
| `resolve.scale` shared/independent | Existing `layout.resolve`; renderer capability diagnostics still apply to unsupported non-position resolution |
| Row/column `facet` plus one nested mark/encoding `spec` | Existing rows/columns lists |
| `transform.filter` field predicates: equal, oneOf, range, gte, lte | Existing GW filters with conjunction; null and JSON-object-like membership values are rejected because the existing filter key encoding can collide |
| Literal `datum.field` or `datum['field']` comparisons with `===`, `!==`, `>=`, `<=`, joined by `&&` | Existing filters; a bounded parser consumes the complete string without evaluation |
| One `transform.fold` of existing measure fields, optionally with two output aliases | Existing `config.folds` plus measure-name/value virtual fields. Filters after fold are rejected because GW currently applies its filters before fold. |

A format imported from `axis.format` uses GW's existing **global format for that value type**. This is the documented limited import convention, not a claim of arbitrary per-axis Vega-Lite formatting equivalence.

## Explicitly rejected inputs

Unsupported transforms, calculated expressions, window/aggregate transforms, params/selection, layer/repeat/concat, external/inline data declarations, unknown channels and properties, conditional encodings, channel constants, axis title/grid/tickCount/hidden/labelExpr, explicit timeUnit, custom bin parameters, signal/expr/domainRaw scales, arbitrary categorical domains, nice/reverse and other unmapped scale properties receive property-level diagnostics. Strict `<`/`>` filters and OR expressions are rejected because the existing inclusive range and conjunctive filter representation cannot preserve their meaning.

Valid canonical `IChart` fields, including `aggName`, SQL computed fields, filters and existing TerseSpec transformations, bypass this VL-like preflight. They continue through their established GW preparation path.

Fixed conversion and rejection cases are in `packages/graphic-walker/src/models/vlImport.test.ts`. Canonical history/provider retention and old-renderer capability cases are in `nativeCanonical.test.ts` and `lib/native/legacyCapabilities.test.ts`. These tests establish input conversion boundaries; they do not replace browser acceptance of the production renderer.

Vega-Lite strings `ascending`/`descending` order the encoded field itself; they are not aliases for GW's opposite-measure sort. The importer therefore rejects explicit sort rather than changing its meaning. See the [Vega-Lite sorting reference](https://vega.github.io/vega-lite/docs/sort.html). IChart/Terse inputs retain their existing GW sort semantics.

Fold conversion requires both virtual outputs in the roles used by the existing GW workflow: a key dimension and a value measure. Inputs that leave either output unbound or change that role are rejected before the chart is replaced; the importer does not silently discard a row-multiplying fold.

Loose `==`/`!=` expressions are rejected because converting coercing equality to typed membership changes results. This boundary leaves the existing GW computation engine unchanged. Null and strings that encode JSON objects/arrays are also rejected in equality and membership predicates, since the existing filter key encoding does not distinguish those values.

Encoding original folded source columns alongside virtual outputs is rejected as well, because the legacy GW fold projection removes those original columns. Native result preparation retains raw provenance, but that does not make this input portable across existing renderers.

Bins on virtual fold outputs are rejected: the existing workflow prepares computed bins before fold outputs exist. Ordinary bins on prepared dataset fields retain their existing conversion.

Every encoded fold-key occurrence must remain a dimension, every fold-value occurrence a measure, and aggregated value occurrences must use the same aggregation. The existing workflow prepares one fold-value result column; mixed roles or aggregations are rejected instead of creating missing columns.
