import { useMemo } from "react";
import { timeFormat as tFormat } from "d3-time-format";
import { format } from "d3-format";
import type { Config as VlConfig } from 'vega-lite';
import type { ISemanticType, VegaGlobalConfig } from "../../interfaces";
import { useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from 'leaflet';

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

export function ChangeView({ bounds }: {bounds: LatLngBoundsExpression}) {
    const map = useMap();
    map.flyToBounds(bounds);
    return null;
}