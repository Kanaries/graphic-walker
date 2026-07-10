/**
 * Display formatting for values that flow into explanation descriptions and
 * evidence-chart titles. Kernel-owned: explainers must never leak raw float
 * precision (e.g. "11.399379999999999") to the UI.
 */

/** trim trailing zeros of a toFixed result: "11.40" → "11.4", "12.00" → "12" */
function trimZeros(s: string): string {
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Human-scale numeric formatting without thousands separators (values may be
 * re-parsed with Number()): integers above 1000, 1 decimal in the tens,
 * up to 3 significant decimals below.
 */
export function formatMeasureValue(v: number): string {
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1000) return String(Math.round(v));
    if (abs >= 100) return trimZeros(v.toFixed(1));
    if (abs >= 1) return trimZeros(v.toFixed(2));
    if (abs === 0) return '0';
    return trimZeros(v.toPrecision(3));
}

/** decimals appropriate to a bin's width so adjacent bins stay distinct */
function binDecimals(width: number): number {
    if (!Number.isFinite(width) || width <= 0) return 2;
    if (width >= 10) return 0;
    if (width >= 1) return 1;
    if (width >= 0.1) return 2;
    return 3;
}

/** "11.399379999999999–17.099069999999998" → "11.4–17.1" */
export function formatBinRange(lo: number, hi: number): string {
    const d = binDecimals(hi - lo);
    return `${trimZeros(lo.toFixed(d))}–${trimZeros(hi.toFixed(d))}`;
}

/**
 * Display label for a category value coming back from a grouped query.
 * Bin transforms emit `[lo, hi]` tuples; everything else renders as-is.
 */
export function categoryLabel(value: unknown): string {
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        return formatBinRange(value[0], value[1]);
    }
    if (typeof value === 'number') return formatMeasureValue(value);
    return String(value);
}
