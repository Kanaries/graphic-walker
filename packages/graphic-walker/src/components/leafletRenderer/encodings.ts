import { useCallback, useMemo } from "react";
import type { IRow, IViewField, VegaGlobalConfig } from "../../interfaces";
import { getMeaAggKey } from "../../utils";


export interface Scale<T> {
    (record: IRow): T;
}

// export const useColorScale = (data: IRow[], field: IViewField | null | undefined, vegaConfig: VegaGlobalConfig): Scale<string> => {
//     if (!field) {
//         return;
//     }
//     if (field.semanticType === 'quantitative' || field.semanticType === 'temporal') {
//         // continuous

//     }
//     if ('scale' in vegaConfig) {
//         vegaConfig.scale?.continuousPadding
//     }

// };

const MIN_SIZE = 1;
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
        return MIN_SIZE + size * (MAX_SIZE - MIN_SIZE);
    }, [key, domainMin, domainMax, defaultAggregate]);
};
