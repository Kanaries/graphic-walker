import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { RendererPlugin, RendererPluginProps } from "@kanaries/graphic-walker";

type ViewField = RendererPluginProps["draggableFieldState"]["rows"][number];

type EChartsSeries = Record<string, any>;

type FacetCell = {
    rowIndex: number;
    colIndex: number;
    rowValue: any;
    colValue: any;
};

type FieldBinding = {
    key?: string;
    title?: string;
    field?: ViewField;
};

const SUPPORTED_GEOMS = new Set(["auto", "bar", "line", "area", "trail", "point", "circle", "tick", "rect", "arc", "text", "boxplot"]);

function axisTypeForField(field?: ViewField) {
    if (!field) return "value";
    if (field.semanticType === "quantitative") return "value";
    if (field.semanticType === "temporal") return "time";
    return "category";
}

function getFacetField(fields: ViewField[]) {
    const candidates = fields.slice(0, -1).filter(f => f.analyticType === "dimension");
    return candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
}

function uniqueValues(data: RendererPluginProps["data"], fid?: string) {
    if (!fid) return [null];
    const values = Array.from(new Set(data.map(row => row[fid])));
    return values.length > 0 ? values : [null];
}

function normalizeGeom(rawGeom: string, xField?: ViewField, yField?: ViewField) {
    if (rawGeom !== "auto") {
        return rawGeom === "trail" ? "line" : rawGeom;
    }
    if (!xField || !yField) {
        return "bar";
    }
    if (xField.semanticType === "quantitative" && yField.semanticType === "quantitative") {
        return "point";
    }
    if (
        (xField.semanticType === "temporal" && yField.semanticType === "quantitative") ||
        (yField.semanticType === "temporal" && xField.semanticType === "quantitative")
    ) {
        return "line";
    }
    return "bar";
}

function resolveDataKey(data: RendererPluginProps["data"], field?: ViewField) {
    if (!field) return undefined;
    const sample = data[0] ?? {};
    if (field.analyticType === "measure" && field.aggName) {
        const aggKey = `${field.fid}_${field.aggName}`;
        if (Object.prototype.hasOwnProperty.call(sample, aggKey)) {
            return aggKey;
        }
    }
    if (Object.prototype.hasOwnProperty.call(sample, field.fid)) {
        return field.fid;
    }
    const prefixed = Object.keys(sample).find(k => k.startsWith(`${field.fid}_`));
    return prefixed ?? field.fid;
}

function getFieldTitle(field?: ViewField) {
    if (!field) return undefined;
    const displayName = field.name || field.fid;
    if (field.analyticType === "measure" && field.aggName && field.aggName !== "expr") {
        return `${field.aggName}(${displayName})`;
    }
    return displayName;
}

function getFieldBinding(data: RendererPluginProps["data"], field?: ViewField): FieldBinding {
    if (!field) return {};
    return {
        field,
        key: resolveDataKey(data, field),
        title: getFieldTitle(field),
    };
}

function createTooltip(fields: Array<{ key: string; title: string }>) {
    return {
        trigger: "axis",
        formatter(params: any) {
            const rows = Array.isArray(params) ? params : [params];
            const data = rows[0]?.data ?? {};
            return fields.map(f => `${f.title}: ${data[f.key]}`).join("<br/>");
        },
    };
}

