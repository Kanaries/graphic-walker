import type { RendererPluginProps } from "@kanaries/graphic-walker";

import type { FieldBinding, PreparedCartesianState, ValueOrder, ViewField } from "./types";

export const SUPPORTED_GEOMS = new Set(["auto", "bar", "line", "area", "trail", "point", "circle", "tick", "rect", "arc", "text", "boxplot"]);
export const DISCRETE_COLOR_SCHEMES: Record<string, string[]> = {
    accent: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"],
    category10: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
    dark2: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"],
    paired: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"],
    pastel1: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec", "#f2f2f2"],
    pastel2: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae", "#f1e2cc", "#cccccc"],
    set1: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"],
    set2: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"],
    set3: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"],
    tableau10: ["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab"],
};

export const SHAPE_SYMBOLS = ["circle", "rect", "roundRect", "triangle", "diamond", "pin", "arrow"];

export function axisTypeForField(field?: ViewField) {
    if (!field) return "value";
    if (field.semanticType === "quantitative") return "value";
    if (field.semanticType === "temporal") return "time";
    return "category";
}

export function getFacetField(fields: ViewField[]) {
    const candidates = fields.slice(0, -1).filter((field) => field.analyticType === "dimension");
    return candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
}

export function isDiscreteField(field?: ViewField) {
    if (!field) return false;
    return field.analyticType === "dimension" || field.semanticType === "nominal" || field.semanticType === "ordinal";
}

export function uniqueValues(data: RendererPluginProps["data"], fid?: string) {
    if (!fid) return [null];
    const values = Array.from(new Set(data.map((row) => row[fid])));
    return values.length > 0 ? values : [null];
}

export function compareValue(a: any, b: any) {
    const aNum = typeof a === "number" ? a : Number(a);
    const bNum = typeof b === "number" ? b : Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return aNum - bNum;
    }
    const aTime = a instanceof Date ? a.getTime() : Date.parse(String(a));
    const bTime = b instanceof Date ? b.getTime() : Date.parse(String(b));
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
        return aTime - bTime;
    }
    return String(a ?? "").localeCompare(String(b ?? ""));
}

export function orderedUniqueValues(data: RendererPluginProps["data"], binding?: FieldBinding) {
    const values = uniqueValues(data, binding?.key);
    if (!binding?.field || !isDiscreteField(binding.field)) {
        return values;
    }
    return [...values].sort(compareValue);
}

export function createValueOrder(values: any[]): ValueOrder {
    return new Map(values.map((value, index) => [String(value), index]));
}

export function parsePercent(value?: string) {
    return typeof value === "string" && value.endsWith("%") ? Number.parseFloat(value) : 0;
}

export function isSyntheticMeasureFacetField(field?: ViewField) {
    return Boolean(field?.analyticType === "dimension" && typeof field.fid === "string" && /^__facet_[xy]_measure__$/.test(field.fid));
}

export function compareFieldValue(a: any, b: any, field?: ViewField, order?: ValueOrder) {
    if (field && isDiscreteField(field)) {
        const aRank = order?.get(String(a)) ?? Number.MAX_SAFE_INTEGER;
        const bRank = order?.get(String(b)) ?? Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) {
            return aRank - bRank;
        }
    }
    return compareValue(a, b);
}

export function sortSourceData(
    data: RendererPluginProps["data"],
    bindings: {
        rowFacet?: FieldBinding;
        colFacet?: FieldBinding;
        color?: FieldBinding;
        shape?: FieldBinding;
        x?: FieldBinding;
        y?: FieldBinding;
    },
    orders: {
        rowFacet?: ValueOrder;
        colFacet?: ValueOrder;
        color?: ValueOrder;
        shape?: ValueOrder;
        x?: ValueOrder;
        y?: ValueOrder;
    },
) {
    return [...data].sort((left, right) => {
        const steps: Array<[FieldBinding | undefined, ValueOrder | undefined]> = [
            [bindings.rowFacet, orders.rowFacet],
            [bindings.colFacet, orders.colFacet],
            [bindings.color, orders.color],
            [bindings.shape, orders.shape],
            [bindings.x, orders.x],
            [bindings.y, orders.y],
        ];

        for (const [binding, order] of steps) {
            if (!binding?.key) continue;
            const result = compareFieldValue(left[binding.key], right[binding.key], binding.field, order);
            if (result !== 0) {
                return result;
            }
        }

        return 0;
    });
}

