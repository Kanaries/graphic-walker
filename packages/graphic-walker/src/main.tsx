import { inject } from '@vercel/analytics';
import { embedGraphicWalker } from './vanilla';
import './main.css';

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
});
