import React, { Fragment, forwardRef, useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, Polygon, Marker, TileLayer, Tooltip } from "react-leaflet";
import { type Map, divIcon } from "leaflet";
import type { DeepReadonly, IRow, IViewField, VegaGlobalConfig } from "../../interfaces";
import type { FeatureCollection, Geometry } from "geojson";
import { getMeaAggKey } from "../../utils";
import { useColorScale, useOpacityScale } from "./encodings";
import { isValidLatLng } from "./POIRenderer";


export interface IChoroplethRendererProps {
    data: IRow[];
    allFields: DeepReadonly<IViewField[]>;
    features: FeatureCollection | undefined;
    geoKey: string;
    defaultAggregated: boolean;
    geoId: DeepReadonly<IViewField>;
    color: DeepReadonly<IViewField> | undefined;
    opacity: DeepReadonly<IViewField> | undefined;
    text: DeepReadonly<IViewField> | undefined;
    details: readonly DeepReadonly<IViewField>[];
    vegaConfig: VegaGlobalConfig;
}

export interface IChoroplethRendererRef {}

const resolveCoords = (featureGeom: Geometry): [lat: number, lng: number][][] => {
    switch (featureGeom.type) {
        case 'Polygon': {
            const coords = featureGeom.coordinates[0];
            return [coords.map<[lat: number, lng: number]>(c => [c[1], c[0]])];
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
            return [coords.map<[lat: number, lng: number]>(c => [c[1], c[0]])];
        }
        case 'MultiLineString': {
            const coords = featureGeom.coordinates;
            return coords.map<[lat: number, lng: number][]>(c => c.map<[lat: number, lng: number]>(c => [c[1], c[0]]));
        }
        case 'MultiPoint': {
            const coords = featureGeom.coordinates;
            return [coords.map<[lat: number, lng: number]>(c => [c[1], c[0]])];
        }
        case 'MultiPolygon': {
            const coords = featureGeom.coordinates;
            return coords.map<[lat: number, lng: number][]>(c => c[0].map<[lat: number, lng: number]>(c => [c[1], c[0]]));
        }
        default: {
            return [];
        }
    }
};

const resolveCenter = (coordinates: [lat: number, lng: number][]): [lng: number, lat: number] => {
    let area = 0;
    let centroid: [lat: number, lng: number] = [0, 0];

    for (let i = 0; i < coordinates.length - 1; i++) {
        let [x1, y1] = coordinates[i];
        let [x2, y2] = coordinates[i + 1];

        let tempArea = x1 * y2 - x2 * y1;
        area += tempArea;

        centroid[0] += (x1 + x2) * tempArea;
        centroid[1] += (y1 + y2) * tempArea;
    }

    area /= 2;

    centroid[0] /= 6 * area;
    centroid[1] /= 6 * area;

    return centroid;
};