export function normalizeGeom(rawGeom: string, xField?: ViewField, yField?: ViewField) {
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

export function resolveDataKey(data: RendererPluginProps["data"], field?: ViewField) {
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
    const prefixed = Object.keys(sample).find((key) => key.startsWith(`${field.fid}_`));
    return prefixed ?? field.fid;
}

export function getFieldTitle(field?: ViewField) {
    if (!field) return undefined;
    return field.name || field.fid;
}

export function getFieldBinding(data: RendererPluginProps["data"], field?: ViewField): FieldBinding {
    if (!field) return {};
    const key = resolveDataKey(data, field);
    const baseTitle = getFieldTitle(field);
    return {
        field,
        key,
        title: field.analyticType === "measure" && field.aggName && key === `${field.fid}_${field.aggName}` ? `${field.aggName}(${baseTitle})` : baseTitle,
    };
}

export function createSyntheticField(fid: string, name: string, analyticType: ViewField["analyticType"], semanticType: ViewField["semanticType"]): ViewField {
    return {
        fid,
        name,
        analyticType,
        semanticType,
    } as ViewField;
}

export function prepareAxisFields(params: {
    data: RendererPluginProps["data"];
    fields: ViewField[];
    axis: "x" | "y";
}) {
    const { data, fields, axis } = params;
    if (fields.length <= 1) {
        return { data, fields };
    }

    const dimensionFields = fields.filter((field) => field.analyticType === "dimension");
    const measureFields = fields.filter((field) => field.analyticType === "measure");
    const measureBindings = measureFields.map((field) => ({
        field,
        key: resolveDataKey(data, field) ?? field.fid,
        title: getFieldBinding(data, field).title ?? getFieldTitle(field) ?? field.fid,
    }));

    if (measureFields.length === 0) {
        return { data, fields };
    }

    const singleMeasureTitle = measureBindings.length === 1 ? measureBindings[0].title : undefined;
    const syntheticAxisField = createSyntheticField(
        `__facet_${axis}_value__`,
        singleMeasureTitle ?? (axis === "x" ? "x" : "y"),
        "measure",
        "quantitative",
    );
    const syntheticMeasureFacetField =
        measureFields.length > 1
            ? createSyntheticField(
                  `__facet_${axis}_measure__`,
                  axis === "x" ? "column measure" : "row measure",
                  "dimension",
                  "nominal",
              )
            : undefined;

    const expandedData = data.flatMap((row) => {
        const candidates = measureBindings.length > 1 ? measureBindings : [measureBindings[measureBindings.length - 1]];
        return candidates.map(({ key, title }) => {
            const nextRow = { ...row } as Record<string, any>;
            nextRow[syntheticAxisField.fid] = row[key];
            if (syntheticMeasureFacetField) {
                nextRow[syntheticMeasureFacetField.fid] = title;
            }
            return nextRow;
        });
    });

    return {
        data: expandedData,
        fields: [
            ...dimensionFields,
            ...(syntheticMeasureFacetField ? [syntheticMeasureFacetField] : []),
            syntheticAxisField,
        ],
    };
}

export function prepareCartesianState(props: RendererPluginProps): PreparedCartesianState {
    const preparedColumns = prepareAxisFields({
        data: props.data,
        fields: props.draggableFieldState.columns as ViewField[],
        axis: "x",
    });
    const preparedRows = prepareAxisFields({
        data: preparedColumns.data,
        fields: props.draggableFieldState.rows as ViewField[],
        axis: "y",
    });
    return {
        data: preparedRows.data,
        rows: preparedRows.fields,
        columns: preparedColumns.fields,
    };
}

export function createTooltip(fields: Array<{ key: string; title: string }>) {
    return {
        trigger: "axis",
        formatter(params: any) {
            const rows = Array.isArray(params) ? params : [params];
            const data = rows[0]?.data ?? {};
            return fields.map((field) => `${field.title}: ${data[field.key]}`).join("<br/>");
        },
    };
}

export function createDatasetTransforms(filters: Array<{ field: string; value: any }>) {
    return filters.map(({ field, value }) => ({
        type: "filter",
        config: {
            dimension: field,
            "=": value,
        },
    }));
}

export function isScatterLikeGeom(geomType: string) {
    return geomType === "point" || geomType === "circle" || geomType === "tick" || geomType === "text" || geomType === "rect";
}

export function symbolForShape(value: any) {
    const text = `${value ?? ""}`;
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return SHAPE_SYMBOLS[hash % SHAPE_SYMBOLS.length];
}

export function symbolForOrderedShape(value: any, domain: any[]) {
    const index = Math.max(0, domain.findIndex((item) => item === value));
    return SHAPE_SYMBOLS[index % SHAPE_SYMBOLS.length];
}

export function scaleRange(value: number, min: number, max: number, outMin: number, outMax: number) {
    if (!Number.isFinite(value)) return outMin;
    if (!(max > min)) return (outMin + outMax) / 2;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return outMin + t * (outMax - outMin);
}

export function niceCeil(value: number) {
    if (!Number.isFinite(value) || value <= 0) return value;
    const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
    return Math.ceil(value / magnitude) * magnitude;
}

export function niceFloor(value: number) {
    if (!Number.isFinite(value) || value <= 0) return value;
    const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)));
    return Math.floor(value / magnitude) * magnitude;
}

export function colorWithAlpha(color: string, alpha: number) {
    if (!color.startsWith("#")) {
        return color;
    }
    const hex = color.slice(1);
    const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
    if (normalized.length !== 6) {
        return color;
    }
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveColorRange(range: any, fallback: string[] = ["#5B8FF9", "#61DDAA", "#65789B", "#F6BD16", "#7262FD"]) {
    if (Array.isArray(range)) {
        return range;
    }
    if (range && typeof range === "object" && "scheme" in range) {
        if (Array.isArray(range.scheme)) {
            return range.scheme;
        }
        if (typeof range.scheme === "string") {
            return DISCRETE_COLOR_SCHEMES[range.scheme] ?? fallback;
        }
    }
    return fallback;
}

export function resolveGeomDefaultColor(geomType: string, vegaConfig: RendererPluginProps["vegaConfig"], fallback: string) {
    const markConfig = (vegaConfig as Record<string, any>)?.[geomType] as Record<string, any> | undefined;
    return markConfig?.fill ?? markConfig?.stroke ?? fallback;
}

export function quantile(sorted: number[], p: number) {
    if (sorted.length === 0) return NaN;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const t = idx - lo;
    return sorted[lo] * (1 - t) + sorted[hi] * t;
}
