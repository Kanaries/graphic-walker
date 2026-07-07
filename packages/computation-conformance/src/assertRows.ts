import type { IRow } from '../../graphic-walker/src/interfaces';

export const FLOAT_TOLERANCE = 1e-9;

interface CompareOptions {
    ordered?: boolean;
}

function normalizeValue(value: any): any {
    if (typeof value === 'number') {
        if (Number.isNaN(value)) {
            return 'NaN';
        }
        if (!Number.isFinite(value)) {
            return String(value);
        }
        return Math.abs(value) < FLOAT_TOLERANCE ? 0 : value;
    }
    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
    }
    return value;
}

function compareValue(actual: any, expected: any, path: string) {
    if (typeof actual === 'number' && typeof expected === 'number' && Number.isFinite(actual) && Number.isFinite(expected)) {
        expect(Math.abs(actual - expected)).toBeLessThanOrEqual(FLOAT_TOLERANCE);
        return;
    }
    if (Array.isArray(actual) && Array.isArray(expected)) {
        expect(actual.length).toBe(expected.length);
        actual.forEach((item, index) => compareValue(item, expected[index], `${path}[${index}]`));
        return;
    }
    expect(normalizeValue(actual)).toEqual(normalizeValue(expected));
}

function stableStringify(row: IRow): string {
    return JSON.stringify(
        Object.fromEntries(
            Object.entries(normalizeValue(row)).sort(([left], [right]) => {
                return left.localeCompare(right);
            }),
        ),
    );
}

export function expectRowsToConform(actual: IRow[], expected: IRow[], options: CompareOptions = {}) {
    const ordered = options.ordered ?? true;
    const actualRows = ordered ? actual : [...actual].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
    const expectedRows = ordered ? expected : [...expected].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));

    expect(actualRows.length).toBe(expectedRows.length);
    actualRows.forEach((actualRow, rowIndex) => {
        const expectedRow = expectedRows[rowIndex];
        expect(Object.keys(actualRow).sort()).toEqual(Object.keys(expectedRow).sort());
        for (const key of Object.keys(expectedRow)) {
            compareValue(actualRow[key], expectedRow[key], `${rowIndex}.${key}`);
        }
    });
}
