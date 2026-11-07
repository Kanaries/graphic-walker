import type { IChart, IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import type { AxisPlan, Diagnostic, RenderPlan, ResultBinding } from '@kanaries/worksheet-renderer';
import { validateRenderCapabilities } from '@kanaries/worksheet-renderer';
import { autoMark } from '../../vis/spec/mark';
import { nativeEncodingKeys } from '../../models/visSpec';
import { resolvePresentation, type NativePresentationInput, type NativeWorksheetLayout } from './presentation';

/** Metadata for results the host has already prepared. This adapter never reads or computes records. */
export interface PreparedColumn {
    readonly columnKey: string;
    readonly valueType: ResultBinding['valueType'];
    readonly rawColumnKey?: string;
    readonly unitKey?: string;
    readonly valueLabels?: Readonly<Record<string, string>>;
}

export interface NativeAdapterInput extends NativePresentationInput {
    readonly columns: readonly PreparedColumn[];
    readonly fieldColumns?: ReadonlyMap<string, string>;
    readonly boxplot?: RenderPlan['boxplot'];
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
        const aggregatedMeasure = chart.config.defaultAggregated && chart.config.geoms[0] !== 'boxplot' && field.analyticType === 'measure';
        const columnKey = input.fieldColumns?.get(configRef) ?? (aggregatedMeasure ? getMeaAggKey(field.fid, field.aggName) : field.fid);
        const column = columns.get(columnKey);
        if (!column) {
            diagnostics.push({ code: 'missing-binding', severity: 'error', recoverable: true, fieldRef, configRef, message: `No prepared result column ${JSON.stringify(columnKey)} exists for ${JSON.stringify(field.name)}.` });
            return fieldRef;
        }
        const positionType = field.analyticType === 'measure' || field.semanticType === 'quantitative' || column.valueType === 'interval' && field.computed && field.expression?.op === 'bin' ? 'linear' : field.semanticType === 'temporal' ? 'time' : 'band';
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
            ...(column.valueLabels === undefined ? {} : { valueLabels: column.valueLabels }),
        });
        return fieldRef;
    };

    let geom = chart.config.geoms[0];
    const axis = (name: 'rows' | 'columns'): AxisPlan => {
        const fields = chart.encodings[name].map((field, index) => ({ field, fieldRef: bind(field, `encodings.${name}[${index}]`) }));
        // This is the existing measureAfterDimension rule, without crossLimit's data loss.
        const dimensions = fields.filter(({ field }) => field.analyticType === 'dimension');
        const measures = fields.filter(({ field }) => field.analyticType === 'measure');
        if (geom === 'arc') {
            for (const { fieldRef } of measures) unsupported(fieldRefs.get(fieldRef)!.configRef, 'Arc worksheet shelves accept facet dimensions; encode measures with theta, radius or size.', fieldRef);
            return { facets: dimensions.map(({ fieldRef }) => fieldRef), positions: [] };
        }
        return {
            facets: (measures.length ? dimensions : dimensions.slice(0, -1)).map(({ fieldRef }) => fieldRef),
            positions: (measures.length ? measures : dimensions.slice(-1)).map(({ fieldRef }) => fieldRef),
        };
    };
    const rows = axis('rows');
    const columnsAxis = axis('columns');
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
    if (!['bar', 'point', 'circle', 'tick', 'line', 'area', 'trail', 'arc', 'boxplot', 'rect', 'text'].includes(geom)) unsupported('config.geoms', `The selected ${geom} mark is not supported.`);
    const channels: NonNullable<RenderPlan['channels']> = {};
    const active = new Set(nativeEncodingKeys(geom));
    for (const name of ['color', 'size', 'opacity', 'shape', 'text', 'theta', 'radius'] as const) {
        if (!active.has(name)) continue;
        const refs = chart.encodings[name].map((field, index) => bind(field, `encodings.${name}[${index}]`));
        if (refs.length > 1) unsupported(`encodings.${name}`, `Only one ${name} field is supported.`);
        if (refs.length) (channels as Record<string, unknown>)[name] = { fieldRef: refs[0] };
    }
    if (active.has('details') && chart.encodings.details.length) (channels as { details: string[] }).details = chart.encodings.details.map((field, index) => bind(field, `encodings.details[${index}]`));
    let barOrientation: RenderPlan['barOrientation'];
    if (geom === 'bar' || geom === 'boxplot') {
        const rowMeasures = rows.positions.length > 0 && rows.positions.every((ref) => fieldRefs.get(ref)!.field.analyticType === 'measure');
        const columnMeasures = columnsAxis.positions.length > 0 && columnsAxis.positions.every((ref) => fieldRefs.get(ref)!.field.analyticType === 'measure');
        if (rowMeasures === columnMeasures) unsupported('encodings', `${geom} needs a measure axis and a dimension position or default position on the other axis.`);
        else barOrientation = rowMeasures ? 'vertical' : 'horizontal';
    }
    const worksheet = (chart.layout as typeof chart.layout & NativeWorksheetLayout).worksheet;
    const preferredProgression = (refs: readonly string[]) => refs.length && refs.every((ref) => ['band', 'time'].includes(bindingByRef.get(ref)?.positionType ?? ''));
    const base: Omit<RenderPlan, 'domainPlanKey'> = {
        bindings, rows, columns: columnsAxis, mark: geom as RenderPlan['mark'], channels,
        stack: ['bar', 'area'].includes(geom) ? chart.layout.stack === 'stack' ? 'zero' : chart.layout.stack : 'none',
        barLayout: worksheet?.barLayout ?? 'overlap',
        ...(barOrientation ? { barOrientation } : {}),
        ...(geom === 'boxplot' && input.boxplot ? { boxplot: input.boxplot } : {}),
        ...(['line', 'area', 'trail'].includes(geom) ? { lineProgression: preferredProgression(columnsAxis.positions) ? 'x' : preferredProgression(rows.positions) ? 'y' : 'x' } : {}),
    };
    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return { diagnostics, fieldRefs };
    const presentation = resolvePresentation(chart, input, base, fieldRefs);
    diagnostics.push(...presentation.diagnostics);
    const { diagnostics: _presentationDiagnostics, ...display } = presentation;
    const planWithoutKey = { ...base, ...display };
    const domainPlanKey = `gw-domain:${stableJson({
        bindings: bindings.map(({ fieldRef, bindingId }) => ({ fieldRef, bindingId })),
        rows, columns: columnsAxis, mark: geom, channels, stack: base.stack, barLayout: base.barLayout, boxplot: base.boxplot, scales: Object.fromEntries(Object.entries(display.scales).map(([ref, { range: _range, ...domainOptions }]) => [ref, domainOptions])),
    })}`;
    const plan = { ...planWithoutKey, domainPlanKey };
    for (const diagnostic of validateRenderCapabilities(plan)) {
        const original = diagnostic.fieldRef ? fieldRefs.get(diagnostic.fieldRef)?.configRef : undefined;
        const path = diagnostic.configRef?.replace(/^channels\./, 'encodings.').replace(/^mark$/, 'config.geoms').replace(/^barLayout$/, 'layout.worksheet.barLayout');
        diagnostics.push({ ...diagnostic, configRef: original ?? path });
    }
    return diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? { diagnostics, fieldRefs } : { plan, diagnostics, fieldRefs };
}
