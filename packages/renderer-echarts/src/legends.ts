import type { FieldBinding } from "./types";
import { axisTypeForField, isScatterLikeGeom, scaleRange, symbolForOrderedShape, VEGA_LITE_DEFAULT_CATEGORY_RANGE } from "./utils";

export function gridCell(rowIndex: number, colIndex: number, rowCount: number, colCount: number, rightReservePercent = 0, topReservePercent = 0, bottomReservePercent = 0, leftReservePercent = 0) {
    const rowGap = 8;
    const colGap = 6;
    const usableWidth = Math.max(10, 100 - rightReservePercent - leftReservePercent);
    const usableHeight = Math.max(10, 100 - topReservePercent - bottomReservePercent);
    const top = topReservePercent + rowIndex * (usableHeight / rowCount) + rowGap / 2;
    const left = leftReservePercent + colIndex * (usableWidth / colCount) + colGap / 2;
    const width = usableWidth / colCount - colGap;
    const height = usableHeight / rowCount - rowGap;
    return {
        top: `${top}%`,
        left: `${left}%`,
        width: `${Math.max(width, 10)}%`,
        height: `${Math.max(height, 10)}%`,
        containLabel: true,
    };
}

export function createAxisLabelOptions(axis: "x" | "y", isCategory: boolean) {
    return {
        hideOverlap: false,
        interval: isCategory ? 0 : "auto",
        rotate: isCategory ? (axis === "x" ? 90 : 0) : 0,
        margin: isCategory ? 12 : 8,
    };
}

function estimateCategoryLabelWidth(data?: any[]) {
    if (!data || data.length === 0) {
        return 72;
    }
    const maxChars = Math.max(...data.map((value) => String(value ?? "").length), 0);
    return Math.max(72, Math.min(240, maxChars * 7));
}

export function createXAxisOptions(field: FieldBinding, data: any[] | undefined, gridIndex: number) {
    const isCategory = axisTypeForField(field.field) === "category";
    return {
        type: axisTypeForField(field.field),
        name: field.title,
        nameLocation: "middle",
        nameGap: isCategory ? 62 : 34,
        nameTextStyle: {
            padding: [isCategory ? 30 : 18, 0, 0, 0],
        },
        gridIndex,
        data,
        axisLabel: createAxisLabelOptions("x", isCategory),
    };
}

export function createYAxisOptions(field: FieldBinding, data: any[] | undefined, gridIndex: number) {
    const isCategory = axisTypeForField(field.field) === "category";
    const categoryNameGap = estimateCategoryLabelWidth(data) + 24;
    return {
        type: axisTypeForField(field.field),
        name: field.title,
        nameLocation: "middle",
        nameGap: isCategory ? categoryNameGap : 52,
        nameTextStyle: {
            padding: [0, 0, 8, 0],
        },
        gridIndex,
        data,
        axisLabel: createAxisLabelOptions("y", isCategory),
    };
}

export function formatLegendNumber(value: number) {
    return Number.isFinite(value) ? Math.round(value).toLocaleString() : "";
}

export function formatValueLabel(value: number, format?: string) {
    if (!Number.isFinite(value)) {
        return "";
    }
    if (format === ".2s") {
        const abs = Math.abs(value);
        if (abs >= 1000) {
            const scaled = value / 1000;
            return abs >= 10000 ? `${Math.round(scaled)}k` : `${scaled.toFixed(1)}k`;
        }
    }
    return Math.round(value).toLocaleString();
}

export function getRightLegendLayout(chartWidth: number) {
    const panelLeft = Math.max(chartWidth - 182, chartWidth * 0.8);
    return {
        panelLeft,
        titleX: panelLeft,
        markerX: panelLeft + 8,
        labelX: panelLeft + 22,
    };
}

export function getDiscreteLegendBlockHeight(count: number, hasTitle: boolean) {
    if (count <= 0) return 0;
    return (hasTitle ? 24 : 0) + count * 22 + 12;
}

