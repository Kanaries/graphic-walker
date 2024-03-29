import React, { forwardRef, useMemo } from 'react';
import type { DraggableFieldState, IChannelScales, IConfigScale, IRow, IVisualConfigNew, IVisualLayout, VegaGlobalConfig } from '../../interfaces';
import POIRenderer from './POIRenderer';
import ChoroplethRenderer from './ChoroplethRenderer';

export interface ILeafletRendererProps {
    name?: string;
    vegaConfig?: VegaGlobalConfig;
    draggableFieldState: DraggableFieldState;
    visualConfig: IVisualConfigNew;
    visualLayout: IVisualLayout;
    data: IRow[];
    scales?: IChannelScales;
    scale?: {
        opacity: IConfigScale;
        size: IConfigScale;
    };
}

export interface ILeafletRendererRef {}

export const LEAFLET_DEFAULT_WIDTH = 800;
export const LEAFLET_DEFAULT_HEIGHT = 600;

const LeafletRenderer = forwardRef<ILeafletRendererRef, ILeafletRendererProps>(function LeafletRenderer(props, ref) {
    const { name, draggableFieldState, data, visualConfig, visualLayout, vegaConfig = {}, scales: channelScaleRaw, scale } = props;
    const {
        latitude: [lat],
        longitude: [lng],
        geoId: [geoId],
        dimensions,
        measures,
        size: [size],
        color: [color],
        opacity: [opacity],
        text: [text],
        details,
    } = draggableFieldState;
    const {
        defaultAggregated,
        geoms: [markType],
    } = visualConfig;
    const { geojson, geoKey = '', geoUrl, scaleIncludeUnmatchedChoropleth = false, showAllGeoshapeInChoropleth = false, geoMapTileUrl } = visualLayout;
    const allFields = useMemo(() => [...dimensions, ...measures], [dimensions, measures]);
    const latField = useMemo(() => allFields.find((f) => f.geoRole === 'latitude'), [allFields]);
    const lngField = useMemo(() => allFields.find((f) => f.geoRole === 'longitude'), [allFields]);
    const latitude = useMemo(() => lat ?? latField, [lat, latField]);
    const longitude = useMemo(() => lng ?? lngField, [lng, lngField]);
    const scales = useMemo(() => {
        const cs = channelScaleRaw ?? {};
        if (scale?.opacity) {
            cs.opacity = {
                ...(cs.opacity ?? {}),
                ...scale.opacity,
            };
        }
        if (scale?.size) {
            cs.size = {
                ...(cs.size ?? {}),
                ...scale.size,
            };
        }
        return cs;
    }, [channelScaleRaw, scale]);

    const tileUrl = geoMapTileUrl ?? vegaConfig.leafletGeoTileUrl;

    if (markType === 'poi') {
        return (
            <POIRenderer
                tileUrl={tileUrl}
                name={name}
                data={data}
                allFields={allFields}
                defaultAggregated={defaultAggregated}
                latitude={latitude}
                longitude={longitude}
                color={color}
                opacity={opacity}
                size={size}
                details={details}
                vegaConfig={vegaConfig}
                scales={scales}
            />
        );
    } else if (markType === 'choropleth') {
        return (
            <ChoroplethRenderer
                tileUrl={tileUrl}
                name={name}
                data={data}
                allFields={allFields}
                features={geojson}
                featuresUrl={geoUrl}
                geoKey={geoKey}
                defaultAggregated={defaultAggregated}
                geoId={geoId}
                color={color}
                opacity={opacity}
                text={text}
                details={details}
                vegaConfig={vegaConfig}
                scaleIncludeUnmatchedChoropleth={scaleIncludeUnmatchedChoropleth}
                showAllGeoshapeInChoropleth={showAllGeoshapeInChoropleth}
                scales={scales}
            />
        );
    }

    return null;
});

export default LeafletRenderer;
