import type { AxisOptions, Diagnostic, RenderStyle } from '@kanaries/worksheet-renderer';
import type { IChart, VegaGlobalConfig } from '../../interfaces';
import type { NativePresentationInput } from './presentation';
import { autoMark } from '../../vis/spec/mark';
import { ColorSchemes } from '../../components/visualConfig/colorScheme';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type ThemeStyle = Mutable<RenderStyle>;
const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
/** Projection of static theme values; this does not run a Vega/Vega-Lite compiler. */
export function nativeTheme(
    chart: IChart,
    config: VegaGlobalConfig | undefined,
    mode: 'light' | 'dark' = 'light',
): { theme: NonNullable<NativePresentationInput['theme']>; diagnostics: Diagnostic[] } {
    const position = (axis: 'rows' | 'columns') =>
        chart.encodings[axis].find((field) => field.analyticType === 'measure') ??
        chart.encodings[axis].filter((field) => field.analyticType === 'dimension').at(-1);
    const types = [position('columns'), position('rows')].filter((field): field is NonNullable<typeof field> => !!field).map((field) => field.semanticType);
    const diagnostics: Diagnostic[] = [],
        raw = object(config),
        selected = chart.config.geoms[0] === 'auto' ? autoMark(types, chart.config.defaultAggregated) : chart.config.geoms[0];
    const reported = new Set<string>();
    const warn = (path: string, message: string) => {
        if (!reported.has(path)) {
            reported.add(path);
            diagnostics.push({ code: 'unsupported-theme', configRef: `vegaConfig.${path}`, message, severity: 'warning', recoverable: true });
        }
    };
    const reject = (path: string, message: string) =>
        diagnostics.push({ code: 'unsupported-theme', configRef: `vegaConfig.${path}`, message, severity: 'error', recoverable: true });
    const style: ThemeStyle = {
        background: mode === 'dark' ? '#111827' : '#ffffff',
        foreground: mode === 'dark' ? '#e5e7eb' : '#334155',
        headerBackground: mode === 'dark' ? '#1f2937' : '#f8fafc',
        gridColor: mode === 'dark' ? '#374151' : '#e2e8f0',
        borderColor: mode === 'dark' ? '#6b7280' : '#cbd5e1',
    };
    const string = (value: unknown, path: string, set: (value: string) => void) => {
        if (value === undefined) return;
        if (typeof value !== 'string') reject(path, 'Native themes require a static string.');
        else set(value);
    };
    const number = (value: unknown, path: string, set: (value: number) => void) => {
        if (value === undefined) return;
        if (typeof value !== 'number' || !Number.isFinite(value)) reject(path, 'Native themes require a finite static number.');
        else set(value);
    };
    string(raw.font, 'font', (value) => {
        style.fontFamily = value;
    });
    if (raw.background !== 'transparent')
        string(raw.background, 'background', (value) => {
            style.background = value;
        });
    const mark = { ...object(raw.mark), ...object(raw[selected]) };
    const color = ['line', 'trail', 'tick', 'point'].includes(selected) ? (mark.color ?? mark.stroke ?? mark.fill) : (mark.color ?? mark.fill ?? mark.stroke);
    string(color, `${selected}.color`, (value) => {
        style.color = value;
    });
    number(mark.opacity, `${selected}.opacity`, (value) => {
        style.opacity = value;
    });
    if (selected === 'point' || selected === 'circle')
        number(mark.size, `${selected}.size`, (value) => {
            style.pointSize = value;
        });
    if (selected === 'line' || selected === 'trail')
        number(mark.strokeWidth ?? mark.size, `${selected}.strokeWidth`, (value) => {
            style.lineWidth = value;
        });
    if (selected === 'tick') {
        number(mark.size ?? mark.bandSize, 'tick.size', (value) => { style.tickSize = value; });
        number(mark.thickness, 'tick.thickness', (value) => { style.tickThickness = value; });
    }
    if (selected === 'arc') {
        number(mark.innerRadius, 'arc.innerRadius', (value) => { style.arcInnerRadius = value; });
        number(mark.outerRadius, 'arc.outerRadius', (value) => { style.arcOuterRadius = value; });
    }
    if (selected === 'text')
        number(mark.fontSize, 'text.fontSize', (value) => {
            style.fontSize = value;
        });
    string(mark.font, `${selected}.font`, (value) => {
        style.fontFamily = value;
    });
    const supportedMark = new Set([
        'color',
        'fill',
        'stroke',
        'opacity',
        'font',
        ...(['point', 'circle'].includes(selected) ? ['size'] : []),
        ...(['line', 'trail'].includes(selected) ? ['strokeWidth', 'size'] : []),
        ...(selected === 'tick' ? ['size', 'bandSize', 'thickness'] : []),
        ...(selected === 'arc' ? ['innerRadius', 'outerRadius'] : []),
        ...(selected === 'text' ? ['fontSize'] : []),
    ]);
    for (const key of Object.keys(mark))
        if (!supportedMark.has(key)) warn(`${selected}.${key}`, 'This Vega mark theme property is not part of the native static theme subset.');
    const axes: { row?: AxisOptions; column?: AxisOptions; text?: AxisOptions } = {};
    const supportedAxis = new Set(['title', 'format', 'grid', 'tickCount', 'labels', 'labelColor', 'labelFont', 'labelFontSize', 'gridColor', 'domainColor']);
    const axisStyle = object(raw.axis);
    string(axisStyle.labelColor, 'axis.labelColor', (value) => {
        style.foreground = value;
    });
    string(axisStyle.gridColor, 'axis.gridColor', (value) => {
        style.gridColor = value;
    });
    string(axisStyle.domainColor, 'axis.domainColor', (value) => {
        style.borderColor = value;
    });
    string(axisStyle.labelFont, 'axis.labelFont', (value) => {
        style.fontFamily = value;
    });
    number(axisStyle.labelFontSize, 'axis.labelFontSize', (value) => {
        style.fontSize = value;
    });
    for (const [channel, axisName] of [
        ['row', 'axisY'],
        ['column', 'axisX'],
    ] as const) {
        const axis = { ...object(raw.axis), ...object(raw[axisName]) },
            result: Mutable<AxisOptions> = {};
        const axisPath = (key: string) => `${key in object(raw[axisName]) ? axisName : 'axis'}.${key}`;
        if (axis.title === null || typeof axis.title === 'string') result.title = axis.title;
        else if (axis.title !== undefined) reject(axisPath('title'), 'Native axis titles must be a string or null.');
        string(axis.format, axisPath('format'), (value) => {
            result.format = value;
        });
        number(axis.tickCount, axisPath('tickCount'), (value) => {
            result.tickCount = value;
        });
        if (typeof axis.grid === 'boolean') result.grid = axis.grid;
        else if (axis.grid !== undefined) reject(axisPath('grid'), 'Native grid requires a static boolean.');
        if (axis.labels === false) warn(axisPath('labels'), 'The native subset does not hide labels independently from the complete axis.');
        else if (axis.labels !== undefined && axis.labels !== true) reject(axisPath('labels'), 'Native axis labels require a static boolean.');
        for (const key of ['labelColor', 'gridColor', 'domainColor', 'labelFont', 'labelFontSize'])
            if (key in object(raw[axisName]) && object(raw[axisName])[key] !== axisStyle[key])
                warn(`${axisName}.${key}`, 'Native chrome uses shared axis colors and fonts. Put this value in the common axis theme.');
        for (const key of Object.keys(axis))
            if (!supportedAxis.has(key)) warn(axisPath(key), 'This Vega axis theme property is not part of the native static theme subset.');
        axes[channel] = result;
    }
    const range = object(raw.range),
        colorField = chart.encodings.color[0],
        palette =
            colorField?.semanticType === 'quantitative' || colorField?.semanticType === 'temporal'
                ? range.ramp
                : colorField?.semanticType === 'ordinal'
                  ? (range.ordinal ?? range.category)
                  : range.category;
    const scales: NonNullable<NativePresentationInput['theme']>['scales'] = {};
    if (palette !== undefined) {
        if (Array.isArray(palette) && palette.length && palette.every((value) => typeof value === 'string')) scales.color = { range: [...palette] };
        else if (typeof object(palette).scheme === 'string') {
            const named = ColorSchemes.find((item) => item.name === object(palette).scheme);
            if (Object.keys(object(palette)).some((key) => key !== 'scheme'))
                reject('range', 'Palette extent/count options need an explicit prepared color range.');
            else if (named) scales.color = { range: named.value };
            else reject('range', 'The named color palette is not declared by Graphic Walker.');
        } else reject('range', 'Native palettes must be nonempty static CSS color arrays.');
    }
    const known = new Set([
        'font',
        'background',
        'mark',
        'axis',
        'axisX',
        'axisY',
        'range',
        'bar',
        'point',
        'line',
        'trail',
        'rect',
        'text',
        'area',
        'circle',
        'tick',
        'arc',
        'boxplot',
        'errorbar',
        'errorband',
    ]);
    for (const key of Object.keys(raw)) if (!known.has(key)) warn(key, 'This Vega configuration block is not part of the native static theme subset.');
    return { theme: { mode, style, axes, scales }, diagnostics };
}
