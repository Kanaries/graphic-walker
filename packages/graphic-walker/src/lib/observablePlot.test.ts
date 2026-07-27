jest.mock('@observablehq/plot', () => {
    class MockMark {
        ariaLabel: string;
        channels: any;
        data: any[];
        options: any;
        variant: string;
        z?: string;

        constructor(name: string, variant: string, data: any[], opts: any = {}) {
            this.ariaLabel = name;
            this.variant = variant;
            this.data = data;
            this.options = opts;
            this.channels = {};
            if (opts.x !== undefined) this.channels.x = { value: { label: opts.x } };
            if (opts.y !== undefined) {
                this.channels.y1 = { value: { label: opts.y } };
                this.channels.y2 = { value: { label: opts.y } };
            }
            if (opts.x1 !== undefined) this.channels.x1 = { value: { label: opts.x1 } };
            if (opts.x2 !== undefined) this.channels.x2 = { value: { label: opts.x2 } };
            if (opts.y1 !== undefined) this.channels.y1 = { value: { label: opts.y1 } };
            if (opts.y2 !== undefined) this.channels.y2 = { value: { label: opts.y2 } };
            if (opts.z) this.z = opts.z;
        }
    }

    const factory = (name: string, variant: string) => (data: any[], opts: any = {}) => new MockMark(name, variant, data, opts);
    const stackFactory = (stack: string) =>
        jest.fn((stackOptions: any, opts: any) => ({
            ...opts,
            stack,
            stackOptions,
        }));

    return {
        barY: factory('bar', 'barY'),
        barX: factory('bar', 'barX'),
        lineY: factory('line', 'lineY'),
        lineX: factory('line', 'lineX'),
        dot: factory('dot', 'dot'),
        text: factory('text', 'text'),
        areaY: factory('area', 'areaY'),
        areaX: factory('area', 'areaX'),
        tickX: factory('tick', 'tickX'),
        tickY: factory('tick', 'tickY'),
        rectX: factory('rect', 'rectX'),
        rectY: factory('rect', 'rectY'),
        ruleX: factory('rule', 'ruleX'),
        ruleY: factory('rule', 'ruleY'),
        boxX: factory('box', 'boxX'),
        boxY: factory('box', 'boxY'),
        stackY: stackFactory('y'),
        stackX: stackFactory('x'),
        stackY2: stackFactory('y2'),
        stackX2: stackFactory('x2'),
    };
});

import * as Plot from '@observablehq/plot';
import { __test__vegaLiteToPlot } from './observablePlot';

const expectNoStack = () => {
    expect(Plot.stackX).not.toHaveBeenCalled();
    expect(Plot.stackY).not.toHaveBeenCalled();
    expect(Plot.stackX2).not.toHaveBeenCalled();
    expect(Plot.stackY2).not.toHaveBeenCalled();
};

