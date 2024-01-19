import { useCallback, useMemo } from 'react';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import type { IChannelScales, IRow, IScale, IViewField, VegaGlobalConfig } from '../../interfaces';
import { getMeaAggKey, isNotEmpty } from '../../utils';
import { getColor } from '../../utils/useTheme';
import { resolveScale } from '../../vis/spec/view';

export interface Scale<T> {
    (record: IRow): T;
}

export type ColorDisplay =
    | { type: 'nominal'; colors: { name: string; color: string }[] }
    | {
          type: 'quantitative' | 'temporal';
          color: string[];
          domain: [number, number];
      };

export const useColorScale = (
    data: IRow[],
    field: IViewField | null | undefined,
    defaultAggregate: boolean,
    vegaConfig: VegaGlobalConfig
): {
    mapper: Scale<string>;
    display?: ColorDisplay;
} => {
    const { nominalPalette, primaryColor, quantitativePalette } = useMemo(() => getColor(vegaConfig), [vegaConfig]);
    const fixedScale = useMemo(() => () => primaryColor, [primaryColor]);
    const key = useMemo(() => {
        if (!field) {
            return '';
        }
        if (defaultAggregate && field.aggName && field.analyticType === 'measure') {
            return getMeaAggKey(field.fid, field.aggName);
        }
        return field.fid;
    }, [field, defaultAggregate]);
    const domain = useMemo<[number, number]>(() => {
        if (!field || field.semanticType === 'nominal') {
            return [0, 0];
        }
        return data.reduce(
            (dom: [number, number], { [key]: cur }) => {
                if (cur < dom[0]) {
                    dom[0] = cur;
                }
                if (cur > dom[1]) {
                    dom[1] = cur;
                }
                return dom;
            },
            [Infinity, -Infinity]
        );
    }, [data, field, key]);
    const distributions = useMemo(() => {
        if (!field || field.semanticType !== 'nominal') {
            return [];
        }
        return [
            ...data.reduce((set: Set<string>, row) => {
                set.add(row[key]);
                return set;
            }, new Set<string>()),
        ];
    }, [data, field, key]);

    const continuousScale = useMemo(() => {
        const [min, max] = domain;
        const linearDomains = quantitativePalette.map((_, i) => min + (max - min) * i / (quantitativePalette.length - 1));
        const scale = scaleLinear<string, string>().domain(linearDomains).range(quantitativePalette);
        return function ColorScale(row: IRow) {
            return scale(Number(row[key]));
        };
    }, [domain, key, quantitativePalette]);
    const discreteScale = useMemo(() => {
        const scale = scaleOrdinal<string, string>().domain(distributions).range(nominalPalette);
        return function ColorScale(row: IRow) {
            return scale(row[key]);
        };
    }, [distributions, nominalPalette]);
    const discreteScaleList = useMemo(() => distributions.map((name) => ({ name, color: discreteScale({ [key]: name }) })), [distributions, discreteScale]);

    if (!field) {
        return {
            mapper: fixedScale,
        };
    }
    if (field.semanticType === 'quantitative' || field.semanticType === 'temporal') {
        // continuous
        return {
            mapper: continuousScale,
            display: { type: field.semanticType, color: quantitativePalette, domain },
        };
    }
    return {
        mapper: discreteScale,
        display: { type: 'nominal', colors: discreteScaleList },
    };
};

const useDomain = (key: string, data: IRow[], scale?: IScale) => {
    return useMemo(() => {
        let minDomain: number | undefined;
        let maxDomain: number | undefined;
        if (scale) {
            if (scale.domain) {
                minDomain = Number(scale.domain[0]);
                maxDomain = Number(scale.domain[1]);
            }
            if (isNotEmpty(scale.domainMin)) {
                minDomain = scale.domainMin;
            }
            if (isNotEmpty(scale.domainMax)) {
                maxDomain = scale.domainMax;
            }
        }
        if (isNotEmpty(minDomain) && isNotEmpty(maxDomain)) {
            return [minDomain, maxDomain];
        }
        if (!key) {
            return [minDomain ?? 0, maxDomain ?? 0];
        }
        const values = data.map((row) => Number(row[key])).filter((val) => !isNaN(val));
        if (values.length === 0) {
            return [minDomain ?? 0, maxDomain ?? 0];
        }
        const [minDataDomain, maxDataDomain] = values.slice(1).reduce<[number, number]>(
            (acc, val) => {
                if (val < acc[0]) {
                    acc[0] = val;
                }
                if (val > acc[1]) {
                    acc[1] = val;
                }
                return acc;
            },
            [values[0], values[0]]
        );
        return [minDomain ?? minDataDomain, maxDomain ?? maxDataDomain];
    }, [key, data, scale]);
};

