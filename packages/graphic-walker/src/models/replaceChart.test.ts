jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import { exportFullRaw, fromSnapshot, importFull, newChart, performers, redo, undo } from './visSpecHistory';

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