describe('vegaLiteToPlot', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('bar chart basic', () => {
        const vlSpec = {
            mark: 'bar',
            data: { values: [{ a: 'A', b: 1 }, { a: 'B', b: 2 }] },
            encoding: {
                x: { field: 'a', type: 'nominal' },
                y: { field: 'b', type: 'quantitative' },
            },
        };
        const plot = __test__vegaLiteToPlot(vlSpec);
        const mark = plot.marks[0];
        expect(mark.ariaLabel).toBe('bar');
        expect(mark.variant).toBe('barY');
        expect(mark.channels.x.value.label).toBe('a');
        expect(mark.channels.y1.value.label).toBe('b');
        expect(plot.x.type).toBeUndefined();
        expect(plot.y.type).toBeUndefined();
    });

    test('line chart with color stays unstacked and grouped', () => {
        const vlSpec = {
            mark: 'line',
            data: { values: [{ t: '2024-01-01', v: 1, c: 'A' }, { t: '2024-01-02', v: 2, c: 'B' }] },
            encoding: {
                x: { field: 't', type: 'temporal' },
                y: { field: 'v', type: 'quantitative' },
                color: { field: 'c', type: 'nominal' },
            },
        };
        const plot = __test__vegaLiteToPlot(vlSpec);
        const mark = plot.marks[0];
        expect(mark.ariaLabel).toBe('line');
        expect(mark.options.z).toBe('c');
        expectNoStack();
        expect(plot.x.type).toBe('utc');
    });

    test('temporal bar chart uses band scale', () => {
        const vlSpec = {
            mark: 'bar',
            data: { values: [{ t: '2024-01-01', v: 1 }, { t: '2024-01-02', v: 2 }] },
            encoding: {
                x: { field: 't', type: 'temporal' },
                y: { field: 'v', type: 'quantitative' },
            },
        };
        const plot = __test__vegaLiteToPlot(vlSpec);
        expect(plot.x.type).toBe('band');
        expect(plot.marks[0].ariaLabel).toBe('bar');
    });

    test('point chart with color is not implicitly stacked', () => {
        const vlSpec = {
            mark: 'point',
            data: {
                values: [
                    { x: 1, y: 10, c: 'A' },
                    { x: 2, y: 20, c: 'B' },
                ],
            },
            encoding: {
                x: { field: 'x', type: 'quantitative' },
                y: { field: 'y', type: 'quantitative' },
                color: { field: 'c', type: 'nominal' },
            },
        };

        const plot = __test__vegaLiteToPlot(vlSpec);
        const mark = plot.marks[0];

        expect(mark.ariaLabel).toBe('dot');
        expect(mark.options).toMatchObject({ x: 'x', y: 'y', stroke: 'c' });
        expectNoStack();
    });

    test('point chart with color respects explicit stack null', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'point',
            data: { values: [{ x: 1, y: 10, c: 'A' }] },
            encoding: {
                x: { field: 'x', type: 'quantitative', stack: null },
                y: { field: 'y', type: 'quantitative', stack: null },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(plot.marks[0].options).toMatchObject({ x: 'x', y: 'y', stroke: 'c' });
        expectNoStack();
    });

    test('point chart uses x stack precedence and the upper endpoint', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'point',
            data: { values: [{ x: 1, y: 10, c: 'A' }] },
            encoding: {
                x: { field: 'x', type: 'quantitative', stack: 'normalize' },
                y: { field: 'y', type: 'quantitative', stack: 'normalize' },
                color: { field: 'c', type: 'nominal' },
            },
        });
        const mark = plot.marks[0];

        expect(Plot.stackX2).toHaveBeenCalledWith({ offset: 'normalize' }, expect.objectContaining({ x: 'x', y: 'y', z: 'c' }));
        expect(Plot.stackY2).not.toHaveBeenCalled();
        expect(mark.options).toMatchObject({ stack: 'x2', stackOptions: { offset: 'normalize' }, z: 'c' });
    });

    test.each(['normalize', 'center'])('point chart ignores explicit %s stacking without a color group', (stack) => {
        const plot = __test__vegaLiteToPlot({
            mark: 'point',
            data: { values: [{ x: 1, y: 10 }] },
            encoding: {
                x: { field: 'x', type: 'quantitative', stack },
                y: { field: 'y', type: 'quantitative', stack },
            },
        });

        expectNoStack();
        expect(plot.marks[0].options).toMatchObject({ x: 'x', y: 'y' });
    });

    test('real binned x encoding is excluded from stack-axis selection', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ 'x[0]': 0, 'x[1]': 10, y: 2, c: 'A' }] },
            encoding: {
                x: { field: 'x[0]', bin: { binned: true } },
                x2: { field: 'x[1]' },
                y: { field: 'y', type: 'quantitative', stack: 'normalize' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackY).toHaveBeenCalledWith({ offset: 'normalize' }, expect.objectContaining({ y: 'y', z: 'c' }));
        expect(Plot.stackX).not.toHaveBeenCalled();
        expect(plot.marks[0].variant).toBe('barY');
    });

    test('explicitly stacked line uses the upper endpoint', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'line',
            data: { values: [{ t: '2024-01-01', v: 1, c: 'A' }] },
            encoding: {
                x: { field: 't', type: 'temporal' },
                y: { field: 'v', type: 'quantitative', stack: 'normalize' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackY2).toHaveBeenCalledWith({ offset: 'normalize' }, expect.objectContaining({ y: 'v', z: 'c' }));
        expect(plot.marks[0].options).toMatchObject({ stack: 'y2', stackOptions: { offset: 'normalize' } });
    });

    test('colored bar keeps Vega-Lite default stacking and color grouping', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ x: 'A', y: 1, c: 'one' }, { x: 'A', y: 2, c: 'two' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackY).toHaveBeenCalledWith({}, expect.objectContaining({ y: 'y', z: 'c' }));
        expect(plot.marks[0].options).toMatchObject({ stack: 'y', stackOptions: {}, z: 'c' });
    });

    test.each(['bar', 'area'])('%s defaults to a y stack when both axes are quantitative', (markType) => {
        const plot = __test__vegaLiteToPlot({
            mark: markType,
            data: { values: [{ x: 1, y: 2, c: 'A' }] },
            encoding: {
                x: { field: 'x', type: 'quantitative' },
                y: { field: 'y', type: 'quantitative' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackY).toHaveBeenCalledWith({}, expect.objectContaining({ x: 'x', y: 'y', z: 'c' }));
        expect(plot.marks[0].variant).toBe(`${markType}Y`);
    });

    test('zero stack mode does not pass an unsupported Plot offset', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ x: 'A', y: 1, c: 'one' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', stack: 'zero' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackY).toHaveBeenCalledWith({}, expect.anything());
        expect(plot.marks[0].options.stackOptions).toEqual({});
    });

    test.each(['normalize', 'center'])('aggregated bar ignores explicit %s stacking without a color group', (stack) => {
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ x: 'A', y: 1 }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', aggregate: 'sum', stack },
            },
        });
        const mark = plot.marks[0];

        expectNoStack();
        expect(mark.options).toMatchObject({ y1: 0, y2: 'y' });
        expect(mark.options.y).toBeUndefined();
    });

    test.each([true, false])('bar stack null suppresses Plot implicit stacking (color: %s)', (withColor) => {
        const color = withColor ? { color: { field: 'c', type: 'nominal' } } : {};
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ x: 'A', y: 1, c: 'one' }, { x: 'A', y: 2, c: 'two' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', stack: null },
                ...color,
            },
        });
        const mark = plot.marks[0];

        expectNoStack();
        expect(mark.options.y).toBeUndefined();
        expect(mark.options).toMatchObject({ y1: 0, y2: 'y' });
    });

    test('area stack null is layered and keeps color grouping', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'area',
            data: { values: [{ x: 'A', y: 1, c: 'one' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', stack: null },
                color: { field: 'c', type: 'nominal' },
            },
        });
        const mark = plot.marks[0];

        expectNoStack();
        expect(mark.options).toMatchObject({ y1: 0, y2: 'y', z: 'c' });
        expect(mark.options.y).toBeUndefined();
    });

    test('horizontal bar uses an x stack', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ x: 1, y: 'A', c: 'one' }] },
            encoding: {
                x: { field: 'x', type: 'quantitative' },
                y: { field: 'y', type: 'nominal' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackX).toHaveBeenCalledWith({}, expect.objectContaining({ x: 'x', y: 'y', z: 'c' }));
        expect(plot.marks[0].variant).toBe('barX');
    });

    test('both-quantitative normalized bar follows the resolved x axis', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'bar',
            data: { values: [{ x: 1, y: 2, c: 'A' }] },
            encoding: {
                x: { field: 'x', type: 'quantitative', stack: 'normalize' },
                y: { field: 'y', type: 'quantitative', stack: 'normalize' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expect(Plot.stackX).toHaveBeenCalledWith({ offset: 'normalize' }, expect.objectContaining({ x: 'x', y: 'y', z: 'c' }));
        expect(Plot.stackY).not.toHaveBeenCalled();
        expect(plot.marks[0].variant).toBe('barX');
    });

    test.each([undefined, null, 'normalize'])('rect remains unstacked for stack %s', (stack) => {
        const y = { field: 'y', type: 'quantitative' } as any;
        if (stack !== undefined) y.stack = stack;
        const plot = __test__vegaLiteToPlot({
            mark: 'rect',
            data: { values: [{ x: 'A', y: 1, c: 'one' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y,
                color: { field: 'c', type: 'nominal' },
            },
        });
        const mark = plot.marks[0];

        expectNoStack();
        expect(mark.options).toMatchObject({ y1: 0, y2: 'y' });
        expect(mark.options.y).toBeUndefined();
    });

    test('nominal rect is left unchanged when there is no quantitative stack axis', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'rect',
            data: { values: [{ x: 'A', y: 'B' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'nominal', stack: null },
            },
        });
        const mark = plot.marks[0];

        expectNoStack();
        expect(mark.options).toMatchObject({ x: 'x', y: 'y' });
        expect(mark.options.y1).toBeUndefined();
        expect(mark.options.y2).toBeUndefined();
    });

    test('rule remains outside the explicitly supported stack marks', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'rule',
            data: { values: [{ x: 'A', y: 1 }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', stack: 'normalize' },
            },
        });

        expectNoStack();
        expect(plot.marks[0].variant).toBe('ruleY');
    });

    test('trail ignores explicit stack and remains the existing dot fallback', () => {
        const plot = __test__vegaLiteToPlot({
            mark: 'trail',
            data: { values: [{ x: 'A', y: 1 }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', stack: 'normalize' },
            },
        });

        expectNoStack();
        expect(plot.marks[0].ariaLabel).toBe('dot');
    });

    test.each(['point', 'bar'])('%s ignores invalid literal stack mode', (markType) => {
        const plot = __test__vegaLiteToPlot({
            mark: markType,
            data: { values: [{ x: 'A', y: 1, c: 'one' }] },
            encoding: {
                x: { field: 'x', type: 'nominal' },
                y: { field: 'y', type: 'quantitative', stack: 'stack' },
                color: { field: 'c', type: 'nominal' },
            },
        });

        expectNoStack();
        if (markType === 'bar') {
            expect(plot.marks[0].options).toMatchObject({ y1: 0, y2: 'y' });
        } else {
            expect(plot.marks[0].options).toMatchObject({ y: 'y' });
        }
    });
});
