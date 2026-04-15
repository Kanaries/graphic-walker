import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { createTooltip, niceCeil, VEGA_LITE_DEFAULT_CATEGORY_RANGE } from "./utils";

function createDatasetEntry(rows: Array<Record<string, any>>) {
    return { source: rows };
}

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
    orientation?: "vertical" | "horizontal";
}) {
    const { rows, xKey, yKey, xValues, colorKey, colorValues, geomType, stackMode, xTitle, yTitle, background, palette = VEGA_LITE_DEFAULT_CATEGORY_RANGE, zeroScale = true, orientation = "vertical" } = params;
    const orderedColors = stackMode === "none" || orientation === "horizontal" ? [...colorValues] : [...colorValues].reverse();
    const colorIndex = new Map(colorValues.map((value, index) => [String(value), index]));
    const grouped = new Map<string, number>();
    const categoryField = "__category";
    const valueField = "__value";

    for (const row of rows) {
        const x = row[xKey];
        const color = row[colorKey];
        const value = Number(row[yKey]);
        if (!Number.isFinite(value)) continue;
        const key = `${String(color)}__${String(x)}`;
        grouped.set(key, (grouped.get(key) ?? 0) + value);
    }

    const rawSeries = orderedColors.map((colorValue) => ({
        colorValue,
        values: xValues.map((xValue) => grouped.get(`${String(colorValue)}__${String(xValue)}`) ?? 0),
    }));
    const totals = xValues.map((_, idx) => rawSeries.reduce((sum, series) => sum + (series.values[idx] ?? 0), 0));
    const positiveTotals = xValues.map((_, idx) => rawSeries.reduce((sum, series) => sum + Math.max(0, series.values[idx] ?? 0), 0));
    const negativeTotals = xValues.map((_, idx) => rawSeries.reduce((sum, series) => sum + Math.min(0, series.values[idx] ?? 0), 0));
    const maxStackExtent = Math.max(0, ...positiveTotals);
    const minStackExtent = Math.min(0, ...negativeTotals);
    const baseOption = {
        animation: false,
        backgroundColor: background,
        color: palette,
        tooltip: createTooltip([
            { key: "__x", title: xTitle ?? "x" },
            { key: "__value", title: yTitle ?? "y" },
        ], geomType),
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
        xAxis: orientation === "vertical"
            ? {
                  type: "category",
                  data: xValues,
                  name: xTitle,
                  nameLocation: "middle",
                  nameGap: 72,
                  nameTextStyle: { padding: [34, 0, 0, 0] },
                  axisLabel: { interval: 0, rotate: 90, margin: 10 },
              }
            : {
                  type: "value",
                  name: yTitle,
                  nameLocation: "middle",
                  nameGap: 34,
              },
        yAxis: orientation === "vertical"
            ? {
                  type: "value",
                  name: yTitle,
                  nameLocation: "middle",
                  nameGap: 52,
                  nameTextStyle: { padding: [0, 0, 8, 0] },
              }
            : {
                  type: "category",
                  data: xValues,
                  name: xTitle,
                  nameLocation: "middle",
                  nameGap: 52,
                  nameTextStyle: { padding: [0, 0, 8, 0] },
                  axisLabel: { interval: 0, rotate: 0, margin: 12 },
                  inverse: true,
              },
    };
    const encode = orientation === "vertical" ? { x: categoryField, y: valueField } : { x: valueField, y: categoryField };

    if (stackMode === "none" && geomType === "bar") {
        const finiteValues = rows.map((row) => Number(row[yKey])).filter((value) => Number.isFinite(value));
        const minValue = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
        const datasets = rows.map((row) => ({
            source: xValues.map((value) => ({
                [categoryField]: value,
                [valueField]: value === row[xKey] ? Number(row[yKey] ?? 0) : null,
            })),
        }));
        return {
            ...baseOption,
            dataset: datasets,
            [orientation === "vertical" ? "yAxis" : "xAxis"]: {
                ...(orientation === "vertical" ? baseOption.yAxis : baseOption.xAxis),
                min: Math.min(0, minValue),
            },
            series: rows.map((row, rowIndex) => {
                const colorValue = row[colorKey];
                const colorPos = colorIndex.get(String(colorValue)) ?? rowIndex;
                return {
                    name: String(colorValue),
                    type: "bar",
                    datasetIndex: rowIndex,
                    encode,
                    barGap: "-100%",
                    barCategoryGap: "22%",
                    itemStyle: { color: palette[colorPos % Math.max(1, palette.length)] },
                    z: rowIndex + 1,
                };
            }),
        };
    }

    if (stackMode === "center") {
        const baseOffsets = totals.map((total) => Math.max(0, (maxStackExtent - total) / 2));
        const datasets = [
            createDatasetEntry(xValues.map((value, index) => ({ [categoryField]: value, [valueField]: baseOffsets[index] ?? 0 }))),
            ...rawSeries.map((entry) =>
                createDatasetEntry(xValues.map((value, index) => ({ [categoryField]: value, [valueField]: entry.values[index] ?? 0 }))),
            ),
        ];
        return {
            ...baseOption,
            dataset: datasets,
            [orientation === "vertical" ? "yAxis" : "xAxis"]: {
                ...(orientation === "vertical" ? baseOption.yAxis : baseOption.xAxis),
                min: 0,
                max: maxStackExtent,
            },
            series: [
                {
                    name: "__base__",
                    type: geomType === "area" ? "line" : "bar",
                    datasetIndex: 0,
                    stack: "stack",
                    encode,
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
                    datasetIndex: index + 1,
                    stack: "stack",
                    encode,
                    areaStyle: geomType === "area" ? {} : undefined,
                    showSymbol: geomType === "area" ? false : undefined,
                    symbol: "none",
                    lineStyle: geomType === "area" ? { width: 1.5 } : undefined,
                    color: palette[(colorIndex.get(String(entry.colorValue)) ?? index) % Math.max(1, palette.length)],
                })),
            ],
        };
    }

    const normalizedSeries = rawSeries.map((entry, index) => {
        const values = stackMode === "normalize"
            ? entry.values.map((value, idx) => {
                  const total = totals[idx] ?? 0;
                  return total > 0 ? value / total : 0;
              })
            : entry.values;
        return {
            name: String(entry.colorValue),
            values,
            dataset: createDatasetEntry(xValues.map((value, valueIndex) => ({ [categoryField]: value, [valueField]: values[valueIndex] ?? 0 }))),
            type: geomType === "area" ? "line" : "bar",
            stack: stackMode === "none" ? undefined : "stack",
            areaStyle: geomType === "area" ? { opacity: 0.88 } : undefined,
            showSymbol: geomType === "area" ? false : undefined,
            smooth: false,
            symbol: "none",
            lineStyle: geomType === "area" ? { width: 1.1 } : undefined,
            color: palette[(colorIndex.get(String(entry.colorValue)) ?? index) % Math.max(1, palette.length)],
            barGap: stackMode === "none" ? "-100%" : "0%",
        };
    });
    const datasets = normalizedSeries.map((entry) => entry.dataset);
    const series = normalizedSeries.map((entry, index) => ({
        ...entry,
        datasetIndex: index,
        encode,
        values: undefined,
        dataset: undefined,
    }));

    const normalizedValues = normalizedSeries.flatMap((entry) => entry.values as number[]);
    const maxSeriesValue = Math.max(...normalizedValues);
    const maxStackValue = Math.max(...totals, maxSeriesValue, maxStackExtent);
    const valueAxis: Record<string, any> = {
        ...(orientation === "vertical" ? baseOption.yAxis : baseOption.xAxis),
        nameTextStyle: {
            padding: [0, 0, 8, 0],
            fontWeight: 600,
        },
    };

    if (stackMode === "normalize") {
        valueAxis.min = 0;
        valueAxis.max = 1;
        valueAxis.splitNumber = 10;
        valueAxis.axisLabel = { formatter: (value: number) => `${Math.round(value * 100)}%` };
    } else if (geomType === "area") {
        valueAxis.min = minStackExtent < 0 ? minStackExtent : 0;
        valueAxis.max = niceCeil(stackMode === "none" ? maxSeriesValue : maxStackValue);
        valueAxis.splitNumber = 8;
    } else if (!zeroScale) {
        const allValues = normalizedValues;
        valueAxis.min = Math.min(...allValues);
        valueAxis.max = niceCeil(Math.max(...totals, ...allValues));
        valueAxis.splitNumber = 8;
    } else {
        valueAxis.min = minStackExtent < 0 ? minStackExtent : 0;
        valueAxis.max = niceCeil(maxStackValue);
        valueAxis.splitNumber = 8;
    }

    return {
        ...baseOption,
        dataset: datasets,
        [orientation === "vertical" ? "yAxis" : "xAxis"]: valueAxis,
        series,
    };
}
