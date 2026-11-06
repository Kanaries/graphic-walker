import type { IChart, IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import type { AxisPlan, Diagnostic, RenderPlan, ResultBinding, ScaleOptions } from '../../../../worksheet-renderer/src/core/types';

/** Metadata for results the host has already prepared. This adapter never reads or computes records. */
export interface PreparedColumn {
    readonly columnKey: string;
    readonly valueType: ResultBinding['valueType'];
    readonly rawColumnKey?: string;
    readonly unitKey?: string;
}

export interface NativeAdapterInput {
    readonly columns: readonly PreparedColumn[];
}

export interface NativeFieldReference {
    readonly field: IViewField;
    readonly configRef: string;
}

export interface NativeAdapterResult {
    readonly plan?: RenderPlan;
    readonly diagnostics: readonly Diagnostic[];
    /** Only the GW adapter knows which original field an opaque library reference represents. */
    readonly fieldRefs: ReadonlyMap<string, NativeFieldReference>;
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

/**
 * Interpret an existing IChart without changing it or invoking a chart compiler.
 * S0 deliberately supports bar/point and the configuration exercised by its vertical slice.
 * Other display capabilities return errors, so callers cannot mistake a partial chart for a full one.
 */
export function adaptChartToRenderPlan(chart: IChart, input: NativeAdapterInput): NativeAdapterResult {
    const diagnostics: Diagnostic[] = [];
    const fieldRefs = new Map<string, NativeFieldReference>();
    const bindings: ResultBinding[] = [];
    const columns = new Map<string, PreparedColumn>();
    const occurrences = new Map<string, number>();
    const unsupported = (configRef: string, message: string, fieldRef?: string) => {
        diagnostics.push({ code: 'unsupported-encoding', severity: 'error', recoverable: true, configRef, fieldRef, message });
    };
    for (const column of input.columns) {
        if (columns.has(column.columnKey)) {
            diagnostics.push({ code: 'ambiguous-binding', severity: 'error', recoverable: true, configRef: 'prepared.columns', message: `Prepared column ${JSON.stringify(column.columnKey)} is declared more than once.` });
        }
        columns.set(column.columnKey, column);
    }

    const bind = (field: IViewField, configRef: string): string => {
        // Labels and array offsets are presentation, not field occurrence identity.
        // The fid already identifies a computed field. Its expression stays outside the library.
        const signature = stableJson([field.fid, field.aggName, field.analyticType, field.semanticType, field.timeUnit, field.offset]);
        const occurrence = occurrences.get(signature) ?? 0;
        occurrences.set(signature, occurrence + 1);
        const fieldRef = `gw-field:${signature}:${occurrence}`;
        fieldRefs.set(fieldRef, { field, configRef });
        const aggregatedMeasure = chart.config.defaultAggregated && field.analyticType === 'measure';
        const columnKey = aggregatedMeasure ? getMeaAggKey(field.fid, field.aggName) : field.fid;
        const column = columns.get(columnKey);
        if (!column) {
            diagnostics.push({ code: 'missing-binding', severity: 'error', recoverable: true, fieldRef, configRef, message: `No prepared result column ${JSON.stringify(columnKey)} exists for ${JSON.stringify(field.name)}.` });
            return fieldRef;
        }
        const positionType = field.analyticType === 'measure' || field.semanticType === 'quantitative' ? 'linear' : field.semanticType === 'temporal' ? 'time' : 'band';
        if (column.valueType === 'interval') {
            unsupported(configRef, 'Prepared interval geometry is not supported by the S0 renderer.', fieldRef);
        } else if ((positionType === 'linear' && column.valueType !== 'number') || (positionType === 'time' && column.valueType !== 'time')) {
            diagnostics.push({ code: 'invalid-binding-type', severity: 'error', recoverable: true, fieldRef, configRef, message: `${JSON.stringify(field.name)} requires a prepared ${positionType === 'time' ? 'time coordinate' : 'number'} column; received ${column.valueType}.` });
        }
        if (column.rawColumnKey && !columns.has(column.rawColumnKey)) {
            diagnostics.push({ code: 'missing-binding', severity: 'error', recoverable: true, fieldRef, configRef, message: `Raw result column ${JSON.stringify(column.rawColumnKey)} is not declared in the prepared columns.` });
        }
        bindings.push({
            fieldRef,
            bindingId: `gw-binding:${stableJson([columnKey, column.valueType, positionType, column.unitKey, column.rawColumnKey])}`,
            columnKey,
            valueType: column.valueType,
            positionType,
            analyticType: field.analyticType,
            label: aggregatedMeasure ? getMeaAggName(field.name, field.aggName) : field.name,
            ...(column.unitKey === undefined ? {} : { unitKey: column.unitKey }),
            ...(column.rawColumnKey === undefined ? {} : { rawColumnKey: column.rawColumnKey }),
        });
        return fieldRef;
    };

    const axis = (name: 'rows' | 'columns'): AxisPlan => {
        const fields = chart.encodings[name].map((field, index) => ({ field, fieldRef: bind(field, `encodings.${name}[${index}]`) }));
        // This is the existing measureAfterDimension rule, without crossLimit's data loss.
        const dimensions = fields.filter(({ field }) => field.analyticType === 'dimension');
        const measures = fields.filter(({ field }) => field.analyticType === 'measure');
        return {
            facets: (measures.length ? dimensions : dimensions.slice(0, -1)).map(({ fieldRef }) => fieldRef),
            positions: (measures.length ? measures : dimensions.slice(-1)).map(({ fieldRef }) => fieldRef),
        };
    };
    const rows = axis('rows');
    const columnsAxis = axis('columns');
    const geom = chart.config.geoms[0];
    if (chart.config.geoms.length !== 1 || (geom !== 'bar' && geom !== 'point')) {
        unsupported('config.geoms', 'S0 supports one explicitly selected bar or point mark.');
    }
    if (chart.config.coordSystem && chart.config.coordSystem !== 'generic') unsupported('config.coordSystem', 'The native worksheet supports Cartesian coordinates.');

    const color = chart.encodings.color.map((field, index) => bind(field, `encodings.color[${index}]`));
    if (color.length > 1) unsupported('encodings.color', 'Only one color field is supported.');
    if (chart.encodings.color.some((field) => field.semanticType !== 'nominal' && field.semanticType !== 'ordinal')) {
        unsupported('encodings.color', 'Continuous color is not supported by the S0 renderer.');
    }
    const details = chart.encodings.details.map((field, index) => bind(field, `encodings.details[${index}]`));
    for (const channel of ['size', 'opacity', 'shape', 'text', 'theta', 'radius', 'longitude', 'latitude', 'geoId'] as const) {
        if (chart.encodings[channel].length) unsupported(`encodings.${channel}`, `The ${channel} encoding is not supported by the S0 renderer.`);
    }

    let barOrientation: RenderPlan['barOrientation'];
    const bindingByRef = new Map(bindings.map((binding) => [binding.fieldRef, binding]));
    if (geom === 'bar') {
        const rowMeasures = rows.positions.length > 0 && rows.positions.every((ref) => fieldRefs.get(ref)!.field.analyticType === 'measure');
        const columnMeasures = columnsAxis.positions.length > 0 && columnsAxis.positions.every((ref) => fieldRefs.get(ref)!.field.analyticType === 'measure');
        if (rowMeasures === columnMeasures) {
            unsupported('encodings', 'Bars need a measure axis and a dimension position or default position on the other axis.');
        } else {
            barOrientation = rowMeasures ? 'vertical' : 'horizontal';
            const numeric = rowMeasures ? rows.positions : columnsAxis.positions;
            if (numeric.some((ref) => bindingByRef.get(ref)?.positionType !== 'linear')) unsupported('encodings', 'The bar measure axis requires numeric prepared results.');
        }
        if (chart.layout.stack === 'normalize' || chart.layout.stack === 'center') unsupported('layout.stack', `${chart.layout.stack} stacking is not supported.`);
    } else if (!rows.positions.length && !columnsAxis.positions.length) {
        unsupported('encodings', 'A point chart requires at least one position field.');
    }

    const scales: Record<string, ScaleOptions> = {};
    for (const [axisName, plan, resolve] of [['row', rows, 'y'], ['column', columnsAxis, 'x']] as const) {
        const config = chart.layout.scale?.[axisName];
        if (config?.type && config.type !== 'linear') unsupported(`layout.scale.${axisName}.type`, `The ${config.type} scale is not supported.`);
        if (config?.rangeMin !== undefined || config?.rangeMax !== undefined) unsupported(`layout.scale.${axisName}`, 'Custom position ranges are not supported by the S0 renderer.');
        if (chart.layout.resolve[resolve]) unsupported(`layout.resolve.${resolve}`, 'Independent position domains are not supported by the S0 renderer.');
        for (const ref of plan.positions) {
            const binding = bindingByRef.get(ref);
            if (config?.type === 'linear' && binding?.positionType === 'time') {
                unsupported(`layout.scale.${axisName}.type`, 'Overriding a time position with a linear scale is not supported by the S0 renderer.', ref);
            }
            if (config && binding?.positionType === 'band' && Object.values(config).some((value) => value !== undefined)) {
                unsupported(`layout.scale.${axisName}`, 'Numeric scale overrides cannot be applied to a band position.', ref);
            }
            const endpoints = [config?.domainMin, config?.domainMax];
            if (endpoints.some((value) => value !== undefined && !Number.isFinite(value))) unsupported(`layout.scale.${axisName}`, 'Fixed domain endpoints must be finite numbers.', ref);
            if (config?.domainMin !== undefined && config?.domainMax !== undefined && config.domainMin >= config.domainMax) unsupported(`layout.scale.${axisName}`, 'Fixed domainMin must be less than domainMax.', ref);
            scales[ref] = {
                scope: { mode: 'shared' },
                zero: binding?.positionType === 'linear' && chart.layout.zeroScale,
                ...(config?.domainMin === undefined ? {} : { domainMin: config.domainMin }),
                ...(config?.domainMax === undefined ? {} : { domainMax: config.domainMax }),
            };
        }
    }
    for (const channel of ['color', 'opacity', 'shape', 'size'] as const) {
        if (chart.layout.resolve[channel]) unsupported(`layout.resolve.${channel}`, 'Independent non-position domains are not supported.');
    }
    for (const channel of ['color', 'opacity', 'size', 'radius', 'theta'] as const) {
        if (chart.layout.scale?.[channel] && Object.values(chart.layout.scale[channel]!).some((value) => value !== undefined)) {
            unsupported(`layout.scale.${channel}`, `Custom ${channel} scales are not supported by the S0 renderer.`);
        }
    }
    for (const [key, value] of Object.entries(chart.layout.format)) {
        if (value) unsupported(`layout.format.${key}`, 'Custom formatting is not supported by the S0 renderer.');
    }
    if (chart.layout.colorPalette) unsupported('layout.colorPalette', 'Named color palettes are not supported by the S0 renderer.');
    if (chart.layout.interactiveScale) unsupported('layout.interactiveScale', 'Interactive scale changes are not supported by the S0 renderer.');
    if ((chart.layout as unknown as Record<string, unknown>).worksheet !== undefined) unsupported('layout.worksheet', 'Worksheet layout extensions are not supported by the S0 renderer.');

    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return { diagnostics, fieldRefs };
    const planWithoutKey: Omit<RenderPlan, 'domainPlanKey'> = {
        bindings,
        rows,
        columns: columnsAxis,
        mark: geom as 'bar' | 'point',
        channels: { ...(color.length ? { color: { fieldRef: color[0] } } : {}), ...(details.length ? { details } : {}) },
        stack: geom === 'bar' && chart.layout.stack !== 'none' ? 'zero' : 'none',
        barLayout: 'overlap',
        ...(barOrientation ? { barOrientation } : {}),
        scales,
        style: {
            ...(chart.layout.primaryColor === undefined ? {} : { color: chart.layout.primaryColor }),
            ...(chart.layout.background === undefined ? {} : { background: chart.layout.background }),
        },
    };
    // The key describes domain semantics, independent of names, colors and viewport size.
    const domainPlanKey = `gw-domain:${stableJson({
        bindings: bindings.map(({ fieldRef, bindingId }) => ({ fieldRef, bindingId })),
        rows, columns: columnsAxis, mark: geom, channels: planWithoutKey.channels, stack: planWithoutKey.stack, scales,
    })}`;
    return { plan: { ...planWithoutKey, domainPlanKey }, diagnostics, fieldRefs };
}
