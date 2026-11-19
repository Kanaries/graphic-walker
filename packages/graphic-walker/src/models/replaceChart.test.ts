jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import { exportFullRaw, fromSnapshot, importFull, Methods, newChart, performers, redo, resolveChart, undo } from './visSpecHistory';

const FIELDS = [{ fid: 'cat', semanticType: 'nominal', analyticType: 'dimension' }] as const;

const chartA = () => newChart([...FIELDS], 'Chart-A', 'vis-1');
const chartB = () => ({ ...newChart([...FIELDS], 'Chart-B', 'vis-1'), name: 'Chart-B' });

describe('Methods.replaceChart (undoable whole-chart replacement)', () => {
    test('apply → undo → redo roundtrip restores the replacement', () => {
        const applied = performers.replaceChart(fromSnapshot(chartA()), chartB());
        expect(applied.now.name).toBe('Chart-B');
        expect(applied.cursor).toBeLessThanOrEqual(applied.timeline.length);

        const undone = undo(applied);
        expect(undone.now.name).toBe('Chart-A');
        // redo must be able to reach the replacement again
        expect(undone.cursor).toBeLessThan(undone.timeline.length);
        expect(redo(undone).now.name).toBe('Chart-B');
    });

    test('apply → further edit → undo returns to the replacement, not the pre-apply chart', () => {
        const applied = performers.replaceChart(fromSnapshot(chartA()), chartB());
        const edited = performers.setName(applied, 'renamed-by-user');
        expect(edited.now.name).toBe('renamed-by-user');

        const undone = undo(edited);
        expect(undone.now.name).toBe('Chart-B');
        expect(undo(undone).now.name).toBe('Chart-A');
    });

    test('exported history preserves the replacement', () => {
        const applied = performers.replaceChart(fromSnapshot(chartA()), chartB());
        const restored = importFull(exportFullRaw(applied));
        expect(restored.now.name).toBe('Chart-B');
    });

    test('replay keeps the original visId', () => {
        const applied = performers.replaceChart(fromSnapshot(chartA()), { ...chartB(), visId: 'other-vis' });
        expect(applied.now.visId).toBe('vis-1');
    });
});

test('replays field settings from the 0.4.82 history opcode without renumbering replaceChart', () => {
    const base = chartA();
    base.encodings.columns = [base.encodings.dimensions[0]];
    const legacy = JSON.stringify({ base, timeline: [[Methods.replaceChart, 'columns', 0, { titleOverride: 'Legacy heading' }]] });
    expect(importFull(legacy).now.encodings.columns[0].titleOverride).toBe('Legacy heading');
    expect(resolveChart(legacy).encodings.columns[0].titleOverride).toBe('Legacy heading');
});

test('preserves field resets through a history export and import', () => {
    const base = chartA();
    base.encodings.columns = [base.encodings.dimensions[0]];
    const edited = performers.editField(fromSnapshot(base), 'columns', 0, {
        titleOverride: 'Old title', customFormat: '.2f', windowAgg: 'running_total',
    });
    const cleared = performers.editField(edited, 'columns', 0, {
        titleOverride: undefined, customFormat: undefined, windowAgg: undefined,
    });
    const serialized = exportFullRaw(cleared);
    for (const result of [importFull(serialized).now, resolveChart(serialized)]) {
        const field = result.encodings.columns[0];
        expect(field.titleOverride).toBeUndefined();
        expect(field.customFormat).toBeUndefined();
        expect(field.windowAgg).toBeUndefined();
    }
});
