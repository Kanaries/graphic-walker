import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, AttributionControl } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import { canvas, circleMarker } from 'leaflet';
import { useTranslation } from 'react-i18next';
import { WORLD_BOUNDS, drawableGeometry } from '../../lib/geo/geometry';

/**
 * A preview of the shapes in a file, for the geography settings. `tileUrl` follows the chart's own
 * setting: undefined draws the default basemap, an empty string draws none.
 */
export function GeojsonRenderer(props: { data?: FeatureCollection; loading?: boolean; tileUrl?: string }) {
    const { data, loading, tileUrl } = props;
    const [k, setK] = useState(0);
    // Leaflet's GeoJSON layer reads its data once, so new data needs a new layer.
    useEffect(() => setK((x) => x + 1), [data]);
    // Leaflet throws on a coordinate it cannot read, which would take the whole dialog down. So the
    // preview gets only the geometry the chart itself would draw.
    const drawable = useMemo<FeatureCollection | undefined>(() => {
        if (!data) return undefined;
        return {
            type: 'FeatureCollection',
            features: data.features.flatMap((feature) => {
                const geometry = drawableGeometry(feature?.geometry);
                return geometry ? [{ type: 'Feature' as const, properties: {}, geometry }] : [];
            }),
        };
    }, [data]);
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    if (loading) {
        return <div className="w-full flex-1 flex items-center justify-center border-l">{t('geography_settings.loading')}</div>;
    }
    if (!drawable) return null;
    return (
        <div className="w-full flex-1 relative" data-testid="geo-config-preview">
            <Renderer key={k} data={drawable} tileUrl={tileUrl} />
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
            {/* Points as small circles, the way the chart draws them. Leaflet's default is an image marker. */}
            {props.data && <GeoJSON data={props.data} pointToLayer={(_, position) => circleMarker(position, { radius: 3, weight: 1 })} />}
        </MapContainer>
    );
}
