import { useCallback, useMemo } from "react";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import type { IRow, IViewField, VegaGlobalConfig } from "../../interfaces";
import { getMeaAggKey } from "../../utils";


export interface Scale<T> {
    (record: IRow): T;
}

const DEFAULT_COLOR = "#5B8FF9";
const DEFAULT_COLOR_STEP_1 = "#EBCCFF";
const DEFAULT_COLOR_STEP_2 = "#0D1090";
const DEFAULT_SCHEME_CATEGORY = [
    "#5B8FF9",
    "#61DDAA",
    "#65789B",
    "#F6BD16",
    "#7262FD",
    "#78D3F8",
    "#9661BC",
    "#F6903D",
    "#008685",
    "#F08BB4",
];

export const useColorScale = (data: IRow[], field: IViewField | null | undefined, defaultAggregate: boolean, vegaConfig: VegaGlobalConfig): Scale<string> => {
    const color = (vegaConfig as any).circle?.fill || DEFAULT_COLOR;
    const fixedScale = useCallback(function ColorScale (row: IRow) {
        return color;
    }, [color]);
    const colorRange = useMemo(() => {
        if ('scale' in vegaConfig && typeof vegaConfig.scale === 'object' && 'continuous' in vegaConfig.scale) {
            if (Array.isArray((vegaConfig.scale?.continuous as any).range)) {
                return ((vegaConfig.scale?.continuous as any).range as string[]).slice(0, 2);
            }
        }
        return [DEFAULT_COLOR_STEP_1, DEFAULT_COLOR_STEP_2];
    }, [vegaConfig]);
    const schemeCategory = useMemo(() => {
        if (Array.isArray(vegaConfig.range?.category)) {
            return vegaConfig.range!.category as string[];
        }
        return DEFAULT_SCHEME_CATEGORY;
    }, [vegaConfig]);
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
        return data.reduce((dom: [number, number], { [key]: cur }) => {
            if (cur < dom[0]) {
                dom[0] = cur;
            }
            if (cur > dom[1]) {
                dom[1] = cur;
            }
            return dom;
        }, [Infinity, -Infinity]);
    }, [data, field, key]);
    const distributions = useMemo(() => {
        if (!field || field.semanticType !== 'nominal') {
            return [];
        }
        return [...data.reduce((set: Set<string>, row) => {
            set.add(row[key]);
            return set;
        }, new Set<string>())];
    }, [data, field, key]);
    const continuousScale = useMemo(() => {
        const scale = scaleLinear<string, string>().domain(domain).range(colorRange);
        return function ColorScale (row: IRow) {
            return scale(Number(row[key]));
        };
    }, [domain, key, colorRange]);
    const discreteScale = useMemo(() => {
        const scale = scaleOrdinal<string, string>().domain(distributions).range(schemeCategory);
        return function ColorScale (row: IRow) {
            return scale(row[key]);
        };
    }, [distributions, schemeCategory]);

    if (!field) {
        return fixedScale;
    }
    if (field.semanticType === 'quantitative' || field.semanticType === 'temporal') {
        // continuous
        return continuousScale;
    }
    return discreteScale;
};

const MIN_SIZE = 2;
const MAX_SIZE = 10;
const DEFAULT_SIZE = 3;

export const useSizeScale = (data: IRow[], field: IViewField | null | undefined, defaultAggregate: boolean): Scale<number> => {
    const key = useMemo(() => {
        if (!field) {
            return '';
        }
        if (defaultAggregate && field.aggName && field.analyticType === 'measure') {
            return getMeaAggKey(field.fid, field.aggName);
        }
        return field.fid;
    }, [field, defaultAggregate]);

    const [domainMin, domainMax] = useMemo(() => {
        if (!key) {
            return [0, 0];
        }
        const values = data.map((row) => Number(row[key])).filter((val) => !isNaN(val));
        if (values.length === 0) {
            return [0, 0];
        }
        return values.slice(1).reduce<[number, number]>((acc, val) => {
            if (val < acc[0]) {
                acc[0] = val;
            }
            if (val > acc[1]) {
                acc[1] = val;
            }
            return acc;
        }, [values[0], values[0]]);
    }, [key, data]);
    
    return useCallback(function SizeScale (record: IRow): number {
        if (!key) {
            return DEFAULT_SIZE;
        }
        const val = Number(record[key]);
        if (isNaN(val)) {
            return 0;
        }
        const size = (val - domainMin) / (domainMax - domainMin);
        return MIN_SIZE + Math.sqrt(size) * (MAX_SIZE - MIN_SIZE);
    }, [key, domainMin, domainMax, defaultAggregate]);
};


const MIN_OPACITY = 0.33;
const MAX_OPACITY = 1.0;
const DEFAULT_OPACITY = 1;

export const useOpacityScale = (data: IRow[], field: IViewField | null | undefined, defaultAggregate: boolean): Scale<number> => {
    const key = useMemo(() => {
        if (!field) {
            return '';
        }
        if (defaultAggregate && field.aggName && field.analyticType === 'measure') {
            return getMeaAggKey(field.fid, field.aggName);
        }
        return field.fid;
    }, [field, defaultAggregate]);

    const [domainMin, domainMax] = useMemo(() => {
        if (!key) {
            return [0, 0];
        }
        const values = data.map((row) => Number(row[key])).filter((val) => !isNaN(val));
        if (values.length === 0) {
            return [0, 0];
        }
        return values.slice(1).reduce<[number, number]>((acc, val) => {
            if (val < acc[0]) {
                acc[0] = val;
            }
            if (val > acc[1]) {
                acc[1] = val;
            }
            return acc;
        }, [values[0], values[0]]);
    }, [key, data]);
    
    return useCallback(function OpacityScale (record: IRow): number {
        if (!key) {
            return DEFAULT_OPACITY;
        }
        const val = Number(record[key]);
        if (isNaN(val)) {
            return 0;
        }
        const size = (val - domainMin) / (domainMax - domainMin);
        return MIN_OPACITY + size * (MAX_OPACITY - MIN_OPACITY);
    }, [key, domainMin, domainMax, defaultAggregate]);
};
