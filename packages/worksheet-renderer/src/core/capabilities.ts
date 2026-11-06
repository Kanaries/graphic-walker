import type { Diagnostic, RenderPlan, ResultBinding } from './types';
import { validateFormat } from '../scene/text';
import { positionTypeFor as position } from './domains';

export const POINT_SHAPES = ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'cross'] as const;

/** Shared checks for the GW adapter and independent library callers. */
export function validateRenderCapabilities(plan: RenderPlan): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const reject = (configRef: string, message: string, fieldRef?: string, code = 'unsupported-encoding') =>
        diagnostics.push({ code, configRef, fieldRef, message, severity: 'error', recoverable: true });
    const whitelist = (object: object | undefined, names: readonly string[], path: string) => {
        for (const [name, value] of Object.entries(object ?? {}))
            if (value !== undefined && !names.includes(name)) reject(`${path}.${name}`, `Unsupported ${path} property ${name}.`);
    };
    if (!['bar', 'point', 'line', 'rect', 'text'].includes(plan.mark))
        reject('mark', 'Supported marks are bar, point, line, rect and text.');
    const bindings = new Map(plan.bindings.map((binding) => [binding.fieldRef, binding]));
    if (bindings.size !== plan.bindings.length)
        reject('bindings', 'Field references must be unique.', undefined, 'source-contract-violation');
    const requireBinding = (ref: string) => {
        const binding = bindings.get(ref);
        if (!binding) reject('bindings', `No result binding exists for ${ref}.`, ref, 'missing-binding');
        return binding;
    };
    const positions = new Set([...plan.rows.positions, ...plan.columns.positions]);
    for (const ref of [...plan.rows.facets, ...positions, ...plan.columns.facets, ...(plan.channels?.details ?? [])]) requireBinding(ref);
    const channelNames = ['color', 'size', 'opacity', 'shape', 'text'] as const;
    whitelist(plan.channels, [...channelNames, 'details'], 'channels');
    for (const name of channelNames) {
        const channel = plan.channels?.[name];
        if (!channel) continue;
        whitelist(channel, ['fieldRef', 'value'], `channels.${name}`);
        if ('fieldRef' in channel === 'value' in channel)
            reject(`channels.${name}`, 'A channel needs exactly one fieldRef or static value.');
        const binding = 'fieldRef' in channel ? requireBinding(channel.fieldRef) : undefined;
        if (binding?.valueType === 'interval')
            reject(
                `channels.${name}`,
                'Interval endpoints can define bar positions and details, not scalar visual channels.',
                binding.fieldRef,
            );
        if (name === 'text' && plan.mark !== 'text') reject('channels.text', 'Text labels on non-text marks are not supported.');
        if (name === 'shape' && plan.mark !== 'point') reject('channels.shape', 'Shape encoding is supported only for points.');
        if (name === 'size' && !['point', 'line'].includes(plan.mark))
            reject('channels.size', 'Size encoding is supported only for points and lines.');
        if (binding && ['size', 'opacity'].includes(name) && (position(binding) !== 'linear' || binding.valueType !== 'number'))
            reject(`channels.${name}`, `${name} requires numeric prepared results.`, binding.fieldRef);
        if (binding && name === 'shape' && position(binding) !== 'band')
            reject('channels.shape', 'Shape requires a discrete field.', binding.fieldRef);
        if (binding && name === 'color' && plan.mark === 'line' && position(binding) !== 'band')
            reject('channels.color', 'Lines require a constant or discrete series color.', binding.fieldRef);
        if ('value' in channel) {
            if (name === 'color' && typeof channel.value !== 'string')
                reject('channels.color', 'A static color must be a CSS color string.');
            if (name === 'shape' && !POINT_SHAPES.includes(channel.value as (typeof POINT_SHAPES)[number]))
                reject('channels.shape', 'Unsupported point symbol.');
            if (name === 'size' && (typeof channel.value !== 'number' || !Number.isFinite(channel.value) || channel.value < 0))
                reject('channels.size', 'Static size must be finite and non-negative.');
            if (
                name === 'opacity' &&
                (typeof channel.value !== 'number' || !Number.isFinite(channel.value) || channel.value < 0 || channel.value > 1)
            )
                reject('channels.opacity', 'Static opacity must be between zero and one.');
        }
    }
    const row = plan.rows.positions.map((ref) => bindings.get(ref)).filter((binding): binding is ResultBinding => !!binding);
    const column = plan.columns.positions.map((ref) => bindings.get(ref)).filter((binding): binding is ResultBinding => !!binding);
    for (const binding of [...row, ...column])
        if (binding.valueType === 'interval' && position(binding) === 'band')
            reject('bindings', 'Interval positions require a continuous scale.', binding.fieldRef);
    if (plan.mark === 'point' && !positions.size) reject('rows', 'Point marks require at least one position field.');
    if (plan.mark === 'line') {
        if (!row.length || !column.length || row.some((y) => column.some((x) => position(y) !== 'linear' && position(x) !== 'linear')))
            reject('rows', 'Every line pane needs two positions, including at least one numeric axis.');
        if (plan.lineProgression && !['x', 'y'].includes(plan.lineProgression))
            reject('lineProgression', 'Line progression must be x or y.');
    }
    if (plan.mark === 'rect' || plan.mark === 'text') {
        if ([...row, ...column].some((binding) => position(binding) !== 'band'))
            reject('rows', `${plan.mark} marks support band positions or a default cell.`);
        if (plan.mark === 'text' && !plan.channels?.text)
            reject('channels.text', 'Text marks require an explicit text field or static value.');
    }
    if (plan.mark === 'bar') {
        if (plan.barOrientation && !['horizontal', 'vertical'].includes(plan.barOrientation))
            reject('barOrientation', 'Bar orientation must be horizontal or vertical.');
        const orientation =
            plan.barOrientation ??
            (row.length && row.every((binding) => position(binding) === 'band')
                ? 'horizontal'
                : column.length && column.every((binding) => position(binding) === 'band')
                  ? 'vertical'
                  : undefined);
        if (!orientation) reject('barOrientation', 'Bar orientation is ambiguous; specify a numeric value axis.');
        const values = orientation === 'horizontal' ? column : row;
        if (!values.length || values.some((binding) => position(binding) !== 'linear' || binding.valueType !== 'number'))
            reject('barOrientation', 'Bar values require a numeric result field.');
    }
    if (plan.stack && !['none', 'zero'].includes(plan.stack)) reject('stack', 'Only none and zero stacking are supported.');
    if (plan.stack === 'zero' && plan.mark !== 'bar') reject('stack', 'Stacking is supported only for bars.');
    if (plan.barLayout && !['overlap', 'grouped'].includes(plan.barLayout)) reject('barLayout', 'Unsupported bar layout.');
    if (plan.barLayout === 'grouped' && (plan.mark !== 'bar' || plan.stack === 'zero'))
        reject('barLayout', 'Grouped bars require bar marks with stack none.');
    for (const binding of bindings.values())
        if (binding.valueType === 'interval' && (!positions.has(binding.fieldRef) || plan.mark !== 'bar'))
            reject('bindings', 'Prepared intervals are supported only as bar position boundaries.', binding.fieldRef);
    for (const [ref, scale] of Object.entries(plan.scales ?? {})) {
        const binding = requireBinding(ref);
        if (!binding) continue;
        whitelist(scale, ['type', 'domain', 'domainMin', 'domainMax', 'zero', 'nice', 'reverse', 'range', 'scope'], `scales.${ref}`);
        if (scale.type && scale.type !== position(binding))
            reject(`scales.${ref}.type`, 'Scale type must match the prepared position type.', ref);
        if (scale.scope) {
            whitelist(scale.scope, scale.scope.mode === 'prefix' ? ['mode', 'rowDepth', 'columnDepth'] : ['mode'], `scales.${ref}.scope`);
            if (!['shared', 'pane', 'prefix'].includes(scale.scope.mode)) reject(`scales.${ref}.scope`, 'Unknown scale scope.', ref);
            if (!positions.has(ref) && scale.scope.mode !== 'shared')
                reject(`scales.${ref}.scope`, 'Non-position channels require shared domains.', ref);
            if (scale.scope.mode === 'prefix') {
                const { rowDepth, columnDepth } = scale.scope;
                if (
                    ![rowDepth, columnDepth].every((value) => Number.isInteger(value) && value >= 0) ||
                    rowDepth + columnDepth === 0 ||
                    rowDepth > plan.rows.facets.length ||
                    columnDepth > plan.columns.facets.length
                )
                    reject(`scales.${ref}.scope`, 'Prefix depth must select at least one existing facet level.', ref);
            }
        }
        if ([scale.domainMin, scale.domainMax].some((value) => value !== undefined && !Number.isFinite(value)))
            reject(`scales.${ref}`, 'Domain endpoints must be finite.', ref);
        if (scale.domainMin !== undefined && scale.domainMax !== undefined && scale.domainMin >= scale.domainMax)
            reject(`scales.${ref}`, 'domainMin must be less than domainMax.', ref);
        if (position(binding) === 'band' && (scale.domainMin !== undefined || scale.domainMax !== undefined || scale.nice || scale.zero))
            reject(`scales.${ref}`, 'Band scales do not accept numeric domain options.', ref);
        if (scale.range !== undefined) {
            if (
                !scale.range.length ||
                scale.range.some((value) => typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value)))
            )
                reject(`scales.${ref}.range`, 'Ranges require finite numbers or strings.', ref);
            if (positions.has(ref) && (scale.range.length !== 2 || scale.range.some((value) => typeof value !== 'number')))
                reject(`scales.${ref}.range`, 'Position ranges require two numeric pixel endpoints.', ref);
            const shape = plan.channels?.shape;
            if (
                shape &&
                'fieldRef' in shape &&
                shape.fieldRef === ref &&
                scale.range.some((value) => !POINT_SHAPES.includes(value as (typeof POINT_SHAPES)[number]))
            )
                reject(`scales.${ref}.range`, 'A shape range contains an unsupported symbol.', ref);
            for (const name of ['color', 'size', 'opacity'] as const) {
                const channel = plan.channels?.[name];
                if (!channel || !('fieldRef' in channel) || channel.fieldRef !== ref) continue;
                if (name === 'color' && scale.range.some((value) => typeof value !== 'string'))
                    reject(`scales.${ref}.range`, 'Color ranges require CSS color strings.', ref);
                if (
                    name !== 'color' &&
                    (scale.range.length !== 2 ||
                        scale.range.some((value) => typeof value !== 'number' || value < 0 || (name === 'opacity' && value > 1)))
                )
                    reject(
                        `scales.${ref}.range`,
                        `${name} requires two non-negative numeric endpoints${name === 'opacity' ? ' no greater than one' : ''}.`,
                        ref,
                    );
            }
        }
    }
    for (const [ref, axis] of Object.entries(plan.axes ?? {})) {
        const binding = requireBinding(ref);
        whitelist(axis, ['title', 'format', 'grid', 'tickCount', 'hidden'], `axes.${ref}`);
        if (axis.tickCount !== undefined && (!Number.isInteger(axis.tickCount) || axis.tickCount < 1 || axis.tickCount > 100))
            reject(`axes.${ref}.tickCount`, 'tickCount must be an integer from 1 to 100.', ref);
        try {
            validateFormat(axis.format, binding ? position(binding) : 'linear');
        } catch (error) {
            reject(`axes.${ref}.format`, String(error), ref);
        }
    }
    whitelist(
        plan.style,
        ['color', 'background', 'palette', 'opacity', 'pointSize', 'lineWidth', 'barWidth', 'fontFamily', 'fontSize'],
        'style',
    );
    for (const name of ['pointSize', 'lineWidth', 'barWidth', 'fontSize'] as const) {
        const value = plan.style?.[name];
        if (value !== undefined && (!Number.isFinite(value) || value < 0))
            reject(`style.${name}`, `${name} must be finite and non-negative.`);
    }
    if (plan.style?.opacity !== undefined && (!Number.isFinite(plan.style.opacity) || plan.style.opacity < 0 || plan.style.opacity > 1))
        reject('style.opacity', 'Opacity must be between zero and one.');
    if (plan.style?.palette && (!plan.style.palette.length || plan.style.palette.some((value) => typeof value !== 'string')))
        reject('style.palette', 'A palette needs at least one CSS color.');
    return diagnostics;
}

export function assertRenderCapabilities(plan: RenderPlan): void {
    const diagnostic = validateRenderCapabilities(plan)[0];
    if (diagnostic) throw new Error(`${diagnostic.code}: ${diagnostic.configRef}: ${diagnostic.message}`);
}
/** Retained for S0 callers; validates the current capability matrix. */
export const assertS0Capabilities = assertRenderCapabilities;
