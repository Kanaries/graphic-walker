import { DraggableFieldState, IDataSet, IDataSource, IMutField, IVisSpec, IVisSpecForExport, IVisualConfig, IVisualConfigNew, IVisualLayout } from '../interfaces';
import { GEMO_TYPES } from '../config';

export function initVisualConfig(): IVisualConfig {
    return {
        defaultAggregated: true,
        geoms: [GEMO_TYPES[0]!],
        stack: 'stack',
        showActions: false,
        interactiveScale: false,
        sorted: 'none',
        zeroScale: true,
        background: undefined,
        size: {
            mode: 'auto',
            width: 320,
            height: 200,
        },
        format: {
            numberFormat: undefined,
            timeFormat: undefined,
            normalizedNumberFormat: undefined,
        },
        resolve: {
            x: false,
            y: false,
            color: false,
            opacity: false,
            shape: false,
            size: false,
        },
        limit: -1,
    };
}

export const emptyVisualLayout: IVisualLayout = {
    showActions: false,
    stack: 'stack',
    interactiveScale: false,
    zeroScale: true,
    background: undefined,
    size: {
        mode: 'auto',
        width: 320,
        height: 200,
    },
    format: {
        numberFormat: undefined,
        timeFormat: undefined,
        normalizedNumberFormat: undefined,
    },
    resolve: {
        x: false,
        y: false,
        color: false,
        opacity: false,
        shape: false,
        size: false,
    },
};

export const emptyVisualConfig: IVisualConfigNew = {
    defaultAggregated: true,
    geoms: [GEMO_TYPES[0]],
    limit: -1,
};

export const emptyEncodings: DraggableFieldState = {
    dimensions: [],
    measures: [],
    rows: [],
    columns: [],
    color: [],
    opacity: [],
    size: [],
    shape: [],
    radius: [],
    theta: [],
    details: [],
    filters: [],
    text: [],
};

export function visSpecDecoder(visList: IVisSpecForExport[]): IVisSpec[] {
    const updatedVisList = visList.map((visSpec) => {
        const updatedFilters = visSpec.encodings.filters.map((filter) => {
            if (filter.rule?.type === 'one of' && Array.isArray(filter.rule.value)) {
                return {
                    ...filter,
                    rule: {
                        ...filter.rule,
                        value: new Set(filter.rule.value),
                    },
                };
            }
            return filter;
        });
        return {
            ...visSpec,
            encodings: {
                ...visSpec.encodings,
                filters: updatedFilters,
            },
        } as IVisSpec;
    });
    return updatedVisList;
}

export const forwardVisualConfigs = (backwards: IStoInfoOld['specList']): IVisSpecForExport[] => {
    return backwards.map((content) => ({
        ...content,
        config: {
            ...initVisualConfig(),
            ...content.config,
        },
    }));
};

export interface IStoInfoOld {
    $schema: undefined;
    datasets: IDataSet[];
    specList: {
        [K in keyof IVisSpecForExport]: K extends 'config' ? Partial<IVisSpecForExport[K]> : IVisSpecForExport[K];
    }[];
    dataSources: IDataSource[];
}

export const IStoInfoV2SchemaUrl = 'https://graphic-walker.kanaries.net/public/stoinfo_v2.json';

export interface IStoInfoV2 {
    $schema: typeof IStoInfoV2SchemaUrl,
    metaDict: Record<string, IMutField[]>,
    datasets: Required<IDataSource>[],
    specDict: Record<string, string[]>,
};

export type IStoInfo = IStoInfoOld | IStoInfoV2;

export function download(data: string, filename: string, type: string) {
    var file = new Blob([data], { type: type });
    // @ts-ignore
    if (window.navigator.msSaveOrOpenBlob)
        // IE10+
        // @ts-ignore
        window.navigator.msSaveOrOpenBlob(file, filename);
    else {
        // Others
        var a = document.createElement('a'),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}
