import type { AgentMethodName } from '@kanaries/graphic-walker';

import { GW_METHOD_NAMES } from '../shared/state.ts';

type MethodDoc = {
    summary: string;
    args: string[];
};

const METHOD_DETAILS: Record<AgentMethodName, MethodDoc> = {
    setConfig: {
        summary: 'Overwrite a single property in `chart.config` to control chart behavior and appearance. Common properties include `geoms` (chart type), `limit` (row limit), `coordSystem` (coordinate system), and `defaultAggregated` (aggregation toggle).',
        args: [
            '`key`: config property to update. Common keys: `"geoms"`, `"limit"`, `"coordSystem"`, `"defaultAggregated"`, `"stack"`, `"interactiveScale"`, `"zeroScale"`, `"background"`, etc.',
            '`value`: the new value for the property. Examples: `["bar"]`, `["line"]`, `["point"]`, `["area"]`, `["auto"]` for geoms; `true`/`false` for booleans; `-1` for unlimited rows; `"generic"`/`"polar"`/`"geographic"` for coordSystem.',
        ],
    },
    removeField: {
        summary: 'Remove a field from a specific encoding channel at the given index. The field is only removed from the target channel; it remains available in the source buckets (`dimensions`/`measures`).',
        args: [
            '`channel`: encoding channel containing the field to remove (e.g., `"rows"`, `"columns"`, `"color"`, `"size"`, `"filters"`).',
            '`index`: 0-based position of the field to remove within the channel.',
        ],
    },
    reorderField: {
        summary: 'Change the position of a field within the same encoding channel. This is useful for reordering dimensions on an axis or changing the priority of color encodings.',
        args: [
            '`channel`: encoding channel to reorder within (e.g., `"rows"`, `"columns"`, `"dimensions"`, `"measures"`).',
            '`fromIndex`: current 0-based position of the field.',
            '`toIndex`: desired 0-based position to move the field to.',
        ],
    },
    moveField: {
        summary: 'Transfer a field from one encoding channel to another, removing it from the source. Unlike `cloneField` which copies, this method moves the field. Useful for reorganizing chart structure.',
        args: [
            '`fromChannel`: source encoding channel (e.g., `"rows"`, `"columns"`, `"color"`).',
            '`fromIndex`: 0-based position of the field in the source channel.',
            '`toChannel`: destination encoding channel.',
            '`toIndex`: desired insertion position in the destination channel.',
            '`limit`: (optional) maximum number of fields allowed in the destination channel.',
        ],
    },
    cloneField: {
        summary: 'Copy a field to another channel while keeping the original in place. This is the **primary method for building charts**: clone dimensions from `dimensions` to `rows`/`columns` and measures from `measures` to `rows`/`columns`/`color`/`size`/etc. to create visualizations. The field remains in its source channel and a copy is placed in the destination.',
        args: [
            '`fromChannel`: source encoding channel, typically `"dimensions"` or `"measures"` (can also be any other encoding channel).',
            '`fromIndex`: 0-based index of the field in the source channel.',
            '`toChannel`: destination encoding channel such as `"rows"`, `"columns"`, `"color"`, `"size"`, `"opacity"`, `"shape"`, `"details"`, etc.',
            '`toIndex`: insert position in the destination channel (use `0` to append at the beginning).',
            '`newVarKey`: field identifier (fid) for the cloned field. Typically the same as the source field\'s fid (e.g., `"c_2"` for season, `"c_12"` for count).',
            '`limit`: (optional) maximum number of fields allowed in the destination channel. If the destination already has this many fields, the operation may fail or replace existing fields.',
        ],
    },
    createBinlogField: {
        summary: 'Create a new computed field by applying binning or logarithmic transformations to an existing numeric field. Binning groups continuous values into discrete intervals. Useful for histograms and distribution analysis.',
        args: [
            '`channel`: encoding channel containing the source field to transform.',
            '`index`: 0-based index of the source field within the channel.',
            '`op`: transformation operator to apply. Valid values: `"bin"` (equal-width binning), `"binCount"` (specify number of bins), `"log"` (natural log), `"log2"` (base-2 log), `"log10"` (base-10 log).',
            '`newVarKey`: unique field identifier (fid) for the newly computed field.',
            '`num`: numeric parameter for the transformation. For binning: bin width or bin count. For log transforms: typically not used or set to the log base.',
        ],
    },
    appendFilter: {
        summary: 'Create a new filter slot in the filters panel based on an existing field from an encoding channel. After creating the filter, use `writeFilter` to set the actual filter rules.',
        args: [
            '`filterIndex`: position where the filter should be inserted in the `filters` array.',
            '`sourceChannel`: encoding channel containing the field to filter (e.g., `"dimensions"`, `"measures"`, `"rows"`, `"columns"`).',
            '`sourceIndex`: 0-based index of the field within the source channel.',
            '`dragToken`: internal bookkeeping parameter for drag-and-drop operations. Can be set to `null` when calling programmatically.',
        ],
    },
    modFilter: {
        summary: 'Replace the field used by an existing filter slot while keeping the filter position. This changes which field the filter operates on but preserves any existing filter rules.',
        args: [
            '`filterIndex`: 0-based index of the filter slot to modify in the `filters` array.',
            '`sourceChannel`: encoding channel containing the replacement field.',
            '`sourceIndex`: 0-based index of the replacement field within the source channel.',
        ],
    },
    writeFilter: {
        summary: 'Set or update the filter rule for an existing filter slot. Filter rules define what values to include or exclude. Pass `null` to clear the filter rule.',
        args: [
            '`filterIndex`: 0-based index of the filter slot in the `filters` array.',
            '`rule`: filter rule object (`IFilterRule`) or `null` to clear. Rule types include: range filters (for numeric/temporal fields with min/max), inclusion lists (select specific values), exclusion lists, temporal ranges, and more. The structure depends on the field type and filter mode.',
        ],
    },
    setName: {
        summary: 'Rename the visualization tab or change the chart title displayed to users.',
        args: ['`name`: new name/title for the chart (string, typically 1-120 characters).'],
    },
    applySort: {
        summary: 'Apply a sort order to the visualization based on the terminal (last) dimension or measure on the chart. This affects the visual ordering of bars, lines, or other marks.',
        args: ['`sort`: sort configuration object (`ISortMode`) specifying sort direction (ascending/descending) and the field to sort by.'],
    },
    transpose: {
        summary: 'Swap the row and column encodings, effectively rotating the chart by 90 degrees. All fields in `rows` move to `columns` and vice versa. Other encodings (color, size, etc.) remain unchanged.',
        args: [],
    },
    setLayout: {
        summary: 'Update layout configuration properties for the chart such as chart size, background color, scale settings, stack mode, and rendering options. Layout controls the visual presentation rather than data encoding.',
        args: [
            '`entries`: array of `[key, value]` pairs to merge into the `chart.layout` object. Common keys: `"size"` (chart dimensions), `"background"`, `"stack"` (stack/group mode), `"interactiveScale"`, `"zeroScale"` (include zero in axes), `"format"` (number/date formatting), `"showActions"`, etc.',
        ],
    },
    setFieldAggregator: {
        summary: 'Update the aggregation function for a measure field at a specific position in an encoding channel. This determines how values are aggregated when multiple rows share the same dimension values.',
        args: [
            '`channel`: encoding channel that contains the field (e.g., `"rows"`, `"columns"`, `"color"`, `"size"`, `"measures"`).',
            '`index`: 0-based index of the field within that channel.',
            '`aggregator`: aggregation function name. Valid values: `"sum"` (total), `"count"` (row count), `"max"` (maximum), `"min"` (minimum), `"mean"` (average), `"median"` (middle value), `"variance"`, `"stdev"` (standard deviation), `"distinctCount"` (unique count), or `"expr"` (custom expression). Leave empty string `""` for no aggregation.',
        ],
    },
    setGeoData: {
        summary: 'Configure geographic data for choropleth maps and geographic visualizations. Provides GeoJSON geometry and specifies how to join it with your data.',
        args: [
            '`geojson`: (optional) inline GeoJSON FeatureCollection containing geographic shapes.',
            '`geoKey`: field name in your data and/or GeoJSON properties used to join/match geographic regions (e.g., country name, state code).',
            '`geoUrl`: (optional) URL to a remote TopoJSON or GeoJSON file instead of providing inline data.',
        ],
    },
    setCoordSystem: {
        summary: 'Switch the coordinate system used for rendering the visualization. This changes which chart types (geoms) are available and how data is positioned.',
        args: [
            '`coordSystem`: coordinate system type (`ICoordMode`). Valid values: `"generic"` (standard Cartesian x-y), `"polar"` (circular/radial charts), `"geographic"` (map projections for geo data).',
        ],
    },
    createDateDrillField: {
        summary: 'Create a temporal drill-down field from a date/datetime column. Extracts a specific time granularity (year, quarter, month, day, etc.) to enable time-based analysis and hierarchical exploration.',
        args: [
            '`channel`: encoding channel containing the source temporal field.',
            '`index`: 0-based index of the source temporal field.',
            '`level`: temporal granularity to extract. Values from `DATE_TIME_DRILL_LEVELS` such as `"year"`, `"quarter"`, `"month"`, `"week"`, `"day"`, `"hour"`, `"minute"`, etc.',
            '`newVarKey`: unique field identifier (fid) for the computed drill field.',
            '`newName`: human-readable display name for the field (e.g., "Year", "Month").',
            '`format`: (optional) date/time format string for display (e.g., `"%Y-%m"`, `"%B %Y"`).',
            '`offset`: (optional) timezone offset in minutes to adjust the temporal values.',
        ],
    },
    createDateFeatureField: {
        summary: 'Extract specific date/time features from a temporal field, such as day of week, week number, or month name. Useful for pattern analysis (e.g., weekly trends, seasonal patterns).',
        args: [
            '`channel`: encoding channel containing the source temporal field.',
            '`index`: 0-based index of the source field.',
            '`feature`: specific temporal feature to extract. Values from `DATE_TIME_FEATURE_LEVELS` such as `"dayofweek"`, `"weekday"`, `"weeknum"`, `"monthname"`, `"dayofmonth"`, etc.',
            '`newVarKey`: unique field identifier (fid) for the computed feature field.',
            '`newName`: human-readable display name (e.g., "Day of Week", "Month Name").',
            '`format`: (optional) format string for displaying the extracted feature.',
            '`offset`: (optional) timezone offset in minutes.',
        ],
    },
    changeSemanticType: {
        summary: 'Override the semantic type of a field, changing how GraphicWalker interprets and visualizes it. Semantic types affect available chart types, aggregations, and visual encodings.',
        args: [
            '`channel`: encoding channel containing the field to modify.',
            '`index`: 0-based index of the field within the channel.',
            '`semanticType`: new semantic type to assign. Valid values: `"nominal"` (categorical, no order), `"ordinal"` (categorical with order), `"quantitative"` (continuous numeric), `"temporal"` (date/time).',
        ],
    },
    setFilterAggregator: {
        summary: 'Configure aggregation for a filter slot to enable filtering on aggregated values (e.g., "where sum of sales > 1000" instead of filtering individual records).',
        args: [
            '`filterIndex`: 0-based index of the filter slot in the `filters` array.',
            '`aggregator`: aggregation function name (same values as `setFieldAggregator`), or empty string `""` to disable aggregated filtering and filter on raw values instead.',
        ],
    },
    addFoldField: {
        summary: 'Create a fold transformation that pivots multiple measure columns into a long format with measure names and values. This enables comparing multiple metrics in a single visualization (GraphicWalker automatically creates "Measure Name" and "Measure Value" fields).',
        args: [
            '`fromChannel`: source encoding channel.',
            '`fromIndex`: 0-based index of the field to fold.',
            '`toChannel`: destination channel, typically `"details"` for fold operations.',
            '`toIndex`: insertion position in the destination channel.',
            '`newVarKey`: field identifier (fid) for the folded field.',
            '`limit`: (optional) maximum number of fields in the destination channel.',
        ],
    },
    upsertPaintField: {
        summary: 'Add or update a paint field for brush selections and custom color palettes. Paint fields allow users to interactively select and color data points. Pass `null` to remove the paint field.',
        args: [
            '`map`: paint map object (`IPaintMap` or `IPaintMapV2`) defining the color mappings and selection state, or `null` to remove the paint field entirely.',
            '`label`: user-facing display name for the paint channel.',
        ],
    },
    addSQLComputedField: {
        summary: 'Define a new computed field using a SQL expression. The expression can reference existing field names and use SQL functions. GraphicWalker will automatically infer the semantic and analytic type of the result.',
        args: [
            '`fid`: unique identifier for the new computed field.',
            '`name`: user-friendly display name for the computed field.',
            '`sql`: SQL expression string (e.g., `"price * quantity"`, `"UPPER(category)"`, `"CASE WHEN revenue > 1000 THEN \'High\' ELSE \'Low\' END"`). Field names in the expression should match existing fids.',
        ],
    },
    removeAllField: {
        summary: 'Remove all instances of a specific field across all encoding channels in the visualization. Useful for completely removing a field from the chart rather than removing it from individual channels.',
        args: ['`fid`: field identifier (fid) of the field to remove from all channels. The field will still exist in the dataset and source channels (`dimensions`/`measures`).'],
    },
    editAllField: {
        summary: 'Apply a partial update to all instances of a specific field across all encoding channels. Use this to bulk-update properties like display name, number format, or semantic type for all occurrences of a field.',
        args: [
            '`fid`: field identifier (fid) of the field to update across all channels.',
            '`patch`: partial field object (`IField`) with properties to update. Common properties: `"name"` (display name), `"formatter"` (number/date format), `"semanticType"`, `"analyticType"`, `"aggName"` (aggregation function). Only provided properties will be updated.',
        ],
    },
    replaceWithNLPQuery: {
        summary: 'Replace the entire current chart specification with a new one generated from a natural language query. This is typically used by AI/NLP systems that can interpret text requests and generate complete chart specifications.',
        args: [
            '`query`: the original natural language question or request (stored for audit/history purposes).',
            '`response`: serialized JSON string representing a complete `IChart` specification that will become the new chart. This must be a valid chart object with config, encodings, and layout properties.',
        ],
    },
};

export const GRAPHIC_WALKER_METHOD_REFERENCE = buildMethodReference();

function buildMethodReference(): string {
    const lines: string[] = [
        '# GraphicWalker Agent Method Reference',
        '',
        'This reference documents all available methods for manipulating GraphicWalker visualizations programmatically.',
        '',
        '**Important notes:**',
        '- Each method corresponds to a call to `GWHandler.dispatchMethod` in the browser',
        '- Methods modify a single visualization tab',
        '- Use the `targetVisId` parameter in dispatch calls to target a specific visualization',
        '- Arguments are **positional** and must be provided in the exact order listed',
        '- All indices are **0-based** (first item is index 0)',
        '',
        '',
        '## Recommended Workflow for Building Charts',
        '',
        '1. **Inspect the current state**: Check `IGWAgentState` to see what visualizations exist. If the active chart has empty encoding channels (rows, columns, color, etc.), you can either build on it or create a new visualization with `create-graphic-walker-viz`.',
        '',
        '2. **Set the chart type**: Use `setConfig("geoms", ["bar"])` to choose the visual representation. Common types: `["bar"]`, `["line"]`, `["point"]`, `["area"]`, `["auto"]` (automatic selection).',
        '',
        '3. **Build the chart with cloneField**: This is the core step for creating visualizations:',
        '   - Clone **dimensions** (categorical fields) from the `dimensions` channel to `rows` or `columns` to create axes',
        '   - Clone **measures** (numeric fields) from the `measures` channel to `columns`, `rows`, `color`, `size`, etc.',
        '   - Example: `cloneField("dimensions", 2, "rows", 0, "c_2")` to put season on rows',
        '   - Example: `cloneField("measures", 0, "columns", 0, "c_10")` to put a measure on columns',
        '',
        '4. **Adjust aggregations** (if needed): Use `setFieldAggregator` to change how measures are aggregated. The default is usually `"sum"`, but you can change to `"mean"`, `"count"`, `"max"`, `"min"`, etc.',
        '',
        '5. **Add filters** (optional): Use `appendFilter` to create a filter slot from a field, then `writeFilter` to set the filter rules (e.g., range filters, value selections).',
        '',
        '6. **Fine-tune the visualization**: Use other methods like `setLayout`, `transpose`, `applySort`, etc. to refine the chart appearance and behavior.',
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
