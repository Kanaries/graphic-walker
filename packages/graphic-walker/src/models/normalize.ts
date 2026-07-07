import { DraggableFieldState, IChart, IChartSchemaUrl, IMutField, IVisSpec, PartialChart } from '../interfaces';
import { fillChart, lintExtraFields, newChart, parseChart } from './visSpecHistory';
import { uniqueId } from './utils';
import { VegaliteMapper } from '../lib/vl2gw';
import { algebraLint } from '../lib/gog';

/**
 * The kind of spec accepted by {@link normalize}:
 * - `chart`: a (possibly partial) modern spec that already has a `layout` key. Routed through
 *   `parseChart` passthrough, then completed with defaults.
 * - `vis-spec`: the deprecated `IVisSpec` format (single `config` object carrying layout-ish
 *   fields). Routed through the `forwardVisualConfigs` → `visSpecDecoder` → `convertChart`
 *   migration chain inside `parseChart`.
 * - `vega-lite`: a Vega-Lite-like spec. Routed through `VegaliteMapper`; requires `meta` to
 *   resolve field names, otherwise unresolved fields fall back to the count field.
 * - `partial-chart`: everything else — treated as `PartialChart` and completed with defaults.
 */
export type ISpecKind = 'chart' | 'vis-spec' | 'vega-lite' | 'partial-chart';

// Structural keys that exist on Vega-Lite specs but never on IChart / IVisSpec / PartialChart.
// `layer` is detected so layered specs fail loudly in VegaliteMapper territory instead of
// silently normalizing into an empty default chart via the partial-chart path.
const VEGA_LITE_KEYS = ['mark', 'encoding', 'spec', 'layer', 'concat', 'hconcat', 'vconcat'] as const;

// Keys of the deprecated IVisualConfig that IVisualConfigNew does not have. Real-world IVisSpec
// exports always carry them because they were serialized from initVisualConfig()-filled configs;
// their presence is what distinguishes a legacy spec from a PartialChart that has a `config` but
// no `layout`. A config without any of these keys is safer to treat as partial (fillChart keeps
// defaults for absent keys, while convertChart would overwrite them with `undefined`).
const LEGACY_CONFIG_KEYS = [
    'showTableSummary',
    'stack',
    'showActions',
    'interactiveScale',
    'sorted',
    'zeroScale',
    'size',
    'format',
    'geoKey',
    'resolve',
    'scaleIncludeUnmatchedChoropleth',
    'background',
    'colorPalette',
    'primaryColor',
    'scale',
    'geojson',
    'geoUrl',
    'useSvg',
] as const;

/**
 * Detect which input format a spec is in. The rules are ordered and explicit:
 * 1. a `$schema` pointing at vega.github.io, or any Vega-Lite structural key
 *    (`mark` / `encoding` / `spec` / `concat` / `hconcat` / `vconcat`) → `vega-lite`;
 * 2. a `layout` key → `chart` (same duck-typing as `parseChart` / `importCode`);
 * 3. a `config` carrying legacy-only keys (`stack`, `size`, `resolve`, …) → `vis-spec`;
 * 4. anything else → `partial-chart`.
 */
export function detectSpecKind(input: object): ISpecKind {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('normalize() expects a single spec object; got ' + (Array.isArray(input) ? 'an array' : String(input)));
    }
    const spec = input as Record<string, unknown>;
    if (typeof spec.$schema === 'string' && spec.$schema.includes('vega.github.io')) {
        return 'vega-lite';
    }
    if (VEGA_LITE_KEYS.some((key) => key in spec)) {
        return 'vega-lite';
    }
    if ('layout' in spec) {
        return 'chart';
    }
    if (spec.config && typeof spec.config === 'object' && LEGACY_CONFIG_KEYS.some((key) => key in (spec.config as object))) {
        return 'vis-spec';
    }
    return 'partial-chart';
}

/**
 * Normalize any accepted spec input into a complete, canonical IChart:
 * every encoding channel present, config/layout defaults filled, `visId` generated when missing,
 * spatial channels linted by `algebraLint`, and a `$schema` version stamp attached.
 *
 * This is a pure function (no store, no React, no side effects) and is idempotent:
 * `normalize(normalize(x, meta), meta)` deep-equals `normalize(x, meta)`.
 *
 * Existing import/export paths do not call this function; it is a purely additive entry point.
 *
 * @param input a full or partial IChart, a deprecated IVisSpec, or a Vega-Lite-like spec.
 * @param meta dataset fields; required to resolve field names for the Vega-Lite path.
 */
export function normalize(input: IChart | IVisSpec | PartialChart | Record<string, unknown>, meta: IMutField[] = []): IChart {
    const kind = detectSpecKind(input);
    let chart: IChart;
    switch (kind) {
        case 'vega-lite': {
            const vl = input as Record<string, unknown>;
            const base = newChart(meta, '');
            const allFields = [...base.encodings.dimensions, ...base.encodings.measures];
            const name = typeof vl.title === 'string' ? vl.title : 'Chart';
            chart = VegaliteMapper(vl, allFields, uniqueId(), name);
            break;
        }
        case 'chart':
        case 'vis-spec':
            chart = parseChart(input as IChart | IVisSpec);
            break;
        case 'partial-chart':
        default:
            chart = fillChart(input as PartialChart);
            break;
    }
    const filled = fillChart(chart);
    const geom = filled.config.geoms[0] ?? 'auto';
    // Same lint pass the store reducer applies on every encoding change (diffLinter middleware),
    // so normalized output matches what the UI would converge to for the same spec.
    const encodings: DraggableFieldState = {
        ...filled.encodings,
        ...algebraLint(geom, filled.encodings),
        ...lintExtraFields(filled.encodings),
    };
    return {
        ...filled,
        encodings,
        $schema: IChartSchemaUrl,
    };
}
