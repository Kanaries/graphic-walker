import React from 'react';
import { createRoot } from 'react-dom/client';
// The published entry point, as a host application would use it.
import { GraphicWalker, getComputation } from '@kanaries/graphic-walker';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../../src/utils/save';
import type { IChart, IRow, IViewField, IVisualLayout } from '../../src/interfaces';
import type { VizSpecStore } from '../../src/store/visualSpecStore';
import { shapes } from './geo-map.shapes';
// The same squares as a topology with two objects: `halves` comes first, `all` holds every square.
import topology from './geo-map.topology.json';

/** A filled map in the production package, with shapes and data that live in this page. */
export interface MapRequest {
    /** The feature key the Region field is matched on. */
    geoKey?: string;
    /** The field shown as a label on each shape. */
    text?: 'Region' | 'Note' | 'Sales';
    /** Leaves the chart without shapes. */
    noShapes?: boolean;
    /** Points the chart at shapes behind a URL instead of storing them in the chart. */
    geoUrl?: IVisualLayout['geoUrl'];
    showAll?: boolean;
}
export interface MapFixture {
    load(request: MapRequest): void;
    saved(): IChart;
    setLayout<K extends keyof IVisualLayout>(key: K, value: IVisualLayout[K]): void;
    openSettings(): void;
    /** The text of files a user could upload or load by URL, and where this server keeps them. */
    files: { topology: string; shapes: string; topologyUrl: string; missingUrl: string };
    /** Set by markup in the data, if any of it ever runs. */
    scriptRan(): boolean;
}
declare global {
    interface Window {
        geo: MapFixture;
        __scriptRan?: boolean;
    }
}

const dimension = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
const measure = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const fields = [dimension('Region'), dimension('Note'), measure('Sales')];
const byId = new Map(fields.map((f) => [f.fid, f]));
// One row per region, plus one that names none. The note of the first is markup that must stay text.
const markup = '<img src="x" onerror="window.__scriptRan = true"><b>bold</b>';
const data: IRow[] = [
    { Region: 'East', Note: markup, Sales: 10 },
    { Region: 'West', Note: 'plain', Sales: 20 },
    { Region: '', Note: 'nowhere', Sales: 5 },
];

function chartOf(request: MapRequest): IChart {
    return {
        visId: 'map',
        name: 'Regions',
        encodings: {
            ...emptyEncodings,
            dimensions: fields.filter((f) => f.analyticType === 'dimension'),
            measures: fields.filter((f) => f.analyticType === 'measure'),
            geoId: [byId.get('Region')!],
            color: [byId.get('Sales')!],
            text: request.text ? [byId.get(request.text)!] : [],
        },
        config: { ...emptyVisualConfig, geoms: ['choropleth'], coordSystem: 'geographic' },
        layout: {
            ...emptyVisualLayout,
            // Map tiles are asked of this server, which has none, so no request leaves the machine.
            geoMapTileUrl: '/tests/e2e/no-tiles/{z}/{x}/{y}.png',
            geoKey: request.geoKey ?? 'name',
            showAllGeoshapeInChoropleth: request.showAll ?? false,
            ...(request.noShapes ? {} : request.geoUrl ? { geoUrl: request.geoUrl } : { geojson: shapes }),
        },
    };
}

// Vite emits the JSON as a file of its own and gives its address on this server.
const topologyUrl = new URL('./geo-map.topology.json', import.meta.url).href;

const storeRef = React.createRef<VizSpecStore>();
const store = () => {
    if (!storeRef.current) throw new Error('The editor is not mounted yet.');
    return storeRef.current;
};

window.geo = {
    load: (request) => store().importCode([chartOf(request)]),
    saved: () => JSON.parse(JSON.stringify(store().exportCode()))[0],
    setLayout: (key, value) => store().setVisualLayout(key, value),
    openSettings: () => store().setShowGeoJSONConfigPanel(true),
    files: {
        topology: JSON.stringify(topology),
        shapes: JSON.stringify(shapes),
        topologyUrl,
        missingUrl: '/tests/e2e/no-such-map.json',
    },
    scriptRan: () => window.__scriptRan === true,
};

createRoot(document.getElementById('root')!).render(
    <GraphicWalker storeRef={storeRef} fields={fields} computation={getComputation(data)} appearance="light" style={{ width: '100%', height: '100%' }} />
);

function ready() {
    if (!storeRef.current) return void requestAnimationFrame(ready);
    document.body.dataset.fixtureReady = 'true';
}
requestAnimationFrame(ready);
