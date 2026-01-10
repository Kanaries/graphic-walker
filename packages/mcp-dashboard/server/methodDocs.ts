import type { AgentMethodName } from '@kanaries/graphic-walker';

import { GW_METHOD_NAMES } from '../shared/state.ts';

type MethodDoc = {
    summary: string;
    args: string[];
};

const METHOD_DETAILS: Record<AgentMethodName, MethodDoc> = {
    setConfig: {
        summary: 'Overwrite a single property on `chart.config` such as `geoms`, `limit`, `background`, or toggles like `defaultAggregated`.',
        args: ['`key`: config property to update.', '`value`: the new configuration payload for that property.'],
    },
    removeField: {
        summary: 'Remove the field at the target index from one encoding channel (dimensions, measures, rows, columns, etc.).',
        args: ['`channel`: keyof `DraggableFieldState` that currently holds the field.', '`index`: zero-based position of the field to drop.'],
    },
    reorderField: {
        summary: 'Reorder fields inside a single encoding channel without changing other channels.',
        args: ['`channel`: encoding bucket to mutate.', '`fromIndex`: original index.', '`toIndex`: destination index.'],
    },
    moveField: {
        summary: 'Move a field from one encoding channel to another, optionally bounding the destination length (e.g., only two columns).',
        args: ['`fromChannel`: source encoding name.', '`fromIndex`: position inside the source.', '`toChannel`: destination encoding name.', '`toIndex`: desired insert point.', '`limit`: optional cap on destination array length.'],
    },
    cloneField: {
        summary: 'Copy a field to another channel while keeping the original in place and optionally renaming the backing fid. This is the primary method for building charts: clone dimensions from `dimensions` to `rows`/`columns` and measures from `measures` to `rows`/`columns`/`color`/etc. to create visualizations.',
        args: ['`fromChannel`: source encoding (typically `"dimensions"` or `"measures"`).', '`fromIndex`: source index (0-based position in the source channel).', '`toChannel`: destination encoding (e.g., `"rows"`, `"columns"`, `"color"`, `"size"`).', '`toIndex`: insert position (usually `0` to append).', '`newVarKey`: fid for the cloned field (usually same as source fid, e.g., `"region"` or `"sales"`).', '`limit`: optional destination length cap.'],
    },
    createBinlogField: {
        summary: 'Create a computed field derived from another field using binning (`bin`, `binCount`) or logarithmic transforms (`log`, `log2`, `log10`).',
        args: ['`channel`: encoding that hosts the source field.', '`index`: index of the source field.', '`op`: transform operator.', '`newVarKey`: fid for the computed field.', '`num`: bin size or log base configuration.'],
    },
    appendFilter: {
        summary: 'Insert a new filter row built from an existing field at a given position in the filters panel.',
        args: ['`filterIndex`: insertion index inside `filters`.', '`sourceChannel`: encoding supplying the field.', '`sourceIndex`: index inside the source encoding.', '`dragToken`: reserved for drag-drop bookkeeping (can be `null`).'],
    },
    modFilter: {
        summary: 'Replace the field used by an existing filter slot, preserving its position.',
        args: ['`filterIndex`: index inside `filters` to overwrite.', '`sourceChannel`: encoding supplying the replacement field.', '`sourceIndex`: index of the replacement field.'],
    },
    writeFilter: {
        summary: 'Persist the rule definition for a filter entry (e.g., range, equals, in list). Passing `null` clears the rule.',
        args: ['`filterIndex`: index of the filter to update.', '`rule`: `IFilterRule` payload or `null` to clear.'],
    },
    setName: {
        summary: 'Rename the visualization tab / chart title.',
        args: ['`name`: new chart name.'],
    },
    applySort: {
        summary: 'Apply a sort mode to the terminal dimension/measure pair on the canvas (used by the single-click sort UI).',
        args: ['`sort`: `ISortMode` definition to apply.'],
    },
    transpose: {
        summary: 'Swap row and column encodings and keep other channels untouched.',
        args: [],
    },
    setLayout: {
        summary: 'Set layout keys (size, background, geojson bindings, etc.) by emitting `[key, value]` tuples that merge onto `chart.layout`.',
        args: ['`entries`: array of `[key, value]` pairs to merge.'],
    },
    setFieldAggregator: {
        summary: 'Update the aggregation function (sum, avg, count, etc.) for a field at a specific position.',
        args: [
            '`channel`: encoding that owns the field.',
            '`index`: index inside that encoding.',
            '`aggregator`: `IAggregator` value. Must be one of: `"sum"`, `"count"`, `"max"`, `"min"`, `"mean"`, `"median"`, `"variance"`, `"stdev"`, `"distinctCount"`, or `"expr"`. Example: `"mean"`.',
        ],
    },
    setGeoData: {
        summary: 'Attach inline GeoJSON data plus helper metadata for choropleth maps.',
        args: ['`geojson`: optional GeoJSON feature collection.', '`geoKey`: field used to join geographies.', '`geoUrl`: optional remote topojson/geojson URL.'],
    },
    setCoordSystem: {
        summary: 'Switch coordinate system (cartesian, polar, geographic) which also resets legal geometry options.',
        args: ['`coordSystem`: `ICoordMode` enum value.'],
    },
    createDateDrillField: {
        summary: 'Derive a temporal drill field (year → quarter → month, etc.) from an existing temporal column.',
        args: ['`channel`: encoding hosting the source field.', '`index`: index of the source field.', '`level`: drill level from `DATE_TIME_DRILL_LEVELS`.', '`newVarKey`: fid for the computed field.', '`newName`: display name for the derived field.', '`format`: optional display format.', '`offset`: optional timezone offset.'],
    },
    createDateFeatureField: {
        summary: 'Create temporal feature fields such as weekday, week number, or month name.',
        args: ['`channel`: encoding with the source field.', '`index`: index in that encoding.', '`feature`: entry from `DATE_TIME_FEATURE_LEVELS`.', '`newVarKey`: fid for the computed field.', '`newName`: friendly display name.', '`format`: optional display format.', '`offset`: optional timezone offset.'],
    },
    changeSemanticType: {
        summary: 'Force a field to a different semantic type (nominal, ordinal, quantitative, temporal).',
        args: ['`channel`: encoding containing the field.', '`index`: index of the field.', '`semanticType`: new semantic type.'],
    },
    setFilterAggregator: {
        summary: 'Assign an aggregator to a filter row so aggregated filtering (e.g., sum of profit) becomes available.',
        args: ['`filterIndex`: index in `filters`.', '`aggregator`: `IAggregator` instance or empty string to disable aggregation.'],
    },
    addFoldField: {
        summary: 'Add a fold-by field so measures can be pivoted into key/value columns (GraphicWalker automatically injects Measure Name/Value as needed).',
        args: ['`fromChannel`: source encoding.', '`fromIndex`: source index.', '`toChannel`: destination encoding (usually `details`).', '`toIndex`: insert location.', '`newVarKey`: fid for the folded field.', '`limit`: optional destination limit.'],
    },
    upsertPaintField: {
        summary: 'Insert or update the internal paint field used for brush selections and palette mappings; passing `null` removes it.',
        args: ['`map`: `IPaintMap` / `IPaintMapV2` payload or `null` to delete.', '`label`: friendly name for the paint channel.'],
    },
    addSQLComputedField: {
        summary: 'Register a computed field backed by a SQL expression that can reference existing fields.',
        args: ['`fid`: identifier for the computed field.', '`name`: label shown to the user.', '`sql`: SQL expression string (GraphicWalker infers semantic/analytic type).'],
    },
    removeAllField: {
        summary: 'Remove every occurrence of the given field id across all encoding channels.',
        args: ['`fid`: field identifier to purge.'],
    },
    editAllField: {
        summary: 'Apply a partial patch (rename, formatter, semantic type, etc.) to every encoded instance of a field.',
        args: ['`fid`: field identifier to update.', '`patch`: partial `IField` payload applied to each matching field.'],
    },
    replaceWithNLPQuery: {
        summary: 'Replace the entire chart specification with the serialized result returned by the natural-language engine.',
        args: ['`query`: original natural-language question (for audit).', '`response`: serialized `IChart` JSON string that becomes the new spec.'],
    },
};

