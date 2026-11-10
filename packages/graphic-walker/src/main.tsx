import { inject } from '@vercel/analytics';
import { embedGraphicWalker } from './vanilla';
import './main.css';

if (!import.meta.env.DEV) {
    inject();
}

// The native worksheet renderer is a preview kept outside the published sources. The dev
// server loads it by URL, so neither the library build nor its type check ever sees it.
if (import.meta.env.DEV) {
    const preview = '/native-preview/index.tsx';
    import(/* @vite-ignore */ preview).catch((error) => console.error('Native renderer preview failed to load', error));
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
        minHeight: 0
    }
});
