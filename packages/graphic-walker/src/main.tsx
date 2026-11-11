import { inject } from '@vercel/analytics';
import { embedGraphicWalker } from './vanilla';
import './main.css';

if (!import.meta.env.DEV) {
    inject();
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
