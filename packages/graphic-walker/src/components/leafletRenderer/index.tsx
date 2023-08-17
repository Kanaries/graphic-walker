import React, { forwardRef, useMemo } from "react";
import type { DeepReadonly, DraggableFieldState, IRow, IVisualConfig, VegaGlobalConfig } from "../../interfaces";
import POIRenderer from "./POIRenderer";
import ChoroplethRenderer from "./ChoroplethRenderer";


export interface ILeafletRendererProps {
    name?: string;
    vegaConfig?: VegaGlobalConfig;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: DeepReadonly<IVisualConfig>;
    data: IRow[];
}

export interface ILeafletRendererRef {}

export const LEAFLET_DEFAULT_WIDTH = 800;
export const LEAFLET_DEFAULT_HEIGHT = 600;

const LeafletRenderer = forwardRef<ILeafletRendererRef, ILeafletRendererProps>(function LeafletRenderer (props, ref) {
    const { name, draggableFieldState, data, visualConfig, vegaConfig = {} } = props;
    const { latitude: [lat], longitude: [lng], geoId: [geoId], dimensions, measures, size: [size], color: [color], opacity: [opacity], text: [text], details } = draggableFieldState;
    const { defaultAggregated, geoms: [markType], geojson, geoKey = '', scaleIncludeUnmatchedChoropleth = false } = visualConfig;
    const allFields = useMemo(() => [...dimensions, ...measures], [dimensions, measures]);
    const latField = useMemo(() => allFields.find((f) => f.geoRole === 'latitude'), [allFields]);
    const lngField = useMemo(() => allFields.find((f) => f.geoRole === 'longitude'), [allFields]);
    const latitude = useMemo(() => lat ?? latField, [lat, latField]);
    const longitude = useMemo(() => lng ?? lngField, [lng, lngField]);

    if (markType === 'poi') {
        return (
            <POIRenderer
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
            />
        );
    } else if (markType === 'choropleth') {
        return (
            <ChoroplethRenderer
                name={name}
                data={data}
                allFields={allFields}
                features={geojson}
                geoKey={geoKey}
                defaultAggregated={defaultAggregated}
                geoId={geoId}
                color={color}
                opacity={opacity}
                text={text}
                details={details}
                vegaConfig={vegaConfig}
                scaleIncludeUnmatchedChoropleth={scaleIncludeUnmatchedChoropleth}
            />
        );
    }

    return null;
});


export default LeafletRenderer;
