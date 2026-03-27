import assert from "node:assert/strict";

import { computeAutoChartSize, resolveChartRenderSize } from "../src/size";

function createProps(overrides: Partial<any> = {}) {
    return {
        name: "test",
        data: [
            { category: "A", series: "S1", value: 10 },
            { category: "B", series: "S1", value: 20 },
        ],
        draggableFieldState: {
            dimensions: [{ fid: "category", name: "category", semanticType: "nominal", analyticType: "dimension" } as any],
            measures: [{ fid: "value", name: "value", semanticType: "quantitative", analyticType: "measure" } as any],
            rows: [{ fid: "value", name: "value", semanticType: "quantitative", analyticType: "measure" } as any],
            columns: [{ fid: "category", name: "category", semanticType: "nominal", analyticType: "dimension" } as any],
            color: [],
            opacity: [],
            size: [],
            shape: [],
            radius: [],
            theta: [],
            longitude: [],
            latitude: [],
            geoId: [],
            details: [],
            filters: [],
            text: [],
        },
        visualConfig: { defaultAggregated: true, geoms: ["bar"], coordSystem: "generic", limit: -1 },
        layout: {
            showTableSummary: false,
            format: {},
            resolve: {},
            size: { mode: "auto", width: 320, height: 200 },
            interactiveScale: false,
            stack: "none",
            showActions: false,
            zeroScale: true,
        },
        vegaConfig: {},
        chartWidth: 320,
        chartHeight: 200,
        ...overrides,
    } as any;
}

const base = computeAutoChartSize(createProps());
const xHeavy = computeAutoChartSize(
    createProps({
        data: Array.from({ length: 10 }, (_, index) => ({ category: `C${index}`, value: index + 1 })),
    })
);
assert.ok(xHeavy.width > base.width, "x 轴离散值更多时应增大宽度");

const yHeavy = computeAutoChartSize(
    createProps({
        data: Array.from({ length: 10 }, (_, index) => ({ group: `G${index}`, value: index + 1 })),
        draggableFieldState: {
            ...createProps().draggableFieldState,
            rows: [{ fid: "group", name: "group", semanticType: "nominal", analyticType: "dimension" } as any],
            columns: [{ fid: "value", name: "value", semanticType: "quantitative", analyticType: "measure" } as any],
        },
    })
);
assert.ok(yHeavy.height > base.height, "y 轴离散值更多时应增大高度");

const faceted = computeAutoChartSize(
    createProps({
        data: [
            { region: "East", gender: "M", category: "A", value: 1 },
            { region: "East", gender: "F", category: "A", value: 2 },
            { region: "West", gender: "M", category: "A", value: 3 },
            { region: "West", gender: "F", category: "A", value: 4 },
        ],
        draggableFieldState: {
            ...createProps().draggableFieldState,
            rows: [
                { fid: "gender", name: "gender", semanticType: "nominal", analyticType: "dimension" } as any,
                { fid: "value", name: "value", semanticType: "quantitative", analyticType: "measure" } as any,
            ],
            columns: [
                { fid: "region", name: "region", semanticType: "nominal", analyticType: "dimension" } as any,
                { fid: "category", name: "category", semanticType: "nominal", analyticType: "dimension" } as any,
            ],
        },
    })
);
assert.ok(faceted.width > base.width, "facet 列数增加时应增大宽度");
assert.ok(faceted.height > base.height, "facet 行数增加时应增大高度");

const syntheticFacet = computeAutoChartSize(
    createProps({
        data: [
            { category: "A", value: 1, other: 2 },
            { category: "B", value: 3, other: 4 },
        ],
        draggableFieldState: {
            ...createProps().draggableFieldState,
            columns: [
                { fid: "__facet_x_measure__", name: "column measure", semanticType: "nominal", analyticType: "dimension" } as any,
                { fid: "__facet_x_value__", name: "x", semanticType: "quantitative", analyticType: "measure" } as any,
            ],
        },
    })
);
assert.equal(syntheticFacet.width, base.width, "synthetic facet 不应被重复计入离散轴增长");

const fixed = resolveChartRenderSize(createProps({ layout: { ...createProps().layout, size: { mode: "fixed", width: 400, height: 260 } }, chartWidth: 352, chartHeight: 212 }));
assert.deepEqual(fixed, { mode: "fixed", width: 352, height: 212 }, "fixed 模式应直接使用传入 chartWidth/chartHeight");

const full = resolveChartRenderSize(createProps({ layout: { ...createProps().layout, size: { mode: "full", width: 400, height: 260 } } }));
assert.equal(full.mode, "full", "container/full 模式应被识别");

console.log("renderer-echarts size logic tests passed");
