import { inject } from '@vercel/analytics';
import { embedGraphicWalker } from './vanilla';
import { expectNativeRenderer } from './renderer/nativeRegistry';
import './main.css';

if (!import.meta.env.DEV) {
    inject();
}

// The native worksheet renderer is a preview kept outside the published sources. The dev
// server loads it by URL, so neither the library build nor its type check ever sees it.
if (import.meta.env.DEV) {
    const preview = '/native-preview/index.tsx';
    // Charts that ask for it show that it is loading until it registers, and that it is missing if it never does.
    expectNativeRenderer(import(/* @vite-ignore */ preview).catch((error) => console.error('Native renderer preview failed to load', error)));
}

// In development `?lang=zh-CN` opens the editor in that language, to check translated output without a host app.
const lang = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('lang') : null;

embedGraphicWalker(document.getElementById('root') as HTMLElement, {
    ...(lang ? { i18nLang: lang } : {}),
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
