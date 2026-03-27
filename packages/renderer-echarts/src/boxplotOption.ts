import type { RendererPluginProps } from "@kanaries/graphic-walker";

import type { FieldBinding } from "./types";
import { axisTypeForField, colorWithAlpha, compareValue, quantile } from "./utils";

function buildBoxplotSeriesData(params: {
    rows: RendererPluginProps["data"];
    xValues: any[];
    xKey: string;
    yKey: string;
    colorKey?: string;
    colorValues?: any[];
}) {
    const { rows, xValues, xKey, yKey, colorKey, colorValues = [null] } = params;
    const grouped = new Map<string, number[]>();
    for (const row of rows) {
        const xVal = row[xKey];
        const cVal = colorKey ? row[colorKey] : null;
        const key = `${String(cVal)}__${String(xVal)}`;
        const value = Number(row[yKey]);
        if (!Number.isFinite(value)) continue;
        const list = grouped.get(key) ?? [];
        list.push(value);
        grouped.set(key, list);
    }

    return colorValues.map((colorValue) => {
        const boxData = xValues.map((xValue) => {
            const values = [...(grouped.get(`${String(colorValue)}__${String(xValue)}`) ?? [])].sort((a, b) => a - b);
            if (values.length === 0) return [NaN, NaN, NaN, NaN, NaN];
            const q1 = quantile(values, 0.25);
            const median = quantile(values, 0.5);
            const q3 = quantile(values, 0.75);
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            const inliers = values.filter((value) => value >= lowerFence && value <= upperFence);
            const lowerWhisker = inliers.length ? inliers[0] : values[0];
            const upperWhisker = inliers.length ? inliers[inliers.length - 1] : values[values.length - 1];
            return [xValue, lowerWhisker, q1, median, q3, upperWhisker];
        });
        const outliers = xValues.flatMap((xValue) => {
            const values = [...(grouped.get(`${String(colorValue)}__${String(xValue)}`) ?? [])].sort((a, b) => a - b);
            if (values.length === 0) return [];
            const q1 = quantile(values, 0.25);
            const q3 = quantile(values, 0.75);
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            return values.filter((value) => value < lowerFence || value > upperFence).map((value) => [xValue, value]);
        });
        return { boxData, outliers };
    });
}

function buildCustomBoxplotSeriesData(params: {
    rows: RendererPluginProps["data"];
    xValues: any[];
    xKey: string;
    yKey: string;
    colorKey: string;
    colorValues: any[];
}) {
    const { rows, xValues, xKey, yKey, colorKey, colorValues } = params;
    const grouped = new Map<string, number[]>();
    for (const row of rows) {
        const xVal = row[xKey];
        const cVal = row[colorKey];
        const key = `${String(cVal)}__${String(xVal)}`;
        const value = Number(row[yKey]);
        if (!Number.isFinite(value)) continue;
        const list = grouped.get(key) ?? [];
        list.push(value);
        grouped.set(key, list);
    }

    return colorValues.map((colorValue) => {
        const boxData = xValues.flatMap((xValue) => {
            const values = [...(grouped.get(`${String(colorValue)}__${String(xValue)}`) ?? [])].sort((a, b) => a - b);
            if (values.length === 0) return [];
            const q1 = quantile(values, 0.25);
            const median = quantile(values, 0.5);
            const q3 = quantile(values, 0.75);
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            const inliers = values.filter((value) => value >= lowerFence && value <= upperFence);
            const lowerWhisker = inliers.length ? inliers[0] : values[0];
            const upperWhisker = inliers.length ? inliers[inliers.length - 1] : values[values.length - 1];
            return [[xValue, lowerWhisker, q1, median, q3, upperWhisker]];
        });
        const outliers = xValues.flatMap((xValue) => {
            const values = [...(grouped.get(`${String(colorValue)}__${String(xValue)}`) ?? [])].sort((a, b) => a - b);
            if (values.length === 0) return [];
            const q1 = quantile(values, 0.25);
            const q3 = quantile(values, 0.75);
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            return values.filter((value) => value < lowerFence || value > upperFence).map((value) => [xValue, value]);
        });
        return { boxData, outliers };
    });
}