export const GRAPHIC_WALKER_METHOD_REFERENCE = buildMethodReference();

function buildMethodReference(): string {
    const lines: string[] = [
        '# GraphicWalker Agent Method Reference',
        '',
        'Each entry mirrors a call to `GWHandler.dispatchMethod`. Methods mutate a single visualization; use `targetVisId` in the dispatcher to address other tabs. Arguments are positional and must be supplied exactly as listed below.',
        '',
        '## Recommended Workflow',
        '',
        '1. Inspect the active chart via `IGWAgentState`. If every encoding channel other than the source buckets (`dimensions`, `measures`) is empty, treat the tab as blank and consider using `create-graphic-walker-viz` before editing the new `visId`; otherwise reuse the current chart.',
        '2. Pick a geometry with `setConfig("geoms", [...])` to establish the expected visual form (bars, lines, points, etc.).',
        '3. Populate encodings with `cloneField`: copy dimensions into `rows`/`columns` (and other channels as needed) and measures into `rows`/`columns`/`color`/`size`. This is the primary way to place data fields on the canvas.',
        '4. Adjust aggregations using `setFieldAggregator` whenever a cloned measure needs to use `sum`, `avg`, `count`, etc.',
        '5. Add filtering logic by pairing `appendFilter` (to insert a filter row sourced from an existing field) with `writeFilter` (to persist the rule definition, ranges, inclusion lists, and so on).',
        '',
        '',
    ];
    for (const method of GW_METHOD_NAMES) {
        const doc = METHOD_DETAILS[method];
        lines.push(`### \`${method}\``);
        lines.push(doc.summary);
        if (doc.args.length > 0) {
            lines.push('');
            lines.push('Arguments:');
            for (const arg of doc.args) {
                lines.push(`- ${arg}`);
            }
        }
        lines.push('');
    }
    return lines.join('\n').trimEnd();
}
