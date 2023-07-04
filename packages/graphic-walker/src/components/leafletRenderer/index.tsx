import React, { forwardRef, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Tooltip, CircleMarker } from "react-leaflet";
import type { Map } from "leaflet";
import type { DeepReadonly, DraggableFieldState, IRow, IVisualConfig, VegaGlobalConfig } from "../../interfaces";
import { getMeaAggKey } from "../../utils";
import { useColorScale, useOpacityScale, useSizeScale } from "./encodings";


export interface ILeafletRendererProps {
    vegaConfig?: VegaGlobalConfig;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: DeepReadonly<IVisualConfig>;
    data: IRow[];
}

export interface ILeafletRendererRef {}

const isValidLatLng = (latRaw: unknown, lngRaw: unknown) => {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const formatCoerceLatLng = (latRaw: unknown, lngRaw: unknown) => {
    return `${
        typeof latRaw === 'number' ? latRaw : JSON.stringify(latRaw)
    }, ${
        typeof lngRaw === 'number' ? lngRaw : JSON.stringify(lngRaw)
    }`;
};

const debugMaxLen = 20;

const LeafletRenderer = forwardRef<ILeafletRendererRef, ILeafletRendererProps>(function LeafletRenderer (props, ref) {
    const { draggableFieldState, data, visualConfig, vegaConfig = {} } = props;
    const { latitude: [lat], longitude: [lng], details, dimensions, measures, size, color, shape, opacity, text } = draggableFieldState;
    const { defaultAggregated } = visualConfig;
    const allFields = useMemo(() => [...dimensions, ...measures], [dimensions, measures]);
    const latField = useMemo(() => allFields.find((f) => f.geoRole === 'latitude'), [allFields]);
    const lngField = useMemo(() => allFields.find((f) => f.geoRole === 'longitude'), [allFields]);
    const latitude = useMemo(() => lat ?? latField, [lat, latField]);
    const longitude = useMemo(() => lng ?? lngField, [lng, lngField]);
    
    // TODO: web worker
    const lngLat = useMemo<[lat: number, lng: number][]>(() => {
        if (longitude && latitude) {
            return data.map<[lat: number, lng: number]>(row => [Number(row[latitude.fid]), Number(row[longitude.fid])]).filter(v => isValidLatLng(v[0], v[1]));
        }
        return [];
    }, [longitude, latitude, data]);

    const [bounds, center] = useMemo<[bounds: [[n: number, w: number], [s: number, e: number]], center: [lng: number, lat: number]]>(() => {
        if (lngLat.length > 0) {
            const [bounds, coords] = lngLat.reduce<[bounds: [[w: number, n: number], [e: number, s: number]], center: [lat: number, lng: number]]>(([bounds, acc], [lat, lng]) => {
                if (lng < bounds[0][0]) {
                    bounds[0][0] = lng;
                }
                if (lng > bounds[1][0]) {
                    bounds[1][0] = lng;
                }
                if (lat < bounds[0][1]) {
                    bounds[0][1] = lat;
                }
                if (lat > bounds[1][1]) {
                    bounds[1][1] = lat;
                }
                return [bounds, [acc[0] + lng, acc[1] + lat]];
            }, [[[-180, -90], [180, 90]], [0, 0]]);
            return [bounds, [coords[0] / lngLat.length, coords[1] / lngLat.length] as [number, number]];
        }
                
        return [[[-180, -90], [180, 90]], [0, 0]];
    }, [lngLat]);

    const failedLatLngListRef = useRef<[index: number, lng: unknown, lat: unknown][]>([]);
    failedLatLngListRef.current = [];

    useEffect(() => {
        if (failedLatLngListRef.current.length > 0) {
            console.warn(`Failed to render ${failedLatLngListRef.current.length.toLocaleString()} markers of ${data.length.toLocaleString()} rows due to invalid lat/lng.\n--------\n${
                `${failedLatLngListRef.current.slice(0, debugMaxLen).map(([idx, lng, lat]) =>
                    `[${idx + 1}] ${formatCoerceLatLng(lat, lng)}`
                ).join('\n')}`
                + (failedLatLngListRef.current.length > debugMaxLen ? `\n\t... and ${(failedLatLngListRef.current.length - debugMaxLen).toLocaleString()} more` : '')
            }\n`);
        }
    });

    const mapRef = useRef<Map>(null);

    useEffect(() => {
        const container = mapRef.current?.getContainer();
        if (container) {
            const ro = new ResizeObserver(() => {
                mapRef.current?.invalidateSize();
            });
            ro.observe(container);
            return () => {
                ro.unobserve(container);
            };
        }
    });

    useEffect(() => {
        mapRef.current?.flyToBounds(bounds);
    }, [`${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`]);

    const sizeScale = useSizeScale(data, size[0], defaultAggregated);
    const opacityScale = useOpacityScale(data, opacity[0], defaultAggregated);
    const colorScale = useColorScale(data, color[0], defaultAggregated, vegaConfig);

    const tooltipFields = useMemo(() => {
        return details.concat(
            [size, color, shape, opacity, text].map((enc) => enc[0]).filter(Boolean)
        ).map(f => ({
            ...f,
            key: defaultAggregated && f.analyticType === 'measure' && f.aggName ? getMeaAggKey(f.fid, f.aggName) : f.fid,
        }));
    }, [defaultAggregated, details, size, color, shape, opacity, text]);

    const getFieldName = (fid: string, aggName: string | undefined) => {
        const name = allFields.find((f) => f.fid === fid)?.name ?? fid;
        return aggName ? `${aggName}(${name})` : name;
    };
    
    return (
        <MapContainer center={center} ref={mapRef} zoom={8} bounds={bounds} style={{ width: '100%', height: '100%', zIndex: 1 }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {Boolean(latitude && longitude) && data.map((row, i) => {
                const lat = row[latitude.fid];
                const lng = row[longitude.fid];
                if (!isValidLatLng(lat, lng)) {
                    failedLatLngListRef.current.push([i, lat, lng]);
                    return null;
                }
                const radius = sizeScale(row);
                const opacity = opacityScale(row);
                const color = colorScale(row);
                return (
                    <CircleMarker
                        key={`${i}-${radius}-${opacity}-${color}`}
                        center={[Number(lat), Number(lng)]}
                        radius={radius}
                        opacity={0.8}
                        fillOpacity={opacity}
                        fillColor={color}
                        color="#0004"
                        weight={1}
                        stroke
                        fill
                    >
                        {tooltipFields.length > 0 && (
                            <Tooltip>
                                {tooltipFields.map(({ fid, aggName, key }, j) => (
                                    <p key={j}>{getFieldName(fid, aggName)}: {row[key]}</p>
                                ))}
                            </Tooltip>
                        )}
                    </CircleMarker>
                );
            })}
        </MapContainer>
    );
});


export default LeafletRenderer;