export function getQuantitativeLegendBlockHeight(count = 5, hasTitle = true, rowHeight = 30) {
    return (hasTitle ? 28 : 0) + count * rowHeight + 12;
}

function niceStep(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
        return 1;
    }
    const exponent = 10 ** Math.floor(Math.log10(value));
    const fraction = value / exponent;
    if (fraction <= 1) return exponent;
    if (fraction <= 2.5) return 2 * exponent;
    if (fraction <= 7.5) return 5 * exponent;
    return 10 * exponent;
}

function buildLegendValues(min: number, max: number, steps = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return [];
    }
    if (min === max) {
        return [min];
    }
    const step = niceStep((max - min) / Math.max(1, steps - 1));
    let start = Math.ceil(min / step) * step;
    if (start > max) {
        start = min;
    }
    const values: number[] = [];
    for (let index = 0; index < steps; index += 1) {
        const nextValue = start + index * step;
        if (nextValue > max + step * 0.25) {
            break;
        }
        values.push(nextValue);
    }
    if (values.length === 0 || values[values.length - 1] < max) {
        values.push(max);
    }
    return Array.from(new Set(values.map((value) => Math.round(value))));
}

export function buildOpacityLegendGraphic(params: {
    title?: string;
    min: number;
    max: number;
    chartWidth: number;
    chartHeight: number;
    startY?: number;
    filled?: boolean;
}) {
    const { title, min, max, chartWidth, chartHeight, startY: startYOverride, filled = false } = params;
    const layout = getRightLegendLayout(chartWidth);
    const startY = startYOverride ?? Math.max(68, chartHeight * 0.14);
    const values = buildLegendValues(min, max, 5);
    const children: Record<string, any>[] = [];
    if (title) {
        children.push({
            type: "text",
            style: {
                x: layout.titleX,
                y: startY - 28,
                text: title,
                fill: "#222",
                font: "600 12px sans-serif",
            },
        });
    }
    values.forEach((value, index) => {
        const opacity = scaleRange(value, min, max, 0.3, 0.8);
        const centerY = startY + index * 28;
        const legendColor = `rgba(107, 114, 128, ${opacity})`;
        children.push({
            type: "circle",
            shape: {
                cx: layout.markerX,
                cy: centerY,
                r: 5,
            },
            style: {
                fill: filled ? legendColor : "rgba(255,255,255,0)",
                stroke: legendColor,
                lineWidth: 1.5,
            },
        });
        children.push({
            type: "text",
            style: {
                x: layout.labelX,
                y: centerY,
                text: formatLegendNumber(value),
                fill: "#333",
                font: "12px sans-serif",
                textVerticalAlign: "middle",
            },
        });
    });
    return [{ type: "group", silent: true, children }];
}

export function buildSizeLegendGraphic(params: {
    title?: string;
    min: number;
    max: number;
    chartWidth: number;
    chartHeight: number;
    outMin: number;
    outMax: number;
    startY?: number;
    filled?: boolean;
    marker?: "circle" | "rect";
}) {
    const { title, min, max, chartWidth, chartHeight, outMin, outMax, startY: startYOverride, filled = false, marker = "circle" } = params;
    const layout = getRightLegendLayout(chartWidth);
    const startY = startYOverride ?? Math.max(68, chartHeight * 0.14);
    const values = buildLegendValues(min, max, 5);
    const children: Record<string, any>[] = [];
    if (title) {
        children.push({
            type: "text",
            style: {
                x: layout.titleX,
                y: startY - 28,
                text: title,
                fill: "#222",
                font: "600 12px sans-serif",
            },
        });
    }
    values.forEach((value, index) => {
        const centerY = startY + index * 30;
        const scaled = scaleRange(value, min, max, outMin, outMax);
        children.push(marker === "rect"
            ? {
                  type: "rect",
                  shape: {
                      x: layout.markerX - scaled / 2,
                      y: centerY - 8,
                      width: scaled,
                      height: 16,
                      r: 1,
                  },
                  style: {
                      stroke: filled ? "rgba(0,0,0,0)" : "#666",
                      fill: filled ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.75)",
                      lineWidth: 1.5,
                  },
              }
            : {
                  type: "circle",
                  shape: {
                      cx: layout.markerX,
                      cy: centerY,
                      r: scaled / 2,
                  },
                  style: {
                      stroke: filled ? "rgba(0,0,0,0)" : "#666",
                      fill: filled ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.75)",
                      lineWidth: 1.5,
                  },
              });
        children.push({
            type: "text",
            style: {
                x: layout.labelX,
                y: centerY,
                text: formatLegendNumber(value),
                fill: "#333",
                font: "12px sans-serif",
                textVerticalAlign: "middle",
            },
        });
    });
    return [{ type: "group", silent: true, children }];
}

