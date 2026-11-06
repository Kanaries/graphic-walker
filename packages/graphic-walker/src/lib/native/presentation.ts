import type { IChannelScales, IChart, IColorScale, IScale, IViewField } from '../../interfaces';
import type { AxisOptions, Diagnostic, PreparedRecord, RenderPlan, RenderStyle, ScaleOptions } from '../../../../worksheet-renderer/src/core/types';

type Channel = 'row' | 'column' | 'color' | 'size' | 'opacity' | 'shape';
type StaticScale = Omit<IColorScale, 'domain' | 'range'> & ScaleOptions;
export type WorksheetScope = NonNullable<ScaleOptions['scope']>;
/** Optional fields will join the existing IVisualLayout schema during GW integration. */
export interface NativeWorksheetLayout {
    worksheet?: { scaleScopes?: { x?: WorksheetScope; y?: WorksheetScope }; barLayout?: 'grouped' };
}
export interface NativePresentationInput {
    readonly sourceMode?: 'complete' | 'windowed';
    /** Complete prepared results, used only to resolve an existing host scale callback. */
    readonly records?: readonly PreparedRecord[];
    readonly scales?: IChannelScales;
    /** A windowed host supplies these instead of evaluating a callback on one window. */
    readonly resolvedScales?: Partial<Record<Channel, StaticScale>>;
    readonly theme?: {
        readonly mode?: 'light' | 'dark';
        readonly style?: RenderStyle;
        readonly scales?: Partial<Record<Channel, ScaleOptions>>;
        readonly axes?: { readonly row?: AxisOptions; readonly column?: AxisOptions; readonly text?: AxisOptions };
    };
}
const palettes: Record<string, readonly string[]> = {
    tableau10: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'],
    category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
    blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
    redblue: ['#b2182b', '#ef8a62', '#f7f7f7', '#67a9cf', '#2166ac'],
};
const callbackCache = new WeakMap<Function, WeakMap<readonly PreparedRecord[], Map<string, IScale>>>();
const defined = (object: object | undefined) => Object.fromEntries(Object.entries(object ?? {}).filter(([, value]) => value !== undefined));

