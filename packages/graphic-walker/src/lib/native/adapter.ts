import type { IChart, IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import type { AxisPlan, Diagnostic, RenderPlan, ResultBinding } from '../../../../worksheet-renderer/src/core/types';
import { validateRenderCapabilities } from '../../../../worksheet-renderer/src/core/capabilities';
import { autoMark } from '../../vis/spec/mark';
import { resolvePresentation, type NativePresentationInput, type NativeWorksheetLayout } from './presentation';

/** Metadata for results the host has already prepared. This adapter never reads or computes records. */
export interface PreparedColumn {
    readonly columnKey: string;
    readonly valueType: ResultBinding['valueType'];
    readonly rawColumnKey?: string;
    readonly unitKey?: string;
}

export interface NativeAdapterInput extends NativePresentationInput {
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
 * Display capabilities are validated with the independent library before a plan is returned.
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
        if (column.valueType === 'interval' && (field.analyticType === 'measure' || positionType === 'band')) {
            unsupported(configRef, 'Prepared intervals require a numeric or time dimension position.', fieldRef);
        } else if (column.valueType !== 'interval' && ((positionType === 'linear' && column.valueType !== 'number') || (positionType === 'time' && column.valueType !== 'time'))) {
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
    let geom = chart.config.geoms[0];
    if (chart.config.geoms.length !== 1) unsupported('config.geoms', 'A worksheet target supports exactly one mark.');
    if (chart.config.coordSystem && chart.config.coordSystem !== 'generic') unsupported('config.coordSystem', 'The native worksheet supports Cartesian coordinates.');
    const bindingByRef = new Map(bindings.map((binding) => [binding.fieldRef, binding]));
    if (geom === 'auto') {
        const choices = new Set<string>();
        for (const row of rows.positions.length ? rows.positions : [undefined]) for (const column of columnsAxis.positions.length ? columnsAxis.positions : [undefined]) {
            const types = [column, row].filter((ref): ref is string => ref !== undefined).map((ref) => fieldRefs.get(ref)!.field.semanticType);
            choices.add(autoMark(types, chart.config.defaultAggregated));
        }
        if (choices.size !== 1) unsupported('config.geoms', 'Automatic mark selection differs between measure slots; choose one explicit mark.');
        geom = [...choices][0];
    }
    if (!['bar', 'point', 'line', 'rect', 'text'].includes(geom)) unsupported('config.geoms', `The selected ${geom} mark is not supported.`);
    const channels: NonNullable<RenderPlan['channels']> = {};
    for (const name of ['color', 'size', 'opacity', 'shape', 'text'] as const) {
        const refs = chart.encodings[name].map((field, index) => bind(field, `encodings.${name}[${index}]`));
        if (refs.length > 1) unsupported(`encodings.${name}`, `Only one ${name} field is supported.`);
        if (refs.length) (channels as Record<string, unknown>)[name] = { fieldRef: refs[0] };
    }
    if (chart.encodings.details.length) (channels as { details: string[] }).details = chart.encodings.details.map((field, index) => bind(field, `encodings.details[${index}]`));
    for (const name of ['theta', 'radius', 'longitude', 'latitude', 'geoId'] as const) if (chart.encodings[name].length) unsupported(`encodings.${name}`, `The ${name} encoding is not supported.`);
    let barOrientation: RenderPlan['barOrientation'];
    if (geom === 'bar') {
        const rowMeasures = rows.positions.length > 0 && rows.positions.every((ref) => fieldRefs.get(ref)!.field.analyticType === 'measure');
        const columnMeasures = columnsAxis.positions.length > 0 && columnsAxis.positions.every((ref) => fieldRefs.get(ref)!.field.analyticType === 'measure');
        if (rowMeasures === columnMeasures) unsupported('encodings', 'Bars need a measure axis and a dimension position or default position on the other axis.');
        else barOrientation = rowMeasures ? 'vertical' : 'horizontal';
        if (chart.layout.stack === 'normalize' || chart.layout.stack === 'center') unsupported('layout.stack', `${chart.layout.stack} stacking is not supported.`);
    }
    const worksheet = (chart.layout as typeof chart.layout & NativeWorksheetLayout).worksheet;
    const preferredProgression = (refs: readonly string[]) => refs.length && refs.every((ref) => ['band', 'time'].includes(bindingByRef.get(ref)?.positionType ?? ''));
    const base: Omit<RenderPlan, 'domainPlanKey'> = {
        bindings, rows, columns: columnsAxis, mark: geom as RenderPlan['mark'], channels,
        stack: geom === 'bar' && chart.layout.stack !== 'none' ? 'zero' : 'none',
        barLayout: worksheet?.barLayout ?? 'overlap',
        ...(barOrientation ? { barOrientation } : {}),
        ...(geom === 'line' ? { lineProgression: preferredProgression(columnsAxis.positions) ? 'x' : preferredProgression(rows.positions) ? 'y' : 'x' } : {}),
    };
    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return { diagnostics, fieldRefs };
    const presentation = resolvePresentation(chart, input, base, fieldRefs);
    diagnostics.push(...presentation.diagnostics);
    const { diagnostics: _presentationDiagnostics, ...display } = presentation;
    const planWithoutKey = { ...base, ...display };
    const domainPlanKey = `gw-domain:${stableJson({
        bindings: bindings.map(({ fieldRef, bindingId }) => ({ fieldRef, bindingId })),
        rows, columns: columnsAxis, mark: geom, channels, stack: base.stack, barLayout: base.barLayout, scales: display.scales,
    })}`;
    const plan = { ...planWithoutKey, domainPlanKey };
    for (const diagnostic of validateRenderCapabilities(plan)) {
        const original = diagnostic.fieldRef ? fieldRefs.get(diagnostic.fieldRef)?.configRef : undefined;
        const path = diagnostic.configRef?.replace(/^channels\./, 'encodings.').replace(/^mark$/, 'config.geoms').replace(/^barLayout$/, 'layout.worksheet.barLayout');
        diagnostics.push({ ...diagnostic, configRef: original ?? path });
    }
    return diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? { diagnostics, fieldRefs } : { plan, diagnostics, fieldRefs };
}
