import type { VariableWidthBarRow } from "./types";

import { scaleRange } from "./utils";

export const BAR_CATEGORY_FIELD = "__category_value__";
export const BAR_VALUE_FIELD = "__value_raw__";
export const BAR_STACK_START_FIELD = "__stack_start__";
export const BAR_STACK_END_FIELD = "__stack_end__";
export const BAR_WIDTH_RATIO_FIELD = "__bar_width_ratio__";

type LayoutGroup = {
    name: string;
    rows: Array<Record<string, any>>;
    fill?: string;
    opacity?: number;
    order: number;
};

type StackMode = "none" | "stack" | "normalize" | "center" | "zero";

function clampRatio(value: number) {
    return Math.max(0.35, Math.min(0.9, value));
}

function clampQuantitativeRatio(value: number) {
    return Math.max(0.025, Math.min(0.09, value));
}

function computeWidthRatio(params: {
    value: any;
    sizeKey: string;
    useDiscreteSize: boolean;
    sizeValues: any[];
    sizeMin: number;
    sizeMax: number;
}) {
    const { value, useDiscreteSize, sizeValues, sizeMin, sizeMax } = params;
    const sample = value;
    if (useDiscreteSize) {
        const index = Math.max(0, sizeValues.findIndex((value) => value === sample));
        return clampRatio(scaleRange(index, 0, Math.max(1, sizeValues.length - 1), 0.35, 0.9));
    }
    return clampQuantitativeRatio(scaleRange(Number(sample), sizeMin, sizeMax, 0.025, 0.09));
}

function aggregateGroupRows(params: { rows: Array<Record<string, any>>; xKey: string; yKey: string; }) {
    const { rows, xKey, yKey } = params;
    const grouped = new Map<string, { exemplar: Record<string, any>; value: number }>();
    for (const row of rows) {
        const category = row[xKey];
        const value = Number(row[yKey]);
        if (!Number.isFinite(value)) continue;
        const key = String(category);
        const entry = grouped.get(key) ?? { exemplar: row, value: 0 };
        entry.value += value;
        grouped.set(key, entry);
    }
    return grouped;
}

export function layoutVariableWidthBarGroups(params: {
    groups: LayoutGroup[];
    xKey: string;
    yKey: string;
    sizeKey: string;
    useDiscreteSize: boolean;
    sizeValues: any[];
    sizeMin: number;
    sizeMax: number;
    stackMode: StackMode;
    xValues: any[];
}) {
    const { groups, xKey, yKey, sizeKey, useDiscreteSize, sizeValues, sizeMin, sizeMax, stackMode, xValues } = params;
    const normalizedStackMode: StackMode = stackMode === "zero" ? "stack" : stackMode;
    const groupedBySeries = groups.map((group) => ({
        ...group,
        categoryMap: aggregateGroupRows({ rows: group.rows, xKey, yKey }),
    }));

    const totalsByCategory = new Map<string, number>();
    for (const category of xValues) {
        const total = groupedBySeries.reduce((sum, group) => sum + (group.categoryMap.get(String(category))?.value ?? 0), 0);
        totalsByCategory.set(String(category), total);
    }
    const maxTotal = Math.max(0, ...Array.from(totalsByCategory.values()));

    const datasets = groupedBySeries.map((group) => {
        const source: VariableWidthBarRow[] = [];
        for (const category of xValues) {
            const key = String(category);
            const entry = group.categoryMap.get(key);
            if (!entry) continue;
            const total = totalsByCategory.get(key) ?? 0;
            const rawValue = entry.value;
            const previous = source.length > 0 ? 0 : 0;
            void previous;
            source.push({
                ...entry.exemplar,
                [xKey]: category,
                [yKey]: rawValue,
                [BAR_CATEGORY_FIELD]: category,
                [BAR_VALUE_FIELD]: rawValue,
                [BAR_STACK_START_FIELD]: 0,
                [BAR_STACK_END_FIELD]: rawValue,
                [BAR_WIDTH_RATIO_FIELD]: computeWidthRatio({
                    value: entry.exemplar[sizeKey],
                    sizeKey,
                    useDiscreteSize,
                    sizeValues,
                    sizeMin,
                    sizeMax,
                }),
            });
        }
        return { group, source };
    });

    for (const category of xValues) {
        const key = String(category);
        const total = totalsByCategory.get(key) ?? 0;
        const centerBase = normalizedStackMode === "center" ? Math.max(0, (maxTotal - total) / 2) : 0;
        let cursor = 0;
        for (const dataset of datasets) {
            const row = dataset.source.find((item) => String(item[BAR_CATEGORY_FIELD]) === key);
            if (!row) continue;
            if (normalizedStackMode === "none") {
                row[BAR_STACK_START_FIELD] = 0;
                row[BAR_STACK_END_FIELD] = row[BAR_VALUE_FIELD];
                continue;
            }
            if (normalizedStackMode === "normalize") {
                const start = total > 0 ? cursor / total : 0;
                const end = total > 0 ? (cursor + row[BAR_VALUE_FIELD]) / total : 0;
                row[BAR_STACK_START_FIELD] = start;
                row[BAR_STACK_END_FIELD] = end;
                cursor += row[BAR_VALUE_FIELD];
                continue;
            }
            row[BAR_STACK_START_FIELD] = centerBase + cursor;
            row[BAR_STACK_END_FIELD] = centerBase + cursor + row[BAR_VALUE_FIELD];
            cursor += row[BAR_VALUE_FIELD];
        }
    }

    return {
        datasets,
        yAxisMin: 0,
        yAxisMax: normalizedStackMode === "normalize" ? 1 : maxTotal,
        usePercentageAxis: normalizedStackMode === "normalize",
    };
}
