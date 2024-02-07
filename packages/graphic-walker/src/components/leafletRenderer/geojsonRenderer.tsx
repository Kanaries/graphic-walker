import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, AttributionControl } from 'react-leaflet';
import { useGeoJSON } from '../../hooks/service';
import { IGeoUrl } from '../../interfaces';
import { FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import { canvas } from 'leaflet';
import { useTranslation } from 'react-i18next';

const resolveCoords = (featureGeom: Geometry): [lat: number, lng: number][][] => {
    switch (featureGeom.type) {
        case 'Polygon': {
            const coords = featureGeom.coordinates[0];
            return [coords.map<[lat: number, lng: number]>((c) => [c[1], c[0]])];
        }
        case 'Point': {
            const coords = featureGeom.coordinates;
            return [[[coords[1], coords[0]]]];
        }
        case 'GeometryCollection': {
            const coords = featureGeom.geometries.map<[lat: number, lng: number][][]>(resolveCoords);
            return coords.flat();
        }
        case 'LineString': {
            const coords = featureGeom.coordinates;
            return [coords.map<[lat: number, lng: number]>((c) => [c[1], c[0]])];
        }
        case 'MultiLineString': {
            const coords = featureGeom.coordinates;
            return coords.map<[lat: number, lng: number][]>((c) => c.map((c) => [c[1], c[0]]));
        }
        case 'MultiPoint': {
            const coords = featureGeom.coordinates;
            return [coords.map<[lat: number, lng: number]>((c) => [c[1], c[0]])];
        }
        case 'MultiPolygon': {
            const coords = featureGeom.coordinates;
            return coords.map<[lat: number, lng: number][]>((c) => c[0].map((c) => [c[1], c[0]]));
        }
        default: {
            return [];
        }
    }
};

export function GeojsonRenderer(props: { url?: IGeoUrl; data?: string; type?: 'GeoJSON' | 'TopoJSON' }) {
    const d = useMemo(() => (props.data && props.type ? getGeojson(props.data, props.type) : undefined), [props.data, props.type]);
    const data = useGeoJSON(d, props.url);
    const [k, setK] = useState(0);
    useEffect(() => setK((x) => x + 1), [data]);
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    if (!d && !props.url) return null;
    if (!data) {
        return <div className="w-full flex-1 flex items-center justify-center border-l">{t('geography_settings.loading')}</div>;
    }
    return (
        <div className="w-full flex-1 relative">
            <Renderer key={k} data={data} />
        </div>
    );
}

function Renderer(props: { data?: FeatureCollection }) {
    return (
        <MapContainer
            preferCanvas
            attributionControl={false}
            center={[0, 0]}
            bounds={[
                [-180, -90],
                [180, 90],
            ]}
            renderer={canvas()}
            zoom={1}
            style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
            <TileLayer
                className="map-tile"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AttributionControl prefix="Leaflet" />
            {props.data && <GeoJSON data={props.data} />}
        </MapContainer>
    );
}

function getGeojson(str: string, type: 'GeoJSON' | 'TopoJSON') {
    try {
        const data = JSON.parse(str);
        const geoJSON = type === 'GeoJSON' ? data : (feature(data, Object.keys(data.objects)[0]) as unknown as FeatureCollection);
        if (!('features' in geoJSON)) {
            console.error('Invalid GeoJSON: GeoJSON must be a FeatureCollection, but got', geoJSON);
            return undefined;
        }
        return geoJSON;
    } catch (e) {
        console.error(e);
    }
    return undefined;
}
