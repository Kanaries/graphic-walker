import { inject } from '@vercel/analytics';
import { embedGraphicWalker } from '@kanaries/graphic-walker';
import { createObservablePlotPlugin } from '@kanaries/graphic-walker-renderer-observable-plot';
import { createEChartsPlugin } from '@kanaries/graphic-walker-renderer-echarts';
import './index.css';

if (!import.meta.env.DEV) {
    inject();
}

embedGraphicWalker(document.getElementById('root') as HTMLElement, {
    geoList: [
        { name: 'World Countries', type: 'GeoJSON', url: 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json' },
        {
            name: 'World Cities',
            type: 'GeoJSON',
            url: 'https://raw.githubusercontent.com/drei01/geojson-world-cities/f2a988af4bc15463df55586afbbffbd3068b7218/cities.geojson',
        },
    ],
    style: {
        flex: 1,
        minHeight: 0,
    },
    rendererPlugins: [createObservablePlotPlugin(), createEChartsPlugin()],
});
