import type { FieldBinding } from "./types";
import { axisTypeForField, isScatterLikeGeom, scaleRange, symbolForOrderedShape } from "./utils";

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
    return {
        type: axisTypeForField(field.field),
        name: field.title,
        nameLocation: "middle",
        nameGap: 52,
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

export function getRightLegendLayout(chartWidth: number) {
    const panelLeft = Math.max(chartWidth - 168, chartWidth * 0.8);
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
        const opacity = scaleRange(value, min, max, 0.18, 1);
        children.push({
            type: "circle",
            shape: {
                cx: layout.markerX,
                cy: startY + index * 28,
                r: 5,
            },
            style: {
                fill: filled ? `rgba(0, 0, 0, ${opacity})` : "rgba(255,255,255,0)",
                stroke: `rgba(0, 0, 0, ${opacity})`,
                lineWidth: 1.5,
            },
        });
        children.push({
            type: "text",
            style: {
                x: layout.labelX,
                y: startY + index * 28 + 4,
                text: formatLegendNumber(value),
                fill: "#333",
                font: "12px sans-serif",
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
}) {
    const { title, min, max, chartWidth, chartHeight, outMin, outMax, startY: startYOverride, filled = false } = params;
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
        children.push({
            type: "circle",
            shape: {
                cx: layout.markerX,
                cy: startY + index * 30,
                r: scaleRange(value, min, max, outMin / 2, outMax / 2),
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
                y: startY + index * 30 + 4,
                text: formatLegendNumber(value),
                fill: "#333",
                font: "12px sans-serif",
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
    const { title, values, palette = ["#5B8FF9", "#61DDAA"], chartWidth, startY, hollow = false } = params;
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
        const y = startY + 24 + index * 22;
        children.push({
            type: "circle",
            shape: { cx: layout.markerX, cy: y - 4, r: 6 },
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
                y,
                text: String(value),
                fill: "#333",
                font: "12px sans-serif",
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
        const y = startY + 24 + index * 22;
        const symbol = symbolForOrderedShape(value, values);
        if (symbol === "rect" || symbol === "roundRect") {
            children.push({
                type: "rect",
                shape: { x: layout.markerX - 6, y: y - 10, width: 12, height: 12, r: symbol === "roundRect" ? 2 : 0 },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        } else if (symbol === "triangle") {
            children.push({
                type: "polygon",
                shape: { points: [[layout.markerX, y - 12], [layout.markerX + 6, y - 2], [layout.markerX - 6, y - 2]] },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        } else if (symbol === "diamond") {
            children.push({
                type: "polygon",
                shape: { points: [[layout.markerX, y - 12], [layout.markerX + 6, y - 6], [layout.markerX, y], [layout.markerX - 6, y - 6]] },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        } else {
            children.push({
                type: "circle",
                shape: { cx: layout.markerX, cy: y - 6, r: 6 },
                style: hollow ? { fill: "rgba(255,255,255,0)", stroke: "#666", lineWidth: 1.5 } : { fill: "#666" },
            });
        }
        children.push({
            type: "text",
            style: {
                x: layout.labelX,
                y,
                text: String(value),
                fill: "#333",
                font: "12px sans-serif",
            },
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
