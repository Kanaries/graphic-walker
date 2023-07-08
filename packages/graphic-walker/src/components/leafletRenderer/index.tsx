import React, { forwardRef, useMemo } from "react";
import type { DeepReadonly, DraggableFieldState, IRow, IVisualConfig, VegaGlobalConfig } from "../../interfaces";
import POIRenderer from "./POIRenderer";
import ChoroplethRenderer from "./ChoroplethRenderer";


export interface ILeafletRendererProps {
    vegaConfig?: VegaGlobalConfig;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: DeepReadonly<IVisualConfig>;
    data: IRow[];
}

export interface ILeafletRendererRef {}

const LeafletRenderer = forwardRef<ILeafletRendererRef, ILeafletRendererProps>(function LeafletRenderer (props, ref) {
    const { draggableFieldState, data, visualConfig, vegaConfig = {} } = props;
    const { latitude: [lat], longitude: [lng], geoId: [geoId], dimensions, measures, size: [size], color: [color], opacity: [opacity], text: [text], details } = draggableFieldState;
    const { defaultAggregated, geoms: [markType], geojson, geoKey = '' } = visualConfig;
    const allFields = useMemo(() => [...dimensions, ...measures], [dimensions, measures]);
    const latField = useMemo(() => allFields.find((f) => f.geoRole === 'latitude'), [allFields]);
    const lngField = useMemo(() => allFields.find((f) => f.geoRole === 'longitude'), [allFields]);
    const latitude = useMemo(() => lat ?? latField, [lat, latField]);
    const longitude = useMemo(() => lng ?? lngField, [lng, lngField]);

    if (markType === 'poi') {
        return (
            <POIRenderer
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
            />
        );
    }

    return null;
});


export default LeafletRenderer;
