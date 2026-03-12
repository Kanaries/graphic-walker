import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
    __test__fieldBinding,
    __test__vegaLiteToPlot,
    toObservablePlotSpec,
} from '../dist/graphic-walker-renderer-observable-plot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function baseSpec() {
    return {
        data: { values: [{ x: 1, y: 2, c: 'A', s: 8, o: 0.7, sh: 'A', r: 'R1', g: 'G1' }] },
        mark: 'point',
        encoding: {
            x: { field: 'x', type: 'quantitative', title: 'X' },
            y: { field: 'y', type: 'quantitative', title: 'Y' },
            color: { field: 'c', type: 'nominal', title: 'Color' },
            size: { field: 's', type: 'quantitative', title: 'Size' },
            opacity: { field: 'o', type: 'quantitative', title: 'Opacity' },
            shape: { field: 'sh', type: 'nominal', title: 'Shape' },
            row: { field: 'r', type: 'nominal', title: 'Row' },
            column: { field: 'g', type: 'nominal', title: 'Column' },
            tooltip: [{ field: 'x', type: 'quantitative', title: 'X' }],
        },
    };
}

test('resolveDataKey prefers aggregated key', () => {
    const key = __test__fieldBinding.resolveDataKey(
        [{ value_sum: 10, value: 1 }],
        { field: 'value', aggregate: 'sum', type: 'quantitative' },
    );
    assert.equal(key, 'value_sum');
});

test('getFieldTitle formats aggregated measure title', () => {
    const title = __test__fieldBinding.getFieldTitle({
        field: 'value',
        title: 'value',
        aggregate: 'avg',
    });
    assert.equal(title, 'avg(value)');
});

test('vegaLiteToPlot builds channel scales and outside legend layout', () => {
    const plotSpec = __test__vegaLiteToPlot(baseSpec());
    assert.equal(plotSpec.color.legend, true);
    assert.deepEqual(plotSpec.opacity.range, [0.2, 1]);
    assert.deepEqual(plotSpec.r.range, [3, 14]);
    assert.equal(plotSpec.symbol.legend, true);
    assert.equal(plotSpec.marginRight, 40);
    assert.ok(Array.isArray(plotSpec.marks));
    assert.equal(plotSpec.marks.length, 1);
});

test('legend disabled in vl config is respected', () => {
    const vlSpec = baseSpec();
    vlSpec.config = { legend: { disable: true } };
    const plotSpec = __test__vegaLiteToPlot(vlSpec);
    assert.equal(plotSpec.color.legend, false);
    assert.equal(plotSpec.marginRight, 40);
});

test('uses vegaConfig color for marks without color channel', () => {
    const vlSpec = baseSpec();
    delete vlSpec.encoding.color;
    const plotSpec = __test__vegaLiteToPlot(vlSpec, {
        area: { fill: '#5B8FF9' },
        point: { stroke: '#61DDAA' },
        range: { category: ['#5B8FF9'] },
    });
    assert.ok(Array.isArray(plotSpec.marks));
    assert.equal(plotSpec.marks.length, 1);
});

test('toObservablePlotSpec returns repeated subviews', async () => {
    const raw = await fs.readFile(path.resolve(__dirname, './prop-scatter.json'), 'utf8');
    const props = JSON.parse(raw);
    const measureByFid = new Map(props.draggableFieldState.measures.map((f) => [f.fid, f]));

    const specs = toObservablePlotSpec({
        rows: [measureByFid.get('math score'), measureByFid.get('reading score')].filter(Boolean),
        columns: [measureByFid.get('writing score')].filter(Boolean),
        color: props.draggableFieldState.color[0],
        opacity: props.draggableFieldState.opacity[0],
        size: props.draggableFieldState.size[0],
        shape: props.draggableFieldState.shape[0],
        theta: props.draggableFieldState.theta[0],
        radius: props.draggableFieldState.radius[0],
        text: props.draggableFieldState.text[0],
        details: props.draggableFieldState.details,
        interactiveScale: props.layout.interactiveScale,
        dataSource: props.data,
        layoutMode: props.layout.size.mode,
        width: props.chartWidth,
        height: props.chartHeight,
        defaultAggregated: props.visualConfig.defaultAggregated,
        geomType: 'point',
        stack: props.layout.stack,
        scales: props.scales,
        mediaTheme: 'light',
        vegaConfig: props.vegaConfig,
        displayOffset: props.visualConfig.timezoneDisplayOffset,
    });

    assert.equal(specs.length, 2);
});