export function buildBoxplotOption(params: {
    props: RendererPluginProps;
    sourceData: RendererPluginProps["data"];
    xField: FieldBinding;
    yField: FieldBinding;
    colorField: FieldBinding;
    useDiscreteColor: boolean;
    colorValues: any[];
    xValues: any[];
    categoryPalette: string[];
}) {
    const { props, sourceData, xField, yField, colorField, useDiscreteColor, colorValues, xValues, categoryPalette } = params;
    if (!(xField.key && yField.key)) {
        return undefined;
    }
    const horizontal = axisTypeForField(xField.field) === "value" && axisTypeForField(yField.field) === "category";
    const categoryField = horizontal ? yField : xField;
    const valueField = horizontal ? xField : yField;
    const categoryValues = horizontal
        ? Array.from(new Set(sourceData.map((row) => row[categoryField.key as string]))).sort(compareValue)
        : xValues;

    const createBoxplotAxes = () => horizontal
        ? {
              xAxis: {
                  type: "value",
                  name: valueField.title,
                  nameLocation: "middle",
                  nameGap: 34,
                  nameTextStyle: { fontWeight: 600 },
              },
              yAxis: {
                  type: "category",
                  name: categoryField.title,
                  nameLocation: "middle",
                  nameGap: 52,
                  nameTextStyle: { fontWeight: 600 },
                  data: categoryValues,
                  axisLabel: { interval: 0, rotate: 0, margin: 10 },
                  inverse: true,
              },
          }
        : {
              xAxis: {
                  type: "category",
                  name: categoryField.title,
                  nameLocation: "middle",
                  nameGap: 34,
                  data: categoryValues,
                  nameTextStyle: { fontWeight: 600 },
                  axisLabel: { interval: 0, rotate: 90, margin: 10 },
              },
              yAxis: {
                  type: "value",
                  name: valueField.title,
                  nameLocation: "middle",
                  nameGap: 52,
                  nameTextStyle: { fontWeight: 600 },
              },
          };

    if (useDiscreteColor && colorField.key) {
        const customBoxplotData = buildCustomBoxplotSeriesData({
            rows: props.data,
            xValues: categoryValues,
            xKey: categoryField.key,
            yKey: valueField.key,
            colorKey: colorField.key,
            colorValues,
        });
        const datasets: Array<Record<string, any>> = [];
        const axes = createBoxplotAxes();

        return {
            animation: false,
            backgroundColor: props.vegaConfig.background,
            color: categoryPalette,
            tooltip: { trigger: "item" },
            legend: {
                show: true,
                orient: "vertical",
                top: 12,
                right: 12,
                type: "scroll",
                data: colorValues.map((value) => String(value)),
            },
            grid: {
                top: 48,
                right: 120,
                bottom: 64,
                left: 64,
                containLabel: true,
            },
            ...axes,
            dataset: datasets,
            series: customBoxplotData.flatMap((entry, index) => {
                const name = String(colorValues[index]);
                const seriesColor = categoryPalette[index % Math.max(1, categoryPalette.length)] ?? "#5B8FF9";
                const boxDatasetIndex = datasets.push({ source: entry.boxData }) - 1;
                const outlierDatasetIndex = datasets.push({ source: entry.outliers }) - 1;
                return [
                    {
                        type: "custom",
                        name,
                        datasetIndex: boxDatasetIndex,
                        encode: horizontal ? { x: [1, 2, 3, 4, 5], y: 0 } : { x: 0, y: [1, 2, 3, 4, 5] },
                        renderItem(_params: any, api: any) {
                            const categoryValue = api.value(0);
                            const low = Number(api.value(1));
                            const q1 = Number(api.value(2));
                            const median = Number(api.value(3));
                            const q3 = Number(api.value(4));
                            const high = Number(api.value(5));
                            const centerCoord = horizontal ? api.coord([median, categoryValue]) : api.coord([categoryValue, median]);
                            const lowPoint = horizontal ? api.coord([low, categoryValue]) : api.coord([categoryValue, low]);
                            const q1Point = horizontal ? api.coord([q1, categoryValue]) : api.coord([categoryValue, q1]);
                            const medianPoint = horizontal ? api.coord([median, categoryValue]) : api.coord([categoryValue, median]);
                            const q3Point = horizontal ? api.coord([q3, categoryValue]) : api.coord([categoryValue, q3]);
                            const highPoint = horizontal ? api.coord([high, categoryValue]) : api.coord([categoryValue, high]);
                            const bandWidth = Math.abs(horizontal ? (api.size([0, 1])[1] ?? 36) : (api.size([1, 0])[0] ?? 36));
                            const boxWidth = Math.max(18, Math.min(36, bandWidth * 0.34));
                            const whiskerWidth = boxWidth * 0.7;
                            return {
                                type: "group",
                                children: horizontal
                                    ? [
                                          { type: "line", shape: { x1: lowPoint[0], y1: centerCoord[1], x2: q1Point[0], y2: centerCoord[1] }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          { type: "line", shape: { x1: q3Point[0], y1: centerCoord[1], x2: highPoint[0], y2: centerCoord[1] }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          { type: "line", shape: { x1: lowPoint[0], y1: centerCoord[1] - whiskerWidth / 2, x2: lowPoint[0], y2: centerCoord[1] + whiskerWidth / 2 }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          { type: "line", shape: { x1: highPoint[0], y1: centerCoord[1] - whiskerWidth / 2, x2: highPoint[0], y2: centerCoord[1] + whiskerWidth / 2 }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          {
                                              type: "rect",
                                              shape: {
                                                  x: q1Point[0],
                                                  y: centerCoord[1] - boxWidth / 2,
                                                  width: Math.max(1, q3Point[0] - q1Point[0]),
                                                  height: boxWidth,
                                              },
                                              style: {
                                                  fill: colorWithAlpha(seriesColor, 0.45),
                                                  stroke: seriesColor,
                                                  lineWidth: 1.5,
                                              },
                                          },
                                          { type: "line", shape: { x1: medianPoint[0], y1: centerCoord[1] - boxWidth / 2, x2: medianPoint[0], y2: centerCoord[1] + boxWidth / 2 }, style: { stroke: seriesColor, lineWidth: 2 } },
                                      ]
                                    : [
                                          { type: "line", shape: { x1: centerCoord[0], y1: lowPoint[1], x2: centerCoord[0], y2: q1Point[1] }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          { type: "line", shape: { x1: centerCoord[0], y1: q3Point[1], x2: centerCoord[0], y2: highPoint[1] }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          { type: "line", shape: { x1: centerCoord[0] - whiskerWidth / 2, y1: lowPoint[1], x2: centerCoord[0] + whiskerWidth / 2, y2: lowPoint[1] }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          { type: "line", shape: { x1: centerCoord[0] - whiskerWidth / 2, y1: highPoint[1], x2: centerCoord[0] + whiskerWidth / 2, y2: highPoint[1] }, style: { stroke: seriesColor, lineWidth: 1.5 } },
                                          {
                                              type: "rect",
                                              shape: {
                                                  x: centerCoord[0] - boxWidth / 2,
                                                  y: q3Point[1],
                                                  width: boxWidth,
                                                  height: Math.max(1, q1Point[1] - q3Point[1]),
                                              },
                                              style: {
                                                  fill: colorWithAlpha(seriesColor, 0.45),
                                                  stroke: seriesColor,
                                                  lineWidth: 1.5,
                                              },
                                          },
                                          { type: "line", shape: { x1: centerCoord[0] - boxWidth / 2, y1: medianPoint[1], x2: centerCoord[0] + boxWidth / 2, y2: medianPoint[1] }, style: { stroke: seriesColor, lineWidth: 2 } },
                                      ],
                            };
                        },
                        z: index + 1,
                    },
                    {
                        type: "scatter",
                        name: `${name}-outlier`,
                        datasetIndex: outlierDatasetIndex,
                        encode: horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 },
                        symbolSize: 7,
                        itemStyle: {
                            color: "rgba(255,255,255,0)",
                            borderColor: seriesColor,
                            borderWidth: 1.6,
                        },
                        tooltip: { show: false },
                        z: index + 2,
                    },
                ];
            }),
        };
    }

    const boxplotData = buildBoxplotSeriesData({
        rows: sourceData,
        xValues: categoryValues,
        xKey: categoryField.key,
        yKey: valueField.key,
        colorKey: useDiscreteColor ? colorField.key : undefined,
        colorValues: useDiscreteColor ? colorValues : [null],
    });
    const datasets: Array<Record<string, any>> = [];
    const axes = createBoxplotAxes();

    return {
        animation: false,
        backgroundColor: props.vegaConfig.background,
        color: categoryPalette,
        tooltip: { trigger: "item" },
        legend: useDiscreteColor
            ? {
                  show: true,
                  orient: "vertical",
                  top: 12,
                  right: 12,
                  type: "scroll",
                  data: colorValues.map((value) => String(value)),
              }
            : { show: false },
        grid: {
            top: 24,
            right: useDiscreteColor ? 120 : 24,
            bottom: 64,
            left: 56,
            containLabel: true,
        },
        ...axes,
        dataset: datasets,
        series: boxplotData.flatMap((entry, index) => {
            const name = useDiscreteColor ? String(colorValues[index]) : "default";
            const seriesColor = categoryPalette[index % Math.max(1, categoryPalette.length)] ?? "#5B8FF9";
            const boxDatasetIndex = datasets.push({ source: entry.boxData }) - 1;
            const outlierDatasetIndex = datasets.push({ source: entry.outliers }) - 1;
            return [
                {
                    type: "boxplot",
                    name,
                    datasetIndex: boxDatasetIndex,
                    encode: horizontal ? { x: [1, 2, 3, 4, 5], y: 0 } : { x: 0, y: [1, 2, 3, 4, 5] },
                    boxWidth: useDiscreteColor ? [18, 36] : [28, 54],
                    itemStyle: {
                        color: useDiscreteColor ? colorWithAlpha(seriesColor, 0.45) : seriesColor,
                        borderColor: useDiscreteColor ? seriesColor : "#333",
                        borderWidth: 1.1,
                    },
                    lineStyle: { color: "#333", width: 1.1 },
                },
                {
                    type: "scatter",
                    name: `${name}-outlier`,
                    datasetIndex: outlierDatasetIndex,
                    encode: horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 },
                    symbolSize: 7,
                    itemStyle: {
                        color: "rgba(255,255,255,0)",
                        borderColor: seriesColor,
                        borderWidth: 1.6,
                    },
                    tooltip: { show: false },
                },
            ];
        }),
    };
}
