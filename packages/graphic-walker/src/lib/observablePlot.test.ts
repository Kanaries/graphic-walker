jest.mock('@observablehq/plot', () => {
    class MockMark {
        ariaLabel: string;
        channels: any;
        z?: string;
        constructor(name: string, opts: any = {}) {
            this.ariaLabel = name;
            this.channels = {};
            if (opts.x) this.channels.x = { value: { label: opts.x } };
            if (opts.y) {
                this.channels.y1 = { value: { label: opts.y } };
                this.channels.y2 = { value: { label: opts.y } };
            }
            if (opts.z) this.z = opts.z;
        }
    }
    const factory = (name: string) => (data: any[], opts: any = {}) => new MockMark(name, opts);
    return {
        barY: factory('bar'),
        barX: factory('bar'),
        lineY: factory('line'),
        lineX: factory('line'),
        dot: factory('dot'),
        text: factory('text'),
        areaY: factory('area'),
        areaX: factory('area'),
        tickX: factory('tick'),
        tickY: factory('tick'),
        rectX: factory('rect'),
        rectY: factory('rect'),
        ruleX: factory('rule'),
        ruleY: factory('rule'),
        boxX: factory('box'),
        boxY: factory('box'),
        stackY: () => (opts: any) => ({ ...opts, stack: 'y' }),
        stackX: () => (opts: any) => ({ ...opts, stack: 'x' }),
    };
});

import { __test__vegaLiteToPlot } from './observablePlot';

describe('vegaLiteToPlot', () => {
    test('bar chart basic', () => {
        const vlSpec = {
            mark: 'bar',
            data: { values: [ { a: 'A', b: 1 }, { a: 'B', b: 2 } ] },
            encoding: {
                x: { field: 'a', type: 'nominal' },
                y: { field: 'b', type: 'quantitative' },
            },
        };
        const plot = __test__vegaLiteToPlot(vlSpec);
        const mark = plot.marks[0];
        expect(mark.ariaLabel).toBe('bar');
        expect(mark.channels.x.value.label).toBe('a');
        expect(mark.channels.y1.value.label).toBe('b');
        expect(plot.x.type).toBeUndefined();
        expect(plot.y.type).toBeUndefined();
    });

    test('line chart with color', () => {
        const vlSpec = {
            mark: 'line',
            data: { values: [ { t: '2024-01-01', v: 1, c: 'A' }, { t: '2024-01-02', v: 2, c: 'B' } ] },
            encoding: {
                x: { field: 't', type: 'temporal' },
                y: { field: 'v', type: 'quantitative' },
                color: { field: 'c', type: 'nominal' },
            },
        };
        const plot = __test__vegaLiteToPlot(vlSpec);
        const mark = plot.marks[0];
        expect(mark.ariaLabel).toBe('line');
        expect(plot.x.type).toBe('utc');
    });

    test('temporal bar chart uses band scale', () => {
        const vlSpec = {
            mark: 'bar',
            data: { values: [ { t: '2024-01-01', v: 1 }, { t: '2024-01-02', v: 2 } ] },
            encoding: {
                x: { field: 't', type: 'temporal' },
                y: { field: 'v', type: 'quantitative' },
            },
        };
        const plot = __test__vegaLiteToPlot(vlSpec);
        expect(plot.x.type).toBe('band');
        expect(plot.marks[0].ariaLabel).toBe('bar');
    });
});
