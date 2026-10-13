import { ISegmentKey, type IDefaultUIConfig, type IMutField } from '../interfaces';
import { newChart } from '../models/visSpecHistory';
import { VizSpecStore } from './visualSpecStore';

const META: IMutField[] = [
    { fid: 'category', name: 'Category', semanticType: 'nominal', analyticType: 'dimension' },
    { fid: 'sales', name: 'Sales', semanticType: 'quantitative', analyticType: 'measure' },
];

const dispatchEvent = jest.fn();
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalCustomEvent = Object.getOwnPropertyDescriptor(globalThis, 'CustomEvent');

const metaFieldIds = (store: VizSpecStore) => {
    const expectedIds = new Set(META.map((field) => field.fid));
    return [...store.currentEncodings.dimensions, ...store.currentEncodings.measures]
        .map((field) => field.fid)
        .filter((fid) => expectedIds.has(fid));
};

describe('VizSpecStore', () => {
    beforeAll(() => {
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: { dispatchEvent },
        });
        Object.defineProperty(globalThis, 'CustomEvent', {
            configurable: true,
            value: class {
                constructor(
                    public type: string,
                    public init?: CustomEventInit,
                ) {}
            },
        });
    });

    beforeEach(() => {
        dispatchEvent.mockClear();
    });

    afterAll(() => {
        if (originalDocument) {
            Object.defineProperty(globalThis, 'document', originalDocument);
        } else {
            Reflect.deleteProperty(globalThis, 'document');
        }
        if (originalCustomEvent) {
            Object.defineProperty(globalThis, 'CustomEvent', originalCustomEvent);
        } else {
            Reflect.deleteProperty(globalThis, 'CustomEvent');
        }
    });

    test('hydrates the initial chart when asynchronous metadata first arrives', () => {
        const store = new VizSpecStore([]);
        const initialVisId = store.currentVis.visId;

        // App.tsx creates a fresh [] while async fields are still unavailable.
        store.setMeta([]);
        store.setMeta([]);
        store.setMeta(META);
        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        expect(dispatchEvent.mock.calls[0][0]).toMatchObject({ type: 'edit-graphic-walker' });
        expect(store.canUndo).toBe(false);
        const chartOneFieldsAfterHydration = metaFieldIds(store);

        store.addVisualization();
        const chartTwoFields = metaFieldIds(store);

        store.selectVisualization(0);

        expect({
            chartOneFieldsAfterHydration,
            chartTwoFields,
            chartOneFieldsAfterSwitchingBack: metaFieldIds(store),
        }).toEqual({
            chartOneFieldsAfterHydration: ['category', 'sales'],
            chartTwoFields: ['category', 'sales'],
            chartOneFieldsAfterSwitchingBack: ['category', 'sales'],
        });
        expect(store.currentVis.visId).toBe(initialVisId);
    });

    test('preserves an existing user chart when metadata props update', () => {
        const store = new VizSpecStore(META);
        store.moveField('dimensions', 0, 'columns', 0);
        const editedChart = store.currentVis;
        const updatedMeta: IMutField[] = [
            ...META,
            { fid: 'profit', name: 'Profit', semanticType: 'quantitative', analyticType: 'measure' },
        ];

        store.setMeta(updatedMeta);

        expect(store.meta).toEqual(updatedMeta);
        expect(store.currentVis).toBe(editedChart);
        expect(store.currentEncodings.columns.map((field) => field.fid)).toEqual(['category']);
    });

    test('preserves a chart edited before asynchronous metadata arrives', () => {
        const store = new VizSpecStore([]);
        store.setVisualConfig('geoms', ['line']);
        const editedChart = store.currentVis;

        store.setMeta(META);

        expect(store.currentVis).toBe(editedChart);
        expect(store.currentVis.config.geoms).toEqual(['line']);
        expect(metaFieldIds(store)).toEqual([]);
    });

    test('preserves a supplied chart when asynchronous metadata arrives', () => {
        const store = new VizSpecStore([]);
        store.replaceNow(newChart(META, 'Supplied chart', 'supplied-vis-id'));
        const suppliedChart = store.currentVis;

        store.setMeta(META);

        expect(store.currentVis).toBe(suppliedChart);
        expect(store.currentVis.visId).toBe('supplied-vis-id');
        expect(metaFieldIds(store)).toEqual(['category', 'sales']);
    });

    test('preserves multiple charts created before asynchronous metadata arrives', () => {
        const store = new VizSpecStore([]);
        const firstChart = store.visList[0];
        store.addVisualization();
        const secondChart = store.visList[1];

        store.setMeta(META);

        expect(store.visList[0]).toBe(firstChart);
        expect(store.visList[1]).toBe(secondChart);
    });

    test('hydrates a reset placeholder when metadata arrives', () => {
        const store = new VizSpecStore([]);
        store.resetVisualization('Reset while loading');
        const resetVisId = store.currentVis.visId;

        store.setMeta(META);

        expect(store.currentVis.name).toBe('Reset while loading');
        expect(store.currentVis.visId).toBe(resetVisId);
        expect(metaFieldIds(store)).toEqual(['category', 'sales']);
    });

    test('hydrates the remaining pristine placeholder after the first chart is removed', () => {
        const store = new VizSpecStore([]);
        store.addVisualization();
        const remainingVisId = store.visList[1].now.visId;
        store.removeVisualization(0);

        store.setMeta(META);

        expect(store.currentVis.visId).toBe(remainingVisId);
        expect(metaFieldIds(store)).toEqual(['category', 'sales']);
    });

    test('keeps an explicitly empty store chartless when metadata arrives', () => {
        const store = new VizSpecStore([], { empty: true });

        store.setMeta(META);

        expect(store.visLength).toBe(0);
        expect(store.meta).toEqual(META);
    });

    test('uses the latest default config when hydrating the initial chart', () => {
        const store = new VizSpecStore([]);
        store.setDefaultConfig({ layout: { renderer: 'observable-plot' } });

        store.setMeta(META);

        expect(store.currentVis.layout.renderer).toBe('observable-plot');
    });

    describe('default UI configuration', () => {
        test.each<[string, IDefaultUIConfig | undefined, boolean]>([
            ['omitted config', undefined, true],
            ['empty config', {}, true],
            ['empty panels', { panels: {} }, true],
            ['empty Auto Viz defaults', { panels: { autoViz: {} } }, true],
            ['expanded Auto Viz', { panels: { autoViz: { expanded: true } } }, true],
            ['collapsed Auto Viz', { panels: { autoViz: { expanded: false } } }, false],
        ])('initializes %s', (_name, defaultUIConfig, expanded) => {
            const store = new VizSpecStore(META, { defaultUIConfig });

            expect(store.showAutoVizPanel).toBe(expanded);
        });

        test('preserves user panel state through metadata hydration and chart operations', () => {
            const store = new VizSpecStore([], { defaultUIConfig: { panels: { autoViz: { expanded: false } } } });

            store.setShowAutoVizPanel(true);
            store.setMeta(META);
            expect(store.showAutoVizPanel).toBe(true);

            store.replaceNow(newChart(META, 'Controlled chart'));
            expect(store.showAutoVizPanel).toBe(true);

            store.addVisualization();
            store.selectVisualization(0);
            expect(store.showAutoVizPanel).toBe(true);

            store.setShowAutoVizPanel(false);
            store.resetVisualization();
            expect(store.showAutoVizPanel).toBe(false);
        });

        test('keeps UI defaults and user toggles outside the chart and its undo history', () => {
            const store = new VizSpecStore(META, {
                defaultConfig: { layout: { renderer: 'observable-plot' } },
                defaultUIConfig: { panels: { autoViz: { expanded: false } } },
            });
            const initialChart = store.currentVis;

            expect(initialChart.layout.renderer).toBe('observable-plot');
            expect(store.canUndo).toBe(false);

            store.setShowAutoVizPanel(true);
            expect(store.currentVis).toBe(initialChart);
            expect(store.canUndo).toBe(false);

            store.moveField('dimensions', 0, 'columns', 0);
            store.setShowAutoVizPanel(false);
            store.undo();

            expect(store.showAutoVizPanel).toBe(false);
            expect(store.currentEncodings.columns).toEqual([]);
        });
    });
});

describe('VizSpecStore initial segment', () => {
    test('opens on the data segment when requested', () => {
        const store = new VizSpecStore(META, { initialSegment: ISegmentKey.data });

        expect(store.segmentKey).toBe(ISegmentKey.data);
    });

    test('defaults to the visualization segment', () => {
        const store = new VizSpecStore(META);

        expect(store.segmentKey).toBe(ISegmentKey.vis);
    });
});