const ChoroplethRenderer = forwardRef<IChoroplethRendererRef, IChoroplethRendererProps>(function ChoroplethRenderer (props, ref) {
    const { data, allFields, features, geoKey, defaultAggregated, geoId, color, opacity, text, details, vegaConfig } = props;

    const geoIndices = useMemo(() => {
        if (geoId) {
            return data.map(row => row[geoId.fid]);
        }
        return [];
    }, [geoId, data]);

    const geoShapes = useMemo(() => {
        if (geoIndices.length && geoKey && features) {
            return geoIndices.map(id => {
                const feature = id ? features.features.find(f => f.properties?.[geoKey] === id) : undefined;
                return feature;
            });
        }
        return [];
    }, [geoIndices, features, geoKey]);

    useEffect(() => {
        if (geoShapes.length > 0) {
            const notMatched = geoShapes.filter(f => !f);
            if (notMatched.length) {
                console.warn(`Failed to render ${notMatched.length.toLocaleString()} items of ${data.length.toLocaleString()} rows due to missing geojson feature.`);
            }
        }
    }, [geoShapes]);

    const lngLat = useMemo<[lat: number, lng: number][][][]>(() => {
        if (geoShapes.length > 0) {
            return geoShapes.map<[lat: number, lng: number][][]>(feature => {
                if (feature) {
                    return resolveCoords(feature.geometry);
                }
                return [];
            }, []);
        }
        return [];
    }, [geoShapes]);

    const [bounds, center] = useMemo<[bounds: [[n: number, w: number], [s: number, e: number]], center: [lng: number, lat: number]]>(() => {
        const allLngLat = lngLat.flat(2);
        if (allLngLat.length > 0) {
            const [bounds, coords] = allLngLat.reduce<[bounds: [[w: number, n: number], [e: number, s: number]], center: [lat: number, lng: number]]>(([bounds, acc], [lat, lng]) => {
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

    const opacityScale = useOpacityScale(data, opacity, defaultAggregated);
    const colorScale = useColorScale(data, color, defaultAggregated, vegaConfig);

    const tooltipFields = useMemo(() => {
        return details.concat(
            [color!, opacity!].filter(Boolean)
        ).map(f => ({
            ...f,
            key: defaultAggregated && f.analyticType === 'measure' && f.aggName ? getMeaAggKey(f.fid, f.aggName) : f.fid,
        }));
    }, [defaultAggregated, details, color, opacity]);

    const getFieldName = (fid: string, aggName: string | undefined) => {
        const name = allFields.find((f) => f.fid === fid)?.name ?? fid;
        return aggName ? `${aggName}(${name})` : name;
    };

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

    return (
        <MapContainer center={center} ref={mapRef} zoom={5} bounds={bounds} style={{ width: '100%', height: '100%', zIndex: 1 }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {lngLat.length > 0 && data.map((row, i) => {
                const coords = lngLat[i];
                const opacity = opacityScale(row);
                const color = colorScale(row);
                return (
                    <Fragment key={`${i}-${opacity}-${color}`}>
                        {coords.map((coord, j) => {
                            if (coord.length === 0) {
                                return null;
                            }
                            if (coord.length === 1) {
                                return (
                                    <CircleMarker
                                        key={j}
                                        center={coord[0]}
                                        radius={3}
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
                                                <header>{data[i][geoId.fid]}</header>
                                                {tooltipFields.map(({ fid, aggName, key }, j) => (
                                                    <p key={j}>{getFieldName(fid, aggName)}: {row[key]}</p>
                                                ))}
                                            </Tooltip>
                                        )}
                                    </CircleMarker>
                                )
                            }
                            const center: [lat: number, lng: number] = text && coord.length >= 3 ? resolveCenter(coord) : [NaN, NaN];
                            return (
                                <Fragment key={j}>
                                    <Polygon
                                        positions={coord}
                                        pathOptions={{
                                            fillOpacity: opacity * 0.8,
                                            fillColor: color,
                                            color: "#0004",
                                            weight: 1,
                                            stroke: true,
                                            fill: true,
                                        }}
                                    >
                                        <Tooltip>
                                            <header>{data[i][geoId.fid]}</header>
                                            {tooltipFields.map(({ fid, aggName, key }, j) => (
                                                <p key={j}>{getFieldName(fid, aggName)}: {row[key]}</p>
                                            ))}
                                        </Tooltip>
                                    </Polygon>
                                    {text && data[i][text.fid] && isValidLatLng(center[0], center[1]) && (
                                        <Marker
                                            position={center}
                                            interactive={false}
                                            icon={divIcon({
                                                className: '!bg-transparent !border-none',
                                                html: `<div style="font-size: 11px; transform: translate(-50%, -50%); opacity: 0.8;">${data[i][text.fid]}</div>`,
                                            })}
                                        />
                                    )}
                                </Fragment>
                            );
                        })}
                    </Fragment>
                );
            })}
        </MapContainer>
    );
});


export default ChoroplethRenderer;
