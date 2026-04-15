type VCfg = Record<string, any> | undefined;

const SCHEMES = {
    tableau10: ['#4c78a8', '#f58518', '#e45756', '#72b7b2', '#54a24b', '#eeca3b', '#b279a2', '#ff9da6', '#9d755d', '#bab0ac'],
    blues: ['#cfe1f2', '#bed8ec', '#a8cee5', '#8fc1de', '#74b2d7', '#5ba3cf', '#4592c6', '#3181bd', '#206fb2', '#125ca4', '#0a4a90'],
    yellowgreenblue: ['#eff9bd', '#dbf1b4', '#bde5b5', '#94d5b9', '#69c5be', '#45b4c2', '#2c9ec0', '#2182b8', '#2163aa', '#23479c', '#1c3185'],
    blueorange: ['#134b85', '#2f78b3', '#5da2cb', '#9dcae1', '#d2e5ef', '#f2f0eb', '#fce0ba', '#fbbf74', '#e8932f', '#c5690d', '#994a07'],
} as const;

export const VEGA_ALIGNED_CATEGORY_RANGE: readonly string[] = SCHEMES.tableau10;
export const VEGA_ALIGNED_DIVERGING_RANGE = [...SCHEMES.blueorange].reverse();
export const VEGA_ALIGNED_HEATMAP_RANGE: readonly string[] = SCHEMES.yellowgreenblue;
export const VEGA_ALIGNED_RAMP_RANGE: readonly string[] = SCHEMES.blues;

function asColorArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const colors = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    return colors.length > 0 ? colors : undefined;
}

function resolveRange(value: unknown, fallback: readonly string[]): string[] {
    if (Array.isArray(value)) {
        return asColorArray(value) ?? [...fallback];
    }
    if (value && typeof value === 'object' && 'scheme' in (value as Record<string, unknown>)) {
        const range = value as { scheme?: unknown; extent?: unknown };
        const fromScheme =
            Array.isArray(range.scheme)
                ? asColorArray(range.scheme)
                : typeof range.scheme === 'string'
                  ? SCHEMES[range.scheme.toLowerCase() as keyof typeof SCHEMES]
                  : undefined;
        const palette: readonly string[] = fromScheme ?? fallback;
        if (Array.isArray(range.extent) && range.extent[0] === 1 && range.extent[1] === 0) {
            return [...palette].reverse();
        }
        return [...palette];
    }
    return [...fallback];
}

export function getDiscretePalette(vegaConfig?: VCfg): string[] {
    return resolveRange(vegaConfig?.range?.category ?? vegaConfig?.range?.ordinal, VEGA_ALIGNED_CATEGORY_RANGE);
}

export function getDivergingPalette(vegaConfig?: VCfg): string[] {
    return resolveRange(vegaConfig?.range?.diverging, VEGA_ALIGNED_DIVERGING_RANGE);
}

export function getContinuousPalette(vegaConfig: VCfg, geom: string): string[] {
    const heatmap = resolveRange(vegaConfig?.range?.heatmap, VEGA_ALIGNED_HEATMAP_RANGE);
    const ramp = resolveRange(vegaConfig?.range?.ramp, VEGA_ALIGNED_RAMP_RANGE);
    const category = getDiscretePalette(vegaConfig);

    if (geom === 'rect') {
        return heatmap.length ? heatmap : ramp.length ? ramp : category;
    }
    return ramp.length ? ramp : heatmap.length ? heatmap : category;
}

export function getPrimaryColor(vegaConfig?: VCfg): string {
    return getDiscretePalette(vegaConfig)[0] ?? VEGA_ALIGNED_CATEGORY_RANGE[0];
}
