import test from 'node:test';
import assert from 'node:assert/strict';
import type { RenderPlan } from '../src/core/types';
import { typedValueKey, toTypedValue } from '../src/core/keys';
import { validateRenderCapabilities } from '../src/core/capabilities';
import { createPreparedDataSource } from '../src/core/prepared';
import { createWindowReader } from '../src/runtime/reader';
import { createResourceManager } from '../src/runtime/resources';
import { buildScene } from '../src/scene/build';

const labelKey = (value: string) => typedValueKey(toTypedValue(value));
const plan: RenderPlan = {
    bindings: [
        { fieldRef: 'fold', bindingId: 'fold', columnKey: 'branch', rawColumnKey: 'raw', label: 'Measure', valueType: 'string', positionType: 'band', valueLabels: { [labelKey('a')]: 'Revenue', [labelKey('b')]: 'Revenue' } },
        { fieldRef: 'x', bindingId: 'x', columnKey: 'x', label: 'Category', valueType: 'string', positionType: 'band', valueLabels: { [labelKey('c')]: '分类' } },
        { fieldRef: 'y', bindingId: 'y', columnKey: 'y', label: 'Value', valueType: 'number', positionType: 'linear' },
    ],
    rows: { facets: ['fold'], positions: [] }, columns: { facets: [], positions: ['x'] },
    axes: { x: { grid: true } },
    mark: 'text', domainPlanKey: 'labels', stack: 'none',
    channels: { color: { fieldRef: 'fold' }, text: { fieldRef: 'fold' } },
    style: { foreground: '#eeeeee', headerBackground: '#111111', gridColor: '#222222', borderColor: '#333333' },
};

test('equal display labels preserve separate header, domain and selection identities', async () => {
    assert.deepEqual(validateRenderCapabilities(plan), []);
    const source = createPreparedDataSource({ plan, records: [{ id: 'first', branch: 'a', raw: 'Revenue', x: 'c', y: 2 }, { id: 'second', branch: 'b', raw: 'Revenue', x: 'c', y: 3 }], version: { sourceId: 'labels', snapshotId: '1', presentationId: '1' }, getDatumKey: row => String(row.id) });
    const resources = createResourceManager();
    const reader = createWindowReader(source, plan, resources);
    try {
        const window = await reader.readWindow({ rows: { start: 0, end: 2 }, columns: { start: 0, end: 1 } });
        assert.equal(window.rows.leaves.length, 2);
        assert.notEqual(window.rows.leaves[0].key, window.rows.leaves[1].key);
        assert.deepEqual(window.rows.ancestors.map(header => header.label), ['Revenue', 'Revenue']);
        const frame = buildScene({ plan, rows: window.rows, columns: window.columns, panes: window.panes, domains: window.domains, width: 700, height: 700, scrollX: 0, scrollY: 0, frameId: 1 });
        const texts = frame.commands.flatMap(command => command.primitive.kind === 'text' ? [command.primitive.text] : []);
        assert.ok(texts.includes('分类'));
        assert.ok(texts.filter(text => text === 'Revenue').length >= 4, 'headers, marks and legend display labels');
        assert.deepEqual(frame.hits.map(hit => hit.datumKey).sort(), ['first', 'second']);
        for (const hit of frame.hits) assert.equal(hit.values.raw, 'Revenue');
        assert.ok(frame.headers.filter(header => header.axis === 'row').every(header => header.pathLabel === 'Revenue'));
        assert.ok(frame.commands.some(command => command.primitive.kind === 'rect' && command.primitive.fill === '#111111'));
        assert.ok(frame.commands.some(command => command.primitive.kind === 'text' && command.primitive.fill === '#eeeeee'));
        assert.ok(frame.commands.some(command => 'stroke' in command.primitive && command.primitive.stroke === '#222222'));
    } finally { reader.dispose(); resources.dispose(); }
});

test('labels reject malformed keys and continuous bindings before reading data', () => {
    for (const valueLabels of [{ a: 'Revenue' }, { '["number","1"]': 'Bad' }, { '["string","a"]': 2 }]) {
        const invalid = { ...plan, bindings: [{ ...plan.bindings[0], valueLabels }, ...plan.bindings.slice(1)] } as RenderPlan;
        assert.ok(validateRenderCapabilities(invalid).some(diagnostic => diagnostic.configRef?.endsWith('.valueLabels')));
    }
    const continuous = { ...plan, bindings: plan.bindings.map(binding => binding.fieldRef === 'y' ? { ...binding, valueLabels: { '["number",2]': 'Two' } } : binding) };
    assert.ok(validateRenderCapabilities(continuous).some(diagnostic => diagnostic.configRef === 'bindings.y.valueLabels'));
});
