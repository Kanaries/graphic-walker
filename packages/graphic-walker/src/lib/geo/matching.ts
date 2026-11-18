import type { Feature } from 'geojson';

/** The value as written, for an exact comparison. Empty for null, objects and blank text. */
export function geoValueText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'bigint' || typeof value === 'boolean') return String(value);
    return '';
}

/**
 * The value as a reader can tell it apart from another that trims to the same text: text in quotes
 * with its spaces, anything else as it prints. `East` and ` East ` read `"East"` and `" East "`.
 */
export function quoteGeoValue(value: unknown): string {
    return typeof value === 'string' ? `"${value}"` : String(value);
}

/**
 * The value with spelling differences that carry no meaning removed: full-width and half-width
 * forms (NFKC), letter case, and extra spaces. `" New  York "`, `"new york"` and `"ＮＥＷ ＹＯＲＫ"` all agree.
 */
export function normalizeGeoValue(value: unknown): string {
    return geoValueText(value).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * What a feature offers under `key`. Reads `properties` first. The key `id` falls back to the
 * feature's own `id`, where many files keep their ISO or FIPS code.
 */
export function featureKeyValue(feature: Feature, key: string): unknown {
    const value = feature?.properties?.[key];
    if (value !== undefined && value !== null) return value;
    return key === 'id' ? feature?.id : undefined;
}

export interface IFeatureKey {
    key: string;
    /** A few values found under this key, to show next to its name. */
    samples: string[];
    /** How many features carry it. */
    count: number;
}

const SAMPLE_LIMIT = 3;

/** The keys a data field could be matched against, each with sample values. */
export function listFeatureKeys(features: readonly Feature[]): IFeatureKey[] {
    const found = new Map<string, IFeatureKey>();
    const add = (key: string, value: unknown) => {
        const text = geoValueText(value);
        if (!text) return;
        let entry = found.get(key);
        if (!entry) {
            entry = { key, samples: [], count: 0 };
            found.set(key, entry);
        }
        entry.count += 1;
        if (entry.samples.length < SAMPLE_LIMIT && !entry.samples.includes(text)) entry.samples.push(text);
    };
    for (const feature of features) {
        const properties = feature?.properties ?? {};
        // Read through `featureKeyValue`, so the list offers exactly what matching can use.
        for (const key of Object.keys(properties)) add(key, featureKeyValue(feature, key));
        if (!('id' in properties)) add('id', feature?.id);
    }
    return [...found.values()];
}

/** The key to preselect: the current one when the file has it, else `name`, else the first. */
export function suggestFeatureKey(keys: readonly IFeatureKey[], current?: string): string {
    if (current && keys.some((k) => k.key === current)) return current;
    const named = keys.find((k) => k.key.toLowerCase() === 'name');
    return (named ?? keys[0])?.key ?? '';
}

export interface IGeoMatch {
    /** For each row, the indices of the features its value points at. Empty when nothing matched. */
    rowFeatures: number[][];
    /** Indices of the rows that found a feature. */
    matchedRows: number[];
    /** Rows whose value is blank, so there was nothing to look up. */
    emptyRows: number;
    /** Rows with a value that no feature carries. */
    unmatchedRows: number;
    /**
     * How many different non-blank values the rows hold. Values count as the data has them, so
     * `East` and ` East ` are two: the aggregation upstream keeps them in separate rows.
     */
    distinctValues: number;
    /** How many of those found a feature. */
    matchedValues: number;
    /** The distinct values behind `unmatchedRows` as trimmed text, in the order they first appear. */
    unmatchedValues: string[];
    /**
     * Groups of differently written values that reach the same feature, such as `East`, `EAST`
     * and ` East `, as the data has them. The data keeps them as separate rows, so their shapes
     * are drawn on top of each other.
     */
    sharedValues: unknown[][];
    /** Features that no row points at. */
    unusedFeatures: number[];
    /** How many features have a value under the key at all. Zero means the key is wrong for this file. */
    keyedFeatures: number;
    /** A few of the values the features carry under the key, to show what the map expects. */
    featureSamples: string[];
}

const push = (index: Map<string, number[]>, key: string, i: number) => {
    const list = index.get(key);
    if (list) list.push(i);
    else index.set(key, [i]);
};

/**
 * Joins data values to features through `key`. Builds a lookup table once, so the cost grows with
 * rows plus features. A value is tried as written first and then in its normalized form, so a file
 * whose keys differ only by case still resolves each of them exactly. Several features may share a
 * key, as when each island of a country is its own feature. A row then gets all of them.
 *
 * Two values that differ only in spelling reach the same feature. This function does not merge
 * their rows, because only the aggregation knows how to combine them. It reports them in
 * `sharedValues` instead.
 */
export function matchFeatures(values: readonly unknown[], features: readonly Feature[], key: string): IGeoMatch {
    const exact = new Map<string, number[]>();
    const loose = new Map<string, number[]>();
    const featureSamples: string[] = [];
    let keyedFeatures = 0;
    features.forEach((feature, i) => {
        const text = geoValueText(featureKeyValue(feature, key));
        if (!text) return;
        keyedFeatures += 1;
        if (featureSamples.length < SAMPLE_LIMIT && !featureSamples.includes(text)) featureSamples.push(text);
        push(exact, text, i);
        push(loose, normalizeGeoValue(text), i);
    });

    const used = new Set<number>();
    const unmatched = new Set<string>();
    // Each distinct value and the features it reaches, looked up once. The key is the value as the
    // data has it, not its trimmed text, because that is what tells one row's group from another's.
    const resolved = new Map<unknown, number[] | undefined>();
    const matchedRows: number[] = [];
    let emptyRows = 0;
    let unmatchedRows = 0;
    let matchedValues = 0;
    const rowFeatures = values.map((value, row) => {
        const text = geoValueText(value);
        if (!text) {
            emptyRows += 1;
            return [];
        }
        let hit = resolved.get(value);
        if (hit === undefined && !resolved.has(value)) {
            hit = exact.get(text) ?? loose.get(normalizeGeoValue(text));
            resolved.set(value, hit);
            if (hit) {
                matchedValues += 1;
                for (const i of hit) used.add(i);
            }
        }
        if (!hit) {
            unmatchedRows += 1;
            unmatched.add(text);
            return [];
        }
        matchedRows.push(row);
        return hit;
    });

    const reaching = new Map<number, unknown[]>();
    for (const [value, hit] of resolved) {
        if (!hit) continue;
        for (const i of hit) {
            const list = reaching.get(i);
            if (list) list.push(value);
            else reaching.set(i, [value]);
        }
    }
    const shared = new Map<string, unknown[]>();
    for (const list of reaching.values()) {
        if (list.length > 1) shared.set(list.map(quoteGeoValue).join('\u0000'), list);
    }

    const unusedFeatures: number[] = [];
    for (let i = 0; i < features.length; i++) {
        if (!used.has(i)) unusedFeatures.push(i);
    }
    return {
        rowFeatures,
        matchedRows,
        emptyRows,
        unmatchedRows,
        distinctValues: resolved.size,
        matchedValues,
        unmatchedValues: [...unmatched],
        sharedValues: [...shared.values()],
        unusedFeatures,
        keyedFeatures,
        featureSamples,
    };
}
