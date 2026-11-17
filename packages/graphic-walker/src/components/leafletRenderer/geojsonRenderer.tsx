import React, { useEffect, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, AttributionControl } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import { canvas } from 'leaflet';
import { useTranslation } from 'react-i18next';
import { WORLD_BOUNDS } from '../../lib/geo/geometry';

/**
 * A preview of the shapes in a file, for the geography settings. `tileUrl` follows the chart's own
 * setting: undefined draws the default basemap, an empty string draws none.
 */
export function GeojsonRenderer(props: { data?: FeatureCollection; loading?: boolean; tileUrl?: string }) {
    const { data, loading, tileUrl } = props;
    const [k, setK] = useState(0);
    // Leaflet's GeoJSON layer reads its data once, so new data needs a new layer.
    useEffect(() => setK((x) => x + 1), [data]);
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    if (loading) {
        return <div className="w-full flex-1 flex items-center justify-center border-l">{t('geography_settings.loading')}</div>;
    }
    if (!data) return null;
    return (
        <div className="w-full flex-1 relative" data-testid="geo-config-preview">
            <Renderer key={k} data={data} tileUrl={tileUrl} />
        </div>
    );
}

function Renderer(props: { data?: FeatureCollection; tileUrl?: string }) {
    return (
        <MapContainer
            preferCanvas
            attributionControl={false}
            center={[0, 0]}
            bounds={WORLD_BOUNDS}
            renderer={canvas()}
            zoom={1}
            style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
            {props.tileUrl === undefined && (
                <TileLayer
                    className="map-tile"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
            )}
            {props.tileUrl && <TileLayer className="map-tile" url={props.tileUrl} />}
            <AttributionControl prefix="Leaflet" />
            {props.data && <GeoJSON data={props.data} />}
        </MapContainer>
    );
}
