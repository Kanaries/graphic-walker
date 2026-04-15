import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { buildDiscreteColorLegendGraphic } from "./legends";
import type { FieldBinding } from "./types";
import { orderedUniqueValues } from "./utils";

function createDatasetSeries(params: {
    rows: Array<Record<string, any>>;
    series: Record<string, any>;
}) {
    return {
        dataset: [{ source: params.rows }],
        series: [{ datasetIndex: 0, ...params.series }],
    };
}

export function buildMissingAxisOption(params: {
    props: RendererPluginProps;
    geomType: string;
    sourceData: RendererPluginProps["data"];
    xField: FieldBinding;
    yField: FieldBinding;
    colorField: FieldBinding;
    defaultColor: string;
    categoryPalette: string[];
}) {
    const { props, geomType, sourceData, xField, yField, colorField, defaultColor, categoryPalette } = params;
    if (xField.key && yField.key) {
        return undefined;
    }

    if ((geomType === "point" || geomType === "circle") && !xField.key && !yField.key && colorField.key) {
        const colorDomain = orderedUniqueValues(props.data, colorField).filter((value) => value !== null);
        const datasets = colorDomain.map((value) => ({
            source: [{ __x: 0.5, __y: 0.5, __series_name: String(value) }],
        }));
        return {
            animation: false,
            backgroundColor: props.vegaConfig.background,
            color: categoryPalette,
            legend: { show: false },
            xAxis: { type: "value", min: 0, max: 1, show: false },
            yAxis: { type: "value", min: 0, max: 1, show: false },
            grid: { top: 24, right: 96, bottom: 24, left: 24 },
            graphic: buildDiscreteColorLegendGraphic({
                title: colorField.title,
                values: colorDomain,
                palette: categoryPalette,
                chartWidth: props.chartWidth,
                startY: 36,
            }),
            dataset: datasets,
            series: colorDomain.map((value, index) => ({
                type: "scatter",
                datasetIndex: index,
                name: String(value),
                encode: { x: "__x", y: "__y" },
                symbol: "circle",
                symbolSize: 8,
                itemStyle: { color: categoryPalette[index % Math.max(1, categoryPalette.length)] ?? defaultColor },
            })),
        };
    }

    if (xField.key) {
        const xKey = xField.key as string;
        const xAxis = {
            type: geomType === "point" || geomType === "circle" ? "value" : "category",
            data: geomType === "point" || geomType === "circle" ? undefined : orderedUniqueValues(sourceData, xField),
            name: xField.title,
            nameLocation: "middle",
            nameGap: geomType === "point" || geomType === "circle" ? 48 : 62,
            nameTextStyle: {
                padding: [geomType === "point" || geomType === "circle" ? 24 : 30, 0, 0, 0],
                fontWeight: geomType === "point" || geomType === "circle" ? 600 : undefined,
            },
            axisLabel: geomType === "point" || geomType === "circle" ? undefined : { interval: 0, rotate: 90, margin: 10 },
            min: geomType === "point" || geomType === "circle" ? 0 : undefined,
            max: geomType === "point" || geomType === "circle" ? 100 : undefined,
            splitNumber: geomType === "point" || geomType === "circle" ? 5 : undefined,
        };

        if (geomType === "bar") {
            const rows = orderedUniqueValues(sourceData, xField).map((value) => ({
                [xKey]: value,
                __value: 1,
            }));
            return {
                animation: false,
                backgroundColor: props.vegaConfig.background,
                color: [defaultColor],
                xAxis,
                yAxis: { type: "value", min: 0, max: 1, show: false },
                grid: { top: 24, right: 24, bottom: 64, left: 24, containLabel: true },
                ...createDatasetSeries({
                    rows,
                    series: {
                        type: "bar",
                        encode: { x: xKey, y: "__value" },
                    },
                }),
            };
        }
        if (geomType === "line") {
            const rows = orderedUniqueValues(sourceData, xField).map((value) => ({
                [xKey]: value,
                __value: 0.5,
            }));
            return {
                animation: false,
                backgroundColor: props.vegaConfig.background,
                color: [defaultColor],
                xAxis,
                yAxis: { type: "value", min: 0, max: 1, show: false },
                grid: { top: 24, right: 24, bottom: 72, left: 24, containLabel: true },
                ...createDatasetSeries({
                    rows,
                    series: {
                        type: "line",
                        showSymbol: false,
                        encode: { x: xKey, y: "__value" },
                    },
                }),
            };
        }
        if (geomType === "point" || geomType === "circle") {
            const rows = sourceData.map((row) => ({
                ...row,
                __y: 0.5,
            }));
            return {
                animation: false,
                backgroundColor: props.vegaConfig.background,
                color: [defaultColor],
                xAxis: {
                    ...xAxis,
                    axisLabel: {
                        show: true,
                        formatter: (axisValue: number) => `${Math.round(axisValue)}`,
                    },
                },
                yAxis: { type: "value", min: 0, max: 1, show: false },
                grid: { top: 24, right: 24, bottom: 98, left: 48, containLabel: true },
                ...createDatasetSeries({
                    rows,
                    series: {
                        type: "scatter",
                        symbol: geomType === "circle" ? "circle" : "emptyCircle",
                        symbolSize: 6,
                        encode: { x: xKey, y: "__y" },
                    },
                }),
            };
        }
    }

    if (yField.key) {
        const yKey = yField.key as string;
        if (geomType === "bar") {
            const rows = [{ __category: "", [yKey]: Number(props.data[0]?.[yKey] ?? 0) }];
            return {
                animation: false,
                backgroundColor: props.vegaConfig.background,
                color: [defaultColor],
                xAxis: { type: "category", data: [""], show: false },
                yAxis: {
                    type: "value",
                    name: yField.title,
                    nameLocation: "middle",
                    nameGap: 52,
                    nameTextStyle: { padding: [0, 0, 8, 0], fontWeight: 600 },
                },
                grid: { top: 24, right: 24, bottom: 24, left: 56, containLabel: true },
                ...createDatasetSeries({
                    rows,
                    series: {
                        type: "bar",
                        encode: { x: "__category", y: yKey },
                    },
                }),
            };
        }
        if (geomType === "line") {
            const value = Number(props.data[0]?.[yKey] ?? 0);
            const rows = [{ __x: 0, [yKey]: value }, { __x: 1, [yKey]: value }];
            return {
                animation: false,
                backgroundColor: props.vegaConfig.background,
                color: [defaultColor],
                xAxis: { type: "value", min: 0, max: 1, show: false },
                yAxis: {
                    type: "value",
                    name: yField.title,
                    nameLocation: "middle",
                    nameGap: 52,
                    nameTextStyle: { padding: [0, 0, 8, 0], fontWeight: 600 },
                    min: value - 1,
                    max: value + 1,
                    splitNumber: 2,
                    axisTick: { show: false },
                    axisLabel: {
                        formatter: (axisValue: number) => (Math.abs(axisValue - value) < 0.001 ? Intl.NumberFormat("en-US").format(Math.round(axisValue)) : ""),
                    },
                },
                grid: { top: 24, right: 24, bottom: 24, left: 84, containLabel: true },
                ...createDatasetSeries({
                    rows,
                    series: {
                        type: "line",
                        showSymbol: false,
                        lineStyle: { opacity: 0.08, width: 1 },
                        encode: { x: "__x", y: yKey },
                    },
                }),
            };
        }
        if (geomType === "point" || geomType === "circle") {
            const rows = sourceData.map((row) => ({
                ...row,
                __x: 0.5,
            }));
            return {
                animation: false,
                backgroundColor: props.vegaConfig.background,
                color: [defaultColor],
                xAxis: { type: "value", min: 0, max: 1, show: false },
                yAxis: {
                    type: "value",
                    name: yField.title,
                    nameLocation: "middle",
                    nameGap: 52,
                    nameTextStyle: { padding: [0, 0, 8, 0], fontWeight: 600 },
                    min: 0,
                    splitNumber: 10,
                },
                grid: { top: 24, right: 24, bottom: 24, left: 56, containLabel: true },
                ...createDatasetSeries({
                    rows,
                    series: {
                        type: "scatter",
                        symbol: geomType === "circle" ? "circle" : "emptyCircle",
                        symbolSize: 6,
                        encode: { x: "__x", y: yKey },
                    },
                }),
            };
        }
    }

    return null;
}