function createSeriesByGeom(params: {
    geomType: string;
    xField?: string;
    yField?: string;
    valueField?: string;
    textField?: string;
    datasetIndex: number;
    name?: string;
    xAxisIndex?: number;
    yAxisIndex?: number;
    symbol?: string;
}) {
    const { geomType, xField, yField, valueField, textField, datasetIndex, name, xAxisIndex = 0, yAxisIndex = 0, symbol } = params;

    const shared = {
        name,
        datasetIndex,
        xAxisIndex,
        yAxisIndex,
    };

    if (geomType === "line") {
        return {
            ...shared,
            type: "line",
            encode: { x: xField, y: yField },
        };
    }

    if (geomType === "area") {
        return {
            ...shared,
            type: "line",
            areaStyle: {},
            encode: { x: xField, y: yField },
        };
    }

    if (geomType === "point" || geomType === "circle") {
        return {
            ...shared,
            type: "scatter",
            symbol: symbol ?? (geomType === "circle" ? "circle" : "emptyCircle"),
            encode: { x: xField, y: yField },
        };
    }

    if (geomType === "tick") {
        return {
            ...shared,
            type: "scatter",
            symbol: symbol ?? "rect",
            symbolSize: 10,
            encode: { x: xField, y: yField },
        };
    }

    if (geomType === "text") {
        return {
            ...shared,
            type: "scatter",
            symbol: symbol ?? "circle",
            symbolSize: 8,
            label: {
                show: true,
                position: "top",
                color: "#333",
                fontSize: 10,
                formatter: (arg: any) => {
                    const datum = arg?.data ?? {};
                    return textField ? `${datum[textField] ?? ""}` : `${datum[yField ?? ""] ?? ""}`;
                },
            },
            labelLayout: {
                hideOverlap: false,
            },
            encode: { x: xField, y: yField },
        };
    }

    if (geomType === "rect") {
        return {
            ...shared,
            type: "scatter",
            symbol: symbol ?? "rect",
            symbolSize: 12,
            encode: { x: xField, y: yField, value: valueField ?? yField },
        };
    }

    if (geomType === "boxplot") {
        return {
            ...shared,
            type: "boxplot",
            encode: { x: xField, y: [valueField ?? yField, "q1", "median", "q3", "max"] },
        };
    }

    return {
        ...shared,
        type: "bar",
        encode: { x: xField, y: yField },
    };
}

function gridCell(rowIndex: number, colIndex: number, rowCount: number, colCount: number, rightReservePercent = 0) {
    const rowGap = 8;
    const colGap = 6;
    const usableWidth = Math.max(10, 100 - rightReservePercent);
    const top = rowIndex * (100 / rowCount) + rowGap / 2;
    const left = colIndex * (usableWidth / colCount) + colGap / 2;
    const width = usableWidth / colCount - colGap;
    const height = 100 / rowCount - rowGap;
    return {
        top: `${top}%`,
        left: `${left}%`,
        width: `${Math.max(width, 10)}%`,
        height: `${Math.max(height, 10)}%`,
        containLabel: true,
    };
}

function createDatasetTransforms(filters: Array<{ field: string; value: any }>) {
    return filters.map(({ field, value }) => ({
        type: "filter",
        config: {
            dimension: field,
            "=": value,
        },
    }));
}

function isScatterLikeGeom(geomType: string) {
    return geomType === "point" || geomType === "circle" || geomType === "tick" || geomType === "text" || geomType === "rect";
}

function isDiscreteField(field?: ViewField) {
    if (!field) return false;
    return field.analyticType === "dimension" || field.semanticType === "nominal" || field.semanticType === "ordinal";
}

const SHAPE_SYMBOLS = ["circle", "rect", "roundRect", "triangle", "diamond", "pin", "arrow"];

function symbolForShape(value: any) {
    const text = `${value ?? ""}`;
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return SHAPE_SYMBOLS[hash % SHAPE_SYMBOLS.length];
}