const useRange = (defaultMin: number, defaultMax: number, scale?: IScale) => {
    return useMemo(() => {
        let minRange: number | undefined;
        let maxRange: number | undefined;
        if (scale) {
            if (scale.range) {
                minRange = Number(scale.range[0]);
                maxRange = Number(scale.range[1]);
            }
            if (isNotEmpty(scale.rangeMin)) {
                minRange = scale.rangeMin;
            }
            if (isNotEmpty(scale.rangeMax)) {
                maxRange = scale.rangeMax;
            }
        }
        return [minRange ?? defaultMin, maxRange ?? defaultMax];
    }, [scale, defaultMax, defaultMin]);
};

const MIN_SIZE = 2;
const MAX_SIZE = 10;
const DEFAULT_SIZE = 3;

export const useSizeScale = (data: IRow[], field: IViewField | null | undefined, defaultAggregate: boolean, scaleConfig: IChannelScales): Scale<number> => {
    const key = useMemo(() => {
        if (!field) {
            return '';
        }
        if (defaultAggregate && field.aggName && field.analyticType === 'measure') {
            return getMeaAggKey(field.fid, field.aggName);
        }
        return field.fid;
    }, [field, defaultAggregate]);

    const resolvedScale = useMemo(() => {
        if (!scaleConfig.size) return undefined;
        return resolveScale(scaleConfig.size, field, data, 'light');
    }, [scaleConfig, data, field]);

    const [domainMin, domainMax] = useDomain(key, data, resolvedScale);

    const [minSize, maxSize] = useRange(MIN_SIZE, MAX_SIZE, resolvedScale);

    return useCallback(
        function SizeScale(record: IRow): number {
            const defaultSize = Math.max(minSize, Math.min(DEFAULT_SIZE, maxSize));
            if (!key) {
                return defaultSize;
            }
            const val = Number(record[key]);
            if (isNaN(val)) {
                return defaultSize;
            }
            const percent = Math.max(Math.min((val - domainMin) / (domainMax - domainMin), 1), 0);
            return minSize + Math.sqrt(percent) * (maxSize - minSize);
        },
        [key, domainMin, domainMax, minSize, maxSize, defaultAggregate]
    );
};

const MIN_OPACITY = 0.3;
const MAX_OPACITY = 0.8;
const DEFAULT_OPACITY = 1;

export const useOpacityScale = (data: IRow[], field: IViewField | null | undefined, defaultAggregate: boolean, scaleConfig: IChannelScales): Scale<number> => {
    const key = useMemo(() => {
        if (!field) {
            return '';
        }
        if (defaultAggregate && field.aggName && field.analyticType === 'measure') {
            return getMeaAggKey(field.fid, field.aggName);
        }
        return field.fid;
    }, [field, defaultAggregate]);

    const resolvedScale = useMemo(() => {
        if (!scaleConfig.opacity) return undefined;
        return resolveScale(scaleConfig.opacity, field, data, 'light');
    }, [scaleConfig, data, field]);

    const [domainMin, domainMax] = useDomain(key, data, resolvedScale);

    const [minOpacity, maxOpacity] = useRange(MIN_OPACITY, MAX_OPACITY, resolvedScale);

    return useCallback(
        function OpacityScale(record: IRow): number {
            if (!key) {
                return DEFAULT_OPACITY;
            }
            const val = Number(record[key]);
            if (isNaN(val)) {
                return 0;
            }
            const percent = Math.max(Math.min((val - domainMin) / (domainMax - domainMin), 1), 0);
            return minOpacity + percent * (maxOpacity - minOpacity);
        },
        [key, domainMin, domainMax, minOpacity, maxOpacity, defaultAggregate]
    );
};