export function buildDiscreteColorLegendGraphic(params: {
    title?: string;
    values: any[];
    palette?: string[];
    chartWidth: number;
    startY: number;
    hollow?: boolean;
}) {
    const { title, values, palette = VEGA_LITE_DEFAULT_CATEGORY_RANGE, chartWidth, startY, hollow = false } = params;
    const layout = getRightLegendLayout(chartWidth);
    const children: Record<string, any>[] = [];
    if (title) {
        children.push({
            type: "text",
            style: {
                x: layout.titleX,
                y: startY,
                text: title,
                fill: "#222",
                font: "600 12px sans-serif",
            },
        });
    }
    values.forEach((value, index) => {
        const centerY = startY + 20 + index * 22;
        children.push({
            type: "circle",
            shape: { cx: layout.markerX, cy: centerY, r: 6 },
            style: {
                fill: hollow ? "rgba(255,255,255,0)" : palette[index % Math.max(1, palette.length)],
                stroke: hollow ? palette[index % Math.max(1, palette.length)] : undefined,
                lineWidth: hollow ? 1.5 : undefined,
            },
        });
        children.push({
            type: "text",
            style: {
                x: layout.labelX,
                y: centerY,
                text: String(value),
                fill: "#333",
                font: "12px sans-serif",
                textVerticalAlign: "middle",
            },
        });
    });
    return [{ type: "group", silent: true, children }];
}

