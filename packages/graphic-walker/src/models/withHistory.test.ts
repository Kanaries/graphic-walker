import { undoWith, redoWith, performWith, create, WithHistory, freeze, atWith } from './withHistory';

const reducer = (x: number, _: void) => x + 1;
const undo = undoWith(reducer);
const redo = redoWith(reducer);
const perform = performWith(reducer);
const at = atWith(reducer);

describe('test WithHistory', () => {
    let d: WithHistory<number, void> = create(0);
    test('test perform', () => {
        for (let i = 0; i < 300; i++) {
            d = perform(d);
            expect(d.now).toBe(i + 1);
        }
    });
    test('test undo', () => {
        for (let i = 0; i < 300; i++) {
            d = undo(d);
            expect(d.now).toBe(299 - i);
        }
    });
    test('over undo', () => {
        d = undo(d);
        expect(d.now).toBe(0);
    });
    test('test redo', () => {
        for (let i = 0; i < 300; i++) {
            d = redo(d);
            expect(d.now).toBe(i + 1);
        }
    });
    test('over redo', () => {
        d = redo(d);
        expect(d.now).toBe(300);
    });
    test('perform after undo', () => {
        let e = d;
        for (let i = 0; i < 150; i++) {
            e = undo(e);
            expect(e.now).toBe(299 - i);
        }
        e = perform(e);
        expect(e.now).toBe(151);
        e = redo(e);
        expect(e.now).toBe(151);
    });
    test('test freeze', () => {
        const f = freeze(d);
        expect(f.cursor).toBe(0);
        expect(f.now).toEqual(d.now);
    });
    test('test at', () => {
        expect(at(d, 100)).toBe(100);
        expect(at(d, 500)).toBe(300);
        expect(at(d, 290)).toBe(290);
    });
    test('random test', () => {
        let expectValue = 300;
        let justUndo = 0;
        for (let i = 0; i < 300; i++) {
            const R = Math.random();
            if (R < 0.4) {
                const times = Math.floor(Math.random() * 20);
                expectValue += times;
                for (let j = 0; j < times; j++) {
                    d = perform(d);
                }
                expect(d.now).toBe(expectValue);
                justUndo = 0;
            } else if (justUndo > 0 && R < 0.8) {
                const times = Math.floor(Math.random() * justUndo);
                expectValue += times;
                for (let j = 0; j < times; j++) {
                    d = redo(d);
                }
                expect(d.now).toBe(expectValue);
                justUndo = 0;
            } else {
                const times = Math.min(expectValue, Math.floor(Math.random() * 20));
                expectValue = expectValue - times;
                for (let j = 0; j < times; j++) {
                    d = undo(d);
                }
                expect(d.now).toBe(expectValue);
                justUndo = times;
            }
        }
    });
});
