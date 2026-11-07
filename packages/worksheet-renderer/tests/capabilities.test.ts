import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRenderCapabilities, validateRenderCapabilities } from '../src/core/capabilities';
import type { RenderPlan } from '../src/core/types';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNativeScenario, type NativeScenario } from '../../graphic-walker/src/lib/native/scenarios';

function plan(name: NativeScenario): RenderPlan {
    const fixture = createNativeScenario(name);
    const result = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns, ...fixture.presentation });
    assert.ok(result.plan, JSON.stringify(result.diagnostics));
    return result.plan;
}

test('the independent capability gate admits all five marks and the supported channel matrix', () => {
    for (const name of ['nested', 'line', 'heatmap', 'text', 'grouped', 'stack', 'scatter', 'deep', 'scope', 'interval'] as const)
        assert.doesNotThrow(() => assertRenderCapabilities(plan(name)), name);
});

test('interval defaults use the common continuous type rule and cannot leak into scalar color channels', () => {
    const interval = plan('interval');
    const binding = interval.bindings.find((candidate) => candidate.valueType === 'interval')!;
    const inferred: RenderPlan = {
        ...interval,
        bindings: interval.bindings.map((candidate) => (candidate === binding ? { ...candidate, positionType: undefined } : candidate)),
        scales: { ...interval.scales, [binding.fieldRef]: { type: 'linear' } },
    };
    assert.doesNotThrow(() => assertRenderCapabilities(inferred));
    assert.throws(
        () => assertRenderCapabilities({ ...inferred, channels: { color: { fieldRef: binding.fieldRef } } }),
        /scalar visual channels/,
    );
});

test('unsupported mark-channel combinations remain explicit errors', () => {
    const bars = plan('nested'),
        line = plan('line'),
        points = plan('scatter'),
        heatmap = plan('heatmap');
    for (const candidate of [
        { ...bars, mark: 'arc' },
        { ...bars, channels: { size: { value: 20 } } },
        { ...bars, channels: { shape: { value: 'circle' } } },
        { ...bars, channels: { text: { value: 'label' } } },
        { ...line, channels: { color: { fieldRef: line.rows.positions[0] } } },
        { ...heatmap, rows: { facets: [], positions: [heatmap.channels!.color!.fieldRef] } },
        { ...points, channels: { shape: { value: 'star' } } },
        { ...bars, barLayout: 'grouped', stack: 'zero' },
        { ...points, style: { signal: 'width' } },
    ])
        assert.throws(() => assertRenderCapabilities(candidate as RenderPlan), /unsupported-encoding/);
});

test('scopes validate actual facet depths and non-position channels stay shared', () => {
    const bars = plan('nested');
    const position = bars.columns.positions[0];
    for (const scope of [{ mode: 'shared' }, { mode: 'pane' }, { mode: 'prefix', rowDepth: 1, columnDepth: 1 }] as const) {
        assert.doesNotThrow(() => assertRenderCapabilities({ ...bars, scales: { [position]: { scope } } }));
    }
    for (const scope of [
        { mode: 'prefix', rowDepth: 0, columnDepth: 0 },
        { mode: 'prefix', rowDepth: 4, columnDepth: 0 },
        { mode: 'prefix', rowDepth: -1, columnDepth: 1 },
    ] as const) {
        assert.throws(() => assertRenderCapabilities({ ...bars, scales: { [position]: { scope } } }), /Prefix depth/);
    }
    const heatmap = plan('heatmap');
    const color = heatmap.channels!.color!;
    assert.ok('fieldRef' in color);
    assert.throws(
        () => assertRenderCapabilities({ ...heatmap, scales: { [color.fieldRef]: { scope: { mode: 'pane' } } } }),
        /Non-position/,
    );
});

test('formatting, ranges, style and axis options use explicit validated subsets', () => {
    const points = plan('scatter');
    const ref = points.rows.positions[0];
    assert.doesNotThrow(() =>
        assertRenderCapabilities({
            ...points,
            axes: { [ref]: { format: '$,.2f', title: 'Revenue', tickCount: 5, grid: true, hidden: false } },
            scales: { [ref]: { domain: [0, 100], range: [15, 180], nice: true, reverse: true } },
            style: {
                color: '#123456',
                background: 'white',
                palette: ['red', 'blue'],
                opacity: 0.5,
                pointSize: 50,
                lineWidth: 2,
                barWidth: 10,
                fontFamily: 'serif',
                fontSize: 13,
            },
        }),
    );
    for (const invalid of [
        { axes: { [ref]: { format: 'anything-goes' } } },
        { axes: { [ref]: { tickCount: 0 } } },
        { scales: { [ref]: { type: 'log' } } },
        { scales: { [ref]: { range: ['red', 'blue'] } } },
        { style: { opacity: 2 } },
        { style: { pointSize: -10 } },
    ])
        assert.ok(validateRenderCapabilities({ ...points, ...invalid } as RenderPlan).length > 0);
});
