import type { PaneWindow, RankRange } from '../core/types';
export const rangeContains = (outer: RankRange, inner: RankRange) => outer.start <= inner.start && outer.end >= inner.end;
export const windowContains = (outer: PaneWindow, inner: PaneWindow) =>
    rangeContains(outer.rows, inner.rows) && rangeContains(outer.columns, inner.columns);
export function intersection(a: PaneWindow, b: PaneWindow): PaneWindow | undefined {
    const rows = { start: Math.max(a.rows.start, b.rows.start), end: Math.min(a.rows.end, b.rows.end) };
    const columns = { start: Math.max(a.columns.start, b.columns.start), end: Math.min(a.columns.end, b.columns.end) };
    return rows.start < rows.end && columns.start < columns.end ? { rows, columns } : undefined;
}
export function subtractWindows(windows: readonly PaneWindow[], covered: readonly PaneWindow[]): PaneWindow[] {
    let result = windows.filter((w) => w.rows.start < w.rows.end && w.columns.start < w.columns.end);
    for (const cover of covered) {
        const next: PaneWindow[] = [];
        for (const window of result) {
            const hit = intersection(window, cover);
            if (!hit) {
                next.push(window);
                continue;
            }
            if (window.rows.start < hit.rows.start)
                next.push({ rows: { start: window.rows.start, end: hit.rows.start }, columns: window.columns });
            if (hit.rows.end < window.rows.end) next.push({ rows: { start: hit.rows.end, end: window.rows.end }, columns: window.columns });
            if (window.columns.start < hit.columns.start)
                next.push({ rows: hit.rows, columns: { start: window.columns.start, end: hit.columns.start } });
            if (hit.columns.end < window.columns.end)
                next.push({ rows: hit.rows, columns: { start: hit.columns.end, end: window.columns.end } });
        }
        result = next;
        if (result.length > 4096) throw new Error('resource-limit: fragmented window coverage exceeds 4096 rectangles');
    }
    return result;
}
/** Only rectangular unions are merged: no unrequested hole becomes confirmed empty. */
export function mergeWindows(windows: readonly PaneWindow[]): PaneWindow[] {
    const result = subtractWindows(windows, []);
    let changed = true;
    while (changed) {
        changed = false;
        outer: for (let a = 0; a < result.length; a++)
            for (let b = a + 1; b < result.length; b++) {
                const x = result[a],
                    y = result[b];
                if (windowContains(x, y)) {
                    result.splice(b, 1);
                    changed = true;
                    break outer;
                }
                if (windowContains(y, x)) {
                    result[a] = y;
                    result.splice(b, 1);
                    changed = true;
                    break outer;
                }
                if (
                    x.rows.start === y.rows.start &&
                    x.rows.end === y.rows.end &&
                    x.columns.start <= y.columns.end &&
                    y.columns.start <= x.columns.end
                ) {
                    result[a] = {
                        rows: x.rows,
                        columns: { start: Math.min(x.columns.start, y.columns.start), end: Math.max(x.columns.end, y.columns.end) },
                    };
                } else if (
                    x.columns.start === y.columns.start &&
                    x.columns.end === y.columns.end &&
                    x.rows.start <= y.rows.end &&
                    y.rows.start <= x.rows.end
                ) {
                    result[a] = {
                        columns: x.columns,
                        rows: { start: Math.min(x.rows.start, y.rows.start), end: Math.max(x.rows.end, y.rows.end) },
                    };
                } else continue;
                result.splice(b, 1);
                changed = true;
                break outer;
            }
    }
    return result.sort((a, b) => a.rows.start - b.rows.start || a.columns.start - b.columns.start);
}
