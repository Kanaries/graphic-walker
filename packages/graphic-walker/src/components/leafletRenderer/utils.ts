import { useEffect, useMemo, useRef } from "react";
import { timeFormat as tFormat } from "d3-time-format";
import { format } from "d3-format";
import type { Config as VlConfig } from 'vega-lite';
import type { ISemanticType, VegaGlobalConfig } from "../../interfaces";
import { useMap } from "react-leaflet";
import type { LatLngBounds } from '../../lib/geo/geometry';

const defaultFormatter = (value: unknown): string => `${value}`;

export const useDisplayValueFormatter = (semanticType: ISemanticType, vegaConfig: VegaGlobalConfig): (value: unknown) => string => {
    const { timeFormat = "%b %d, %Y", numberFormat } = vegaConfig as Partial<VlConfig>;
    const timeFormatter = useMemo<(value: unknown) => string>(() => {
        const tf = tFormat(timeFormat);
        return (value: unknown) => {
            if (typeof value !== 'number' && typeof value !== 'string') {
                return '';
            }
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            return tf(date);
        };
    }, [timeFormat]);
    const numberFormatter = useMemo<(value: unknown) => string>(() => {
        if (!numberFormat) {
            return (value: unknown) => {
                if (typeof value !== 'number') {
                    return '';
                }
                return value.toLocaleString();
            };
        }
        const nf = format(numberFormat);
        return (value: unknown) => {
            if (typeof value !== 'number') {
                return '';
            }
            return nf(value);
        };
    }, [numberFormat]);
    const formatter = useMemo(() => {
        if (semanticType === 'quantitative') {
            return numberFormatter;
        } else if (semanticType === 'temporal') {
            return timeFormatter;
        } else {
            return defaultFormatter;
        }
    }, [semanticType, numberFormatter, timeFormatter]);
    return formatter;
};

/**
 * Moves the map to `bounds` when their values change, and at no other time, so a re-render for an
 * unrelated reason leaves the user's zoom and pan alone. A map that has no size yet is fitted once
 * it gets one.
 */
export function ChangeView({ bounds }: { bounds: LatLngBounds }) {
    const map = useMap();
    const key = bounds.flat().join(',');
    const shown = useRef<string | null>(null);
    useEffect(() => {
        const show = () => {
            if (shown.current === key) return;
            const size = map.getSize();
            if (!size.x || !size.y) return;
            if (shown.current === null) {
                map.fitBounds(bounds, { animate: false });
            } else {
                map.flyToBounds(bounds);
            }
            shown.current = key;
        };
        show();
        map.on('resize', show);
        return () => {
            map.off('resize', show);
        };
    }, [map, key]);
    return null;
}