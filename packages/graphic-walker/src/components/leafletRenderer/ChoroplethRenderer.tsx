import React, { Fragment, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Polygon, Polyline, Marker, TileLayer, Tooltip, AttributionControl } from 'react-leaflet';
import { type Map, divIcon } from 'leaflet';
import type { DeepReadonly, IChannelScales, IGeoUrl, IRow, IViewField, VegaGlobalConfig } from '../../interfaces';
import type { FeatureCollection } from 'geojson';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import { useColorScale, useOpacityScale } from './encodings';
import { TooltipContent } from './tooltip';
import { useAppRootContext } from '../appRoot';
import { useGeoData } from '../../hooks/service';
import { useTranslation } from 'react-i18next';
import { ChangeView, useDisplayValueFormatter } from './utils';
import ColorPanel from './color';
import { themeContext } from '@/store/theme';
import { WORLD_BOUNDS, extendBounds, resolveParts, ringCentroid, type GeoPart, type LatLngBounds } from '../../lib/geo/geometry';
import { featureKeyValue, geoValueText, matchFeatures } from '../../lib/geo/matching';
import { geoDataErrorOf } from '../../lib/geo/parse';
import { GeoLoadFailed, GeoNotice, type GeoNoticeContent } from './geoNotice';

export interface IChoroplethRendererProps {
    name?: string;
    data: IRow[];
    allFields: DeepReadonly<IViewField[]>;
    features: FeatureCollection | undefined;
    featuresUrl?: IGeoUrl;
    geoKey: string;
    defaultAggregated: boolean;
    geoId: DeepReadonly<IViewField>;
    color: DeepReadonly<IViewField> | undefined;
    opacity: DeepReadonly<IViewField> | undefined;
    text: DeepReadonly<IViewField> | undefined;
    details: readonly DeepReadonly<IViewField>[];
    vegaConfig: VegaGlobalConfig;
    scaleIncludeUnmatchedChoropleth: boolean;
    showAllGeoshapeInChoropleth: boolean;
    scales: IChannelScales;
    tileUrl?: string;
}

export interface IChoroplethRendererRef {}

/** A label as a DOM node. The text goes in as text, so markup in the data stays inert. */
const labelIcon = (label: string) => {
    const node = document.createElement('div');
    node.style.cssText = 'font-size: 11px; transform: translate(-50%, -50%); opacity: 0.8;';
    node.textContent = label;
    return divIcon({ className: '!bg-transparent !border-none', html: node });
};

const fieldKey = (field: DeepReadonly<IViewField>, defaultAggregated: boolean) =>
    defaultAggregated && field.analyticType === 'measure' && field.aggName ? getMeaAggKey(field.fid, field.aggName) : field.fid;

interface IShapeStyle {
    fill: string;
    fillOpacity: number;
    border: string;
}

/** Draws one piece of a feature. `children` is its tooltip. */
function GeoShape({ part, style, label, children }: { part: GeoPart; style: IShapeStyle; label?: string; children?: React.ReactNode }) {
    if (part.type === 'point') {
        return (
            <CircleMarker
                center={part.position}
                radius={3}
                opacity={0.8}
                fillOpacity={style.fillOpacity}
                fillColor={style.fill}
                color={style.border}
                weight={1}
                stroke
                fill
            >
                {children}
            </CircleMarker>
        );
    }
    if (part.type === 'line') {
        return (
            <Polyline positions={part.positions} pathOptions={{ color: style.fill, opacity: Math.max(style.fillOpacity, 0.3), weight: 2 }}>
                {children}
            </Polyline>
        );
    }
    const centre = label ? ringCentroid(part.rings[0]) : null;
    return (
        <>
            <Polygon
                positions={part.rings}
                pathOptions={{
                    fillOpacity: style.fillOpacity * 0.8,
                    fillColor: style.fill,
                    color: style.border,
                    weight: 1,
                    stroke: true,
                    fill: true,
                }}
            >
                {children}
            </Polygon>
            {label && centre && <Marker position={centre} interactive={false} icon={labelIcon(label)} />}
        </>
    );
}

