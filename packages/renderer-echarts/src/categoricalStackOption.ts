import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { niceCeil } from "./utils";

export function buildCategoricalStackSeries(params: {
    rows: RendererPluginProps["data"];
    xKey: string;
    yKey: string;
    xValues: any[];
    colorKey: string;
    colorValues: any[];
    geomType: "bar" | "area";
    stackMode: string;
    xTitle?: string;
    yTitle?: string;
    background?: string;
    palette?: string[];
    zeroScale?: boolean;
}) {
    const { rows, xKey, yKey, xValues, colorKey, colorValues, geomType, stackMode, xTitle, yTitle, background, palette = ["#5B8FF9", "#61DDAA"], zeroScale = true } = params;
    const orderedColors = stackMode === "none" ? [...colorValues] : [...colorValues].reverse();
    const colorIndex = new Map(colorValues.map((value, index) => [String(value), index]));
    const grouped = new Map<string, number>();

    for (const row of rows) {
        const x = row[xKey];
        const color = row[colorKey];
        const value = Number(row[yKey]);
        if (!Number.isFinite(value)) continue;
        grouped.set(`${String(color)}__${String(x)}`, value);
    }

    const rawSeries = orderedColors.map((colorValue) => ({
        colorValue,
        values: xValues.map((xValue) => grouped.get(`${String(colorValue)}__${String(xValue)}`) ?? 0),
    }));
    const totals = xValues.map((_, idx) => rawSeries.reduce((sum, series) => sum + (series.values[idx] ?? 0), 0));
    const maxTotal = Math.max(0, ...totals);
    const baseOption = {
        animation: false,
        backgroundColor: background,
        color: palette,
        tooltip: { trigger: "axis" },
        legend: {
            show: true,
            orient: "vertical",
            right: 16,
            top: 12,
            type: "scroll",
            data: colorValues.map((value) => String(value)),
        },
        grid: {
            top: 24,
            right: 144,
            bottom: 102,
            left: 72,
            containLabel: true,
        },
        xAxis: {
            type: "category",
            data: xValues,
            name: xTitle,
            nameLocation: "middle",
            nameGap: 72,
            nameTextStyle: { padding: [34, 0, 0, 0] },
            axisLabel: { interval: 0, rotate: 90, margin: 10 },
        },
    };

    if (stackMode === "none" && geomType === "bar") {
        return {
            ...baseOption,
            yAxis: {
                type: "value",
                name: yTitle,
                nameLocation: "middle",
                nameGap: 52,
                nameTextStyle: { padding: [0, 0, 8, 0] },
                min: 0,
            },
            series: rows.map((row, rowIndex) => {
                const xValue = row[xKey];
                const colorValue = row[colorKey];
                const data = xValues.map((value) => (value === xValue ? Number(row[yKey] ?? 0) : "-"));
                const colorPos = colorIndex.get(String(colorValue)) ?? 0;
                return {
                    name: String(colorValue),
                    type: "bar",
                    data,
                    barGap: "-100%",
                    barCategoryGap: "18%",
                    itemStyle: { color: palette[colorPos % Math.max(1, palette.length)] },
                    z: rowIndex + 1,
                };
            }),
        };
    }

    if (stackMode === "center") {
        const baseOffsets = totals.map((total) => Math.max(0, (maxTotal - total) / 2));
        return {
            ...baseOption,
            yAxis: {
                type: "value",
                name: yTitle,
                nameLocation: "middle",
                nameGap: 52,
                nameTextStyle: { padding: [0, 0, 8, 0] },
                min: 0,
                max: maxTotal,
            },
            series: [
                {
                    name: "__base__",
                    type: geomType === "area" ? "line" : "bar",
                    stack: "stack",
                    data: baseOffsets,
                    silent: true,
                    tooltip: { show: false },
                    symbol: "none",
                    lineStyle: { opacity: 0 },
                    itemStyle: { color: "rgba(0,0,0,0)" },
                    areaStyle: geomType === "area" ? { opacity: 0 } : undefined,
                },
                ...rawSeries.map((entry, index) => ({
                    name: String(entry.colorValue),
                    type: geomType === "area" ? "line" : "bar",
                    stack: "stack",
                    data: entry.values,
                    areaStyle: geomType === "area" ? {} : undefined,
                    showSymbol: geomType === "area" ? false : undefined,
                    symbol: "none",
                    lineStyle: geomType === "area" ? { width: 1.5 } : undefined,
                    color: palette[(colorIndex.get(String(entry.colorValue)) ?? index) % Math.max(1, palette.length)],
                })),
            ],
        };
    }

    const series = rawSeries.map((entry, index) => {
        const values = stackMode === "normalize"
            ? entry.values.map((value, idx) => {
                  const total = totals[idx] ?? 0;
                  return total > 0 ? value / total : 0;
              })
            : entry.values;
        return {
            name: String(entry.colorValue),
            type: geomType === "area" ? "line" : "bar",
            stack: stackMode === "none" ? undefined : "stack",
            data: values,
            areaStyle: geomType === "area" ? { opacity: 0.88 } : undefined,
            showSymbol: geomType === "area" ? false : undefined,
            smooth: false,
            symbol: "none",
            lineStyle: geomType === "area" ? { width: 1.1 } : undefined,
            color: palette[(colorIndex.get(String(entry.colorValue)) ?? index) % Math.max(1, palette.length)],
            barGap: stackMode === "none" ? "-100%" : "0%",
        };
    });

    const maxSeriesValue = Math.max(...series.flatMap((entry) => entry.data as number[]));
    const maxStackValue = Math.max(...totals, maxSeriesValue);
    const yAxis: Record<string, any> = {
        type: "value",
        name: yTitle,
        nameLocation: "middle",
        nameGap: 52,
        nameTextStyle: {
            padding: [0, 0, 8, 0],
            fontWeight: 600,
        },
    };

    if (stackMode === "normalize") {
        yAxis.min = 0;
        yAxis.max = 1;
        yAxis.splitNumber = 10;
        yAxis.axisLabel = { formatter: (value: number) => `${Math.round(value * 100)}%` };
    } else if (geomType === "area") {
        yAxis.min = 0;
        yAxis.max = niceCeil(maxStackValue);
        yAxis.splitNumber = 8;
    } else if (!zeroScale) {
        const allValues = series.flatMap((entry) => entry.data as number[]);
        yAxis.min = Math.min(...allValues);
        yAxis.max = niceCeil(Math.max(...totals, ...allValues));
        yAxis.splitNumber = 8;
    } else {
        yAxis.min = 0;
        yAxis.max = niceCeil(maxStackValue);
        yAxis.splitNumber = 8;
    }

    return { ...baseOption, yAxis, series };
}