export function resolvePresentation(chart: IChart, input: NativePresentationInput, plan: Omit<RenderPlan, 'domainPlanKey'>, fields: ReadonlyMap<string, { field: IViewField }>) {
    const diagnostics: Diagnostic[] = [];
    const reject = (configRef: string, message: string, fieldRef?: string) => diagnostics.push({ code: 'unsupported-encoding', configRef, fieldRef, message, severity: 'error', recoverable: true });
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    const scales: Record<string, ScaleOptions> = {};
    const axes: Record<string, AxisOptions> = {};
    const worksheet = (chart.layout as typeof chart.layout & NativeWorksheetLayout).worksheet;
    for (const key of Object.keys(worksheet ?? {})) if (!['scaleScopes', 'barLayout'].includes(key)) reject(`layout.worksheet.${key}`, 'Unknown worksheet display option.');
    for (const key of Object.keys(worksheet?.scaleScopes ?? {})) if (!['x', 'y'].includes(key)) reject(`layout.worksheet.scaleScopes.${key}`, 'Only x and y support scoped domains.');
    const style: RenderStyle = {
        ...input.theme?.style,
        ...(chart.layout.primaryColor === undefined ? {} : { color: chart.layout.primaryColor }),
        ...(chart.layout.background === undefined ? {} : { background: chart.layout.background }),
    };
    let palette = chart.layout.colorPalette;
    for (const name of ['color', 'size', 'opacity', 'shape'] as const) if (chart.layout.resolve[name]) reject(`layout.resolve.${name}`, 'Non-position channels require shared domains.');
    function external(channel: Channel, ref: string): StaticScale {
        const resolved = input.resolvedScales?.[channel];
        if (resolved) return resolved;
        const configured = channel === 'shape' ? undefined : input.scales?.[channel];
        if (typeof configured !== 'function') return configured ?? {};
        if (input.sourceMode === 'windowed' || !input.records) {
            reject(`scales.${channel}`, 'Scale callbacks require complete prepared records or an explicitly resolved static scale.', ref);
            return {};
        }
        const binding = bindings.get(ref)!;
        const semanticType = fields.get(ref)!.field.semanticType;
        const theme = input.theme?.mode ?? 'light';
        const key = JSON.stringify([binding.columnKey, semanticType, theme]);
        let byRecords = callbackCache.get(configured);
        if (!byRecords) { byRecords = new WeakMap(); callbackCache.set(configured, byRecords); }
        let byField = byRecords.get(input.records);
        if (!byField) { byField = new Map(); byRecords.set(input.records, byField); }
        if (!byField.has(key)) {
            try {
                const resolved = configured({ semanticType, theme, values: input.records.map((record) => record[binding.columnKey]) });
                byField.set(key, { ...resolved, ...(resolved.domain ? { domain: [...resolved.domain] as IScale['domain'] } : {}), ...(resolved.range ? { range: [...resolved.range] as IScale['range'] } : {}) });
            } catch (error) {
                reject(`scales.${channel}`, `Scale callback failed: ${error instanceof Error ? error.message : String(error)}`, ref);
                return {};
            }
        }
        return byField.get(key)!;
    }
    const channels: Array<[Channel, readonly string[]]> = [['row', plan.rows.positions], ['column', plan.columns.positions]];
    for (const name of ['color', 'size', 'opacity', 'shape'] as const) {
        const channel = plan.channels?.[name];
        if (channel && 'fieldRef' in channel) channels.push([name, [channel.fieldRef]]);
    }
    for (const [name, refs] of channels) for (const ref of refs) {
        const binding = bindings.get(ref)!;
        const ext = external(name, ref);
        const own = name === 'shape' ? undefined : chart.layout.scale?.[name];
        const raw = { ...defined(input.theme?.scales?.[name]), ...defined(ext), ...defined(own) } as ScaleOptions & IScale & { scheme?: IColorScale['scheme'] };
        const isPosition = name === 'row' || name === 'column';
        const { rangeMin, rangeMax, scheme, ...base } = raw;
        if (scheme !== undefined) {
            if (name !== 'color' || typeof scheme !== 'string') reject(`scales.${name}.scheme`, 'Only supported named color schemes are accepted; supply an explicit range for custom schemes.', ref);
            else palette = chart.layout.colorPalette ?? scheme;
        }
        let range: ScaleOptions['range'] = base.range;
        if (rangeMin !== undefined || rangeMax !== undefined) {
            if ((rangeMin === undefined || rangeMax === undefined) && (!range || range.length !== 2 || range.some((value) => typeof value !== 'number'))) reject(`layout.scale.${name}`, 'A partial pixel or channel range needs both explicit endpoints or a resolved two-number base range.', ref);
            if (rangeMin !== undefined && rangeMax !== undefined) range = [rangeMin, rangeMax];
            else if (range && range.length === 2) range = [rangeMin ?? range[0], rangeMax ?? range[1]];
        }
        const scope = isPosition
            ? worksheet?.scaleScopes?.[name === 'column' ? 'x' : 'y'] ?? { mode: chart.layout.resolve[name === 'column' ? 'x' : 'y'] ? 'pane' : 'shared' } as WorksheetScope
            : { mode: 'shared' as const };
        if (!isPosition && base.scope && base.scope.mode !== 'shared') reject(`scales.${name}.scope`, 'Non-position channels require shared domains.', ref);
        scales[ref] = {
            ...(binding.positionType === 'linear' && isPosition ? { zero: chart.layout.zeroScale } : {}),
            ...base,
            ...(range === undefined ? {} : { range: [...range] }),
            ...(base.domain === undefined ? {} : { domain: [...base.domain] }),
            scope,
        };
        if (isPosition) axes[ref] = {
            ...input.theme?.axes?.[name as 'row' | 'column'],
            ...format(binding.positionType, chart),
        };
    }
    const text = plan.channels?.text;
    if (text && 'fieldRef' in text) axes[text.fieldRef] = { ...input.theme?.axes?.text, ...format(bindings.get(text.fieldRef)!.positionType, chart) };
    if (palette) {
        if (!palettes[palette]) reject('layout.colorPalette', `Unknown native color palette ${JSON.stringify(palette)}; use an explicit static range.`);
        else (style as { palette?: readonly string[] }).palette = palettes[palette];
    }
    for (const name of ['radius', 'theta'] as const) if (input.scales?.[name] || chart.layout.scale?.[name]) reject(`scales.${name}`, 'Polar scales are not supported.');
    if (chart.layout.interactiveScale) reject('layout.interactiveScale', 'Interactive scale domain editing is not supported.');
    if (chart.layout.format.normalizedNumberFormat) reject('layout.format.normalizedNumberFormat', 'Normalized stacking and its format are not supported.');
    return { scales, axes, style, diagnostics };
}
function format(positionType: string | undefined, chart: IChart): AxisOptions {
    const value = positionType === 'time' ? chart.layout.format.timeFormat : chart.layout.format.numberFormat;
    return value ? { format: value } : {};
}