export function buildDiscreteShapeLegendGraphic(params: {
    title?: string;
    values: any[];
    chartWidth: number;
    startY: number;
    hollow?: boolean;
}) {
    const { title, values, chartWidth, startY, hollow = false } = params;
    const layout = getRightLegendLayout(chartWidth);
    const children: Record<string, any>[] = [];
    if (title) {
        children.push({
            type: "text",
            style: {
                x: layout.titleX,
                y: startY,
                text: title,
                fill: "#222",
                font: "600 12px sans-serif",
            },
        });
    }
    values.forEach((value, index) => {
        const centerY = startY + 20 + index * 22;
        const symbol = symbolForOrderedShape(value, values);
        if (symbol === "rect" || symbol === "roundRect") {
            children.push({
                type: "rect",
                shape: { x: layout.markerX - 6, y: centerY - 6, width: 12, height: 12, r: symbol === "roundRect" ? 2 : 0 },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        } else if (symbol === "triangle") {
            children.push({
                type: "polygon",
                shape: { points: [[layout.markerX, centerY - 7], [layout.markerX + 6, centerY + 3], [layout.markerX - 6, centerY + 3]] },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        } else if (symbol === "diamond") {
            children.push({
                type: "polygon",
                shape: { points: [[layout.markerX, centerY - 6], [layout.markerX + 6, centerY], [layout.markerX, centerY + 6], [layout.markerX - 6, centerY]] },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        } else {
            children.push({
                type: "circle",
                shape: { cx: layout.markerX, cy: centerY, r: 6 },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        }
        children.push({
            type: "text",
            style: {
                x: layout.labelX,
                y: centerY,
                text: String(value),
                fill: "#333",
                font: "12px sans-serif",
                textVerticalAlign: "middle",
            },
        });
    });
    return [{ type: "group", silent: true, children }];
}

export function buildDiscreteOpacityLegendGraphic(params: {
    title?: string;
    values: any[];
    chartWidth: number;
    startY: number;
    filled?: boolean;
    marker?: "circle" | "rect" | "line";
}) {
    const { title, values, chartWidth, startY, filled = false, marker = "circle" } = params;
    const layout = getRightLegendLayout(chartWidth);
    const children: Record<string, any>[] = [];
    if (title) {
        children.push({
            type: "text",
            style: { x: layout.titleX, y: startY, text: title, fill: "#222", font: "600 12px sans-serif" },
        });
    }
    values.forEach((value, index) => {
        const centerY = startY + 20 + index * 22;
        const opacity = scaleRange(index, 0, Math.max(1, values.length - 1), 0.25, 1);
        const legendColor = `rgba(107, 114, 128, ${opacity})`;
        children.push(marker === "line"
            ? {
                  type: "line",
                  shape: { x1: layout.markerX - 7, y1: centerY, x2: layout.markerX + 7, y2: centerY },
                  style: {
                      stroke: legendColor,
                      lineWidth: 2.2,
                      lineCap: "round",
                  },
              }
            : marker === "rect"
              ? {
                    type: "rect",
                    shape: { x: layout.markerX - 6, y: centerY - 6, width: 12, height: 12, r: 1.5 },
                    style: {
                        fill: filled ? legendColor : "rgba(255,255,255,0)",
                        stroke: legendColor,
                        lineWidth: 1.5,
                    },
                }
              : {
                    type: "circle",
                    shape: { cx: layout.markerX, cy: centerY, r: 6 },
                    style: {
                        fill: filled ? legendColor : "rgba(255,255,255,0)",
                        stroke: legendColor,
                        lineWidth: 1.5,
                    },
                });
        children.push({
            type: "text",
            style: { x: layout.labelX, y: centerY, text: String(value), fill: "#333", font: "12px sans-serif", textVerticalAlign: "middle" },
        });
    });
    return [{ type: "group", silent: true, children }];
}

export function buildDiscreteSizeLegendGraphic(params: {
    title?: string;
    values: any[];
    chartWidth: number;
    startY: number;
    outMin: number;
    outMax: number;
    filled?: boolean;
}) {
    const { title, values, chartWidth, startY, outMin, outMax, filled = false } = params;
    const layout = getRightLegendLayout(chartWidth);
    const children: Record<string, any>[] = [];
    if (title) {
        children.push({
            type: "text",
            style: { x: layout.titleX, y: startY, text: title, fill: "#222", font: "600 12px sans-serif" },
        });
    }
    values.forEach((value, index) => {
        const centerY = startY + 20 + index * 22;
        const radius = scaleRange(index, 0, Math.max(1, values.length - 1), outMin / 2, outMax / 2);
        children.push({
            type: "circle",
            shape: { cx: layout.markerX, cy: centerY, r: radius },
            style: {
                stroke: filled ? "rgba(0,0,0,0)" : "#666",
                fill: filled ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.75)",
                lineWidth: 1.5,
            },
        });
        children.push({
            type: "text",
            style: { x: layout.labelX, y: centerY, text: String(value), fill: "#333", font: "12px sans-serif", textVerticalAlign: "middle" },
        });
    });
    return [{ type: "group", silent: true, children }];
}

export function visualConfigNeedsBottomReserve(
    geomType: string,
    _colorField: FieldBinding,
    _useDiscreteColor: boolean,
    opacityField: FieldBinding,
    sizeField: FieldBinding,
) {
    return Boolean(opacityField.key || (sizeField.key && isScatterLikeGeom(geomType)));
}