export function buildEChartsOption(props: RendererPluginProps) {
    const { rows, columns, color, opacity, size, shape, details, text, theta } = props.draggableFieldState;
    const xField = getFieldBinding(props.data, columns[columns.length - 1]);
    const yField = getFieldBinding(props.data, rows[rows.length - 1]);
    const colorField = getFieldBinding(props.data, color[0]);
    const opacityField = getFieldBinding(props.data, opacity[0]);
    const sizeField = getFieldBinding(props.data, size[0]);
    const shapeField = getFieldBinding(props.data, shape[0]);
    const thetaField = getFieldBinding(props.data, theta[0]);
    const textField = getFieldBinding(props.data, text[0]);
    const rawGeom = props.visualConfig.geoms[0] ?? "auto";
    const geomType = normalizeGeom(rawGeom, xField.field, yField.field);

    const cartesianGeom = geomType !== "arc";
    if (cartesianGeom && (!xField.key || !yField.key)) {
        return null;
    }

    const detailFields = details
        .map(f => getFieldBinding(props.data, f as ViewField))
        .filter((v): v is Required<Pick<FieldBinding, "key" | "title">> & FieldBinding => Boolean(v.key && v.title))
        .map(v => ({ key: v.key as string, title: v.title as string }));
    const tooltipFields = [xField, yField, colorField, opacityField, sizeField, shapeField]
        .filter((v): v is Required<Pick<FieldBinding, "key" | "title">> & FieldBinding => Boolean(v.key && v.title))
        .map(v => ({ key: v.key as string, title: v.title as string }))
        .concat(detailFields);
    const datasets: Array<Record<string, any>> = [{ source: props.data }];
    const series: EChartsSeries[] = [];

    if (geomType === "arc") {
        const categoryField = colorField.key || xField.key || getFieldBinding(props.data, columns[0]).key;
        const valueField = thetaField.key || yField.key || getFieldBinding(props.data, rows[0]).key;
        if (!categoryField || !valueField) {
            return null;
        }

        series.push({
            type: "pie",
            radius: "65%",
            center: ["50%", "50%"],
            datasetIndex: 0,
            encode: {
                itemName: categoryField,
                value: valueField,
                tooltip: [categoryField, valueField],
            },
            label: {
                formatter: "{b}: {d}%",
            },
        });

        return {
            animation: false,
            backgroundColor: props.vegaConfig.background,
            color: props.vegaConfig.range?.category,
            tooltip: { trigger: "item" },
            legend: { show: Boolean(categoryField) },
            dataset: datasets,
            series,
        };
    }

    const rowFacetField = getFacetField(rows);
    const colFacetField = getFacetField(columns);
    const rowFacetBinding = getFieldBinding(props.data, rowFacetField);
    const colFacetBinding = getFieldBinding(props.data, colFacetField);
    const rowFacetValues = uniqueValues(props.data, rowFacetBinding.key);
    const colFacetValues = uniqueValues(props.data, colFacetBinding.key);
    const useDiscreteColor = Boolean(colorField.key && isDiscreteField(colorField.field));
    const useDiscreteShape = Boolean(shapeField.key && isScatterLikeGeom(geomType) && isDiscreteField(shapeField.field));
    const showLegend = Boolean(useDiscreteColor || useDiscreteShape);
    const legendRightReserve = showLegend ? 18 : 0;
    const colorValues = useDiscreteColor ? uniqueValues(props.data, colorField.key) : [null];
    const shapeValues = useDiscreteShape ? uniqueValues(props.data, shapeField.key) : [null];

    const facetCells: FacetCell[] = [];
    for (let rowIndex = 0; rowIndex < rowFacetValues.length; rowIndex += 1) {
        for (let colIndex = 0; colIndex < colFacetValues.length; colIndex += 1) {
            facetCells.push({
                rowIndex,
                colIndex,
                rowValue: rowFacetValues[rowIndex],
                colValue: colFacetValues[colIndex],
            });
        }
    }

    const xAxes: Array<Record<string, any>> = [];
    const yAxes: Array<Record<string, any>> = [];
    const grids: Array<Record<string, any>> = [];

    facetCells.forEach((cell, cellIndex) => {
        grids.push(gridCell(cell.rowIndex, cell.colIndex, rowFacetValues.length, colFacetValues.length, legendRightReserve));
        xAxes.push({
            type: axisTypeForField(xField.field),
            name: xField.title,
            gridIndex: cellIndex,
            axisLabel: {
                hideOverlap: true,
            },
        });
        yAxes.push({
            type: axisTypeForField(yField.field),
            name: yField.title,
            gridIndex: cellIndex,
            axisLabel: {
                hideOverlap: true,
            },
        });

        colorValues.forEach(colorValue => {
            shapeValues.forEach(shapeValue => {
                const filters: Array<{ field: string; value: any }> = [];
                if (rowFacetBinding.key) filters.push({ field: rowFacetBinding.key, value: cell.rowValue });
                if (colFacetBinding.key) filters.push({ field: colFacetBinding.key, value: cell.colValue });
                if (useDiscreteColor && colorField.key && colorValue !== null) filters.push({ field: colorField.key, value: colorValue });
                if (useDiscreteShape && shapeField.key && shapeValue !== null) filters.push({ field: shapeField.key, value: shapeValue });

                const datasetIndex = filters.length > 0 ? datasets.length : 0;
                if (filters.length > 0) {
                    datasets.push({
                        fromDatasetIndex: 0,
                        transform: createDatasetTransforms(filters),
                    });
                }

                const resolvedMeasureForRect = sizeField.key || opacityField.key || yField.key;
                const seriesNameParts = [];
                if (useDiscreteColor && colorValue !== null) seriesNameParts.push(`${colorValue}`);
                if (useDiscreteShape && shapeValue !== null) seriesNameParts.push(`${shapeValue}`);
                series.push(
                    createSeriesByGeom({
                        geomType,
                        xField: xField.key,
                        yField: yField.key,
                        valueField: resolvedMeasureForRect,
                        textField: textField.key,
                        datasetIndex,
                        name: seriesNameParts.length > 0 ? seriesNameParts.join(" / ") : "default",
                        xAxisIndex: cellIndex,
                        yAxisIndex: cellIndex,
                        symbol: useDiscreteShape && shapeValue !== null ? symbolForShape(shapeValue) : undefined,
                    }),
                );
            });
        });
    });

    const visualMap: Array<Record<string, any>> = [];
    const seriesIndexes = series.map((_, idx) => idx);
    if (colorField.key && !useDiscreteColor) {
        visualMap.push({
            type: "continuous",
            dimension: colorField.key,
            seriesIndex: seriesIndexes,
            inRange: {
                color: props.vegaConfig.range?.heatmap || props.vegaConfig.range?.ramp || props.vegaConfig.range?.category,
            },
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 8,
        });
    }
    if (opacityField.key) {
        visualMap.push({
            type: "continuous",
            dimension: opacityField.key,
            seriesIndex: seriesIndexes,
            inRange: {
                opacity: [0.2, 1],
            },
            calculable: false,
            show: false,
        });
    }
    if (sizeField.key && isScatterLikeGeom(geomType)) {
        visualMap.push({
            type: "continuous",
            dimension: sizeField.key,
            seriesIndex: seriesIndexes,
            inRange: {
                symbolSize: [6, 28],
            },
            calculable: false,
            show: false,
        });
    }

    return {
        animation: false,
        backgroundColor: props.vegaConfig.background,
        color: props.vegaConfig.range?.category,
        tooltip: createTooltip(tooltipFields),
        legend: showLegend
            ? {
                  show: true,
                  orient: "vertical",
                  top: "middle",
                  right: "2%",
              }
            : { show: false },
        dataset: datasets,
        visualMap: visualMap.length > 0 ? visualMap : undefined,
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series,
    };
}

function EChartsView(props: RendererPluginProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const option = useMemo(() => buildEChartsOption(props), [props]);

    useEffect(() => {
        props.onReportSpec?.(JSON.stringify(option ?? { renderer: "plugin:echarts", unsupported: true }, null, 2));
        if (!ref.current || !option) {
            return;
        }

        let chart: any;
        try {
            chart = echarts.init(ref.current);
            chart.setOption(option, true);
        } catch (err) {
            console.warn("[graphic-walker] ECharts runtime is not installed or failed to load.", err);
        }

        return () => {
            props.onReportSpec?.("");
            chart?.dispose?.();
        };
    }, [option, props]);

    return <div ref={ref} style={{ width: "100%", height: "100%", minHeight: 160 }} />;
}

export function createEChartsPlugin(): RendererPlugin {
    return {
        id: "plugin:echarts",
        displayName: "ECharts",
        priority: 10,
        canRender: props => props.visualConfig.coordSystem !== "geographic" && SUPPORTED_GEOMS.has(props.visualConfig.geoms[0]),
        render: props => <EChartsView {...props} />,
    };
}