const ChoroplethRenderer = forwardRef<IChoroplethRendererRef, IChoroplethRendererProps>(function ChoroplethRenderer(props, ref) {
    const {
        name,
        data,
        allFields,
        features: localFeatures,
        featuresUrl,
        geoKey,
        defaultAggregated,
        geoId,
        color,
        opacity,
        text,
        details,
        vegaConfig,
        scaleIncludeUnmatchedChoropleth,
        showAllGeoshapeInChoropleth,
        scales,
        tileUrl,
    } = props;

    const darkMode = useContext(themeContext);

    useImperativeHandle(ref, () => ({}));

    const geo = useGeoData(localFeatures, featuresUrl);
    const features = geo.data;
    const { t } = useTranslation('translation');

    const geoValues = useMemo<unknown[]>(() => (geoId ? data.map((row) => row[geoId.fid]) : []), [geoId, data]);

    const match = useMemo(() => (features ? matchFeatures(geoValues, features.features, geoKey) : undefined), [geoValues, features, geoKey]);

    /** The drawable pieces of a feature, worked out on first use. */
    const partsOf = useMemo(() => {
        const cache: GeoPart[][] = [];
        return (index: number) => (cache[index] ??= resolveParts(features?.features[index]?.geometry));
    }, [features]);

    const bounds = useMemo<LatLngBounds>(() => {
        if (!match) return WORLD_BOUNDS;
        let found: LatLngBounds | null = null;
        const seen = new Set<number>();
        for (const row of match.matchedRows) {
            for (const index of match.rowFeatures[row]) {
                if (seen.has(index)) continue;
                seen.add(index);
                found = extendBounds(found, partsOf(index));
            }
        }
        if (!found && showAllGeoshapeInChoropleth) {
            for (const index of match.unusedFeatures) {
                found = extendBounds(found, partsOf(index));
            }
        }
        return found ?? WORLD_BOUNDS;
    }, [match, partsOf, showAllGeoshapeInChoropleth]);

    const distribution = useMemo(() => {
        if (scaleIncludeUnmatchedChoropleth || !match) {
            return data;
        }
        return match.matchedRows.map((i) => data[i]);
    }, [data, match, scaleIncludeUnmatchedChoropleth]);

    const opacityScale = useOpacityScale(distribution, opacity, defaultAggregated, scales);
    const { mapper: colorScale, display: colorDisplay } = useColorScale(distribution, color, defaultAggregated, vegaConfig);

    const tooltipFields = useMemo(() => {
        return details.concat([color!, opacity!].filter(Boolean)).map((f) => ({
            ...f,
            key: fieldKey(f, defaultAggregated),
        }));
    }, [defaultAggregated, details, color, opacity]);

    const textKey = text ? fieldKey(text, defaultAggregated) : '';
    const formatText = useDisplayValueFormatter(text?.semanticType ?? 'nominal', vegaConfig);
    /** A region without data can still carry its name, when names are what the labels show. */
    const labelsShowGeoId = Boolean(text && geoId && text.fid === geoId.fid);

    const border = darkMode === 'dark' ? '#fff4' : '#0004';

    const shapes = useMemo(() => {
        if (!match || !features || !geoId) return null;
        const labelOf = (row: IRow) => {
            const value = textKey ? row[textKey] : undefined;
            return value === undefined || value === null || value === '' ? '' : formatText(value);
        };
        return match.matchedRows.flatMap((i) => {
            const row = data[i];
            const style: IShapeStyle = { fill: colorScale(row), fillOpacity: opacityScale(row), border };
            const label = labelOf(row);
            const header = geoValueText(row[geoId.fid]);
            return match.rowFeatures[i].flatMap((index) =>
                partsOf(index).map((part, j) => (
                    <GeoShape key={`${i}-${index}-${j}-${style.fillOpacity}-${style.fill}`} part={part} style={style} label={label}>
                        {(part.type !== 'point' || tooltipFields.length > 0) && (
                            <Tooltip>
                                <header>{header}</header>
                                {tooltipFields.map((f, k) => (
                                    <TooltipContent key={k} allFields={allFields} vegaConfig={vegaConfig} field={f} value={row[f.key]} />
                                ))}
                            </Tooltip>
                        )}
                    </GeoShape>
                ))
            );
        });
    }, [match, features, geoId, data, partsOf, colorScale, opacityScale, border, textKey, formatText, tooltipFields, allFields, vegaConfig]);

    const missingShapes = useMemo(() => {
        if (!match || !features || !showAllGeoshapeInChoropleth) return null;
        const style: IShapeStyle = { fill: '#808080', fillOpacity: 0.3, border };
        return match.unusedFeatures.flatMap((index) => {
            const name = geoValueText(featureKeyValue(features.features[index], geoKey));
            return partsOf(index).map((part, j) => (
                <GeoShape key={`missing-${index}-${j}`} part={part} style={style} label={labelsShowGeoId ? name : ''}>
                    {(part.type !== 'point' || tooltipFields.length > 0) && (
                        <Tooltip>
                            <header>{name}</header>
                            {tooltipFields.map((f, k) => (
                                <p key={k}>{f.analyticType === 'measure' && f.aggName ? getMeaAggName(f.name, f.aggName) : f.name}: Null</p>
                            ))}
                        </Tooltip>
                    )}
                </GeoShape>
            ));
        });
    }, [match, features, showAllGeoshapeInChoropleth, geoKey, partsOf, border, labelsShowGeoId, tooltipFields]);

    const notice = useMemo<GeoNoticeContent | null>(() => {
        if (!features) return localFeatures || featuresUrl ? null : { state: 'no_data' };
        if (!geoId) return { state: 'no_field' };
        if (!match || data.length === 0) return null;
        if (match.keyedFeatures === 0) return { state: 'bad_key', key: geoKey };
        if (match.unmatchedRows === 0 && match.emptyRows === 0) return null;
        return {
            state: 'unmatched',
            key: geoKey,
            matched: match.distinctValues - match.unmatchedValues.length,
            total: match.distinctValues,
            unmatchedValues: match.unmatchedValues,
            featureSamples: match.unmatchedRows > 0 ? match.featureSamples : [],
            emptyRows: match.emptyRows,
        };
    }, [features, localFeatures, featuresUrl, geoId, match, data, geoKey]);

    useEffect(() => {
        if (match && match.unmatchedRows > 0) {
            console.warn(
                `Failed to render ${match.unmatchedRows.toLocaleString()} items of ${data.length.toLocaleString()} rows due to missing geojson feature.`
            );
        }
    }, [match]);

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

    const appRef = useAppRootContext();

    useEffect(() => {
        const ctx = appRef.current;
        if (ctx) {
            ctx.exportChart = async (mode) => ({
                mode,
                title: name || 'untitled',
                nCols: 0,
                nRows: 0,
                charts: [],
                container: () => (mapRef.current?.getContainer() as HTMLDivElement) ?? null,
                chartType: 'map',
            });
        }
    }, []);

    if (geo.loading) {
        return <div className="flex items-center justify-center w-full h-full">{t('main.tabpanel.settings.geography_settings.loading')}</div>;
    }
    if (geo.error) {
        return <GeoLoadFailed error={geoDataErrorOf(geo.error)} onRetry={geo.retry} />;
    }

    return (
        <MapContainer preferCanvas attributionControl={false} ref={mapRef} zoom={5} bounds={bounds} style={{ width: '100%', height: '100%', zIndex: 1 }}>
            <ChangeView bounds={bounds} />
            {tileUrl === undefined && (
                <TileLayer
                    className="map-tile"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
            )}
            {tileUrl && <TileLayer className="map-tile" url={tileUrl} />}
            <AttributionControl prefix="Leaflet" />
            {shapes}
            {missingShapes}
            {colorDisplay && <ColorPanel display={colorDisplay} field={color!} />}
            {notice && <GeoNotice notice={notice} />}
        </MapContainer>
    );
});

export default ChoroplethRenderer;
