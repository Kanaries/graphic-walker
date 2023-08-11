import { DraggableFieldState, IDataSet, IDataSource, IVisSpec, IVisSpecForExport, IVisualConfig } from "../interfaces";
import { VisSpecWithHistory } from "../models/visSpecHistory";
import { toJS } from 'mobx';
import { GEMO_TYPES } from '../config';

export function dumpsGWPureSpec(list: VisSpecWithHistory[]): IVisSpec[] {
    return list.map((l) => l.exportGW());
}

export function parseGWPureSpec(list: IVisSpec[]): VisSpecWithHistory[] {
    return list.map((l) => new VisSpecWithHistory(l));
}

export function initEncoding(): DraggableFieldState {
    return {
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
        longitude: [],
        latitude: [],
        geoId: [],
        details: [],
        filters: [],
        text: [],
    };
}

export function initVisualConfig(): IVisualConfig {
    return {
        defaultAggregated: true,
        geoms: [GEMO_TYPES[0]!],
        showTableSummary: false,
        coordSystem: 'generic',
        stack: 'stack',
        showActions: false,
        interactiveScale: false,
        sorted: 'none',
        zeroScale: true,
        scaleIncludeUnmatchedChoropleth: false,
        background: undefined,
        size: {
            mode: "auto",
            width: 320,
            height: 200,
        },
        format: {
            numberFormat: undefined,
            timeFormat: undefined,
            normalizedNumberFormat: undefined,
        },
        geoKey: 'name',
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
                ...initEncoding(),
                ...visSpec.encodings,
                filters: updatedFilters,
            },
        } as IVisSpec;
    });
    return updatedVisList;
}

export const forwardVisualConfigs = (backwards: ReturnType<typeof parseGWContent>['specList']): IVisSpecForExport[] => {
    return backwards.map((content) => ({
        ...content,
        config: {
            ...initVisualConfig(),
            ...content.config,
        },
    }));
};

export function resolveSpecFromStoInfo(info: IStoInfo) {
    const spec = parseGWPureSpec(visSpecDecoder(forwardVisualConfigs(info.specList)))[0];
    return {
        config: toJS(spec.config) as IVisualConfig,
        encodings: toJS(spec.encodings) as DraggableFieldState,
        name: spec.name,
    };
}

export interface IStoInfo {
    datasets: IDataSet[];
    specList: {
        [K in keyof IVisSpecForExport]: K extends 'config' ? Partial<IVisSpecForExport[K]> : IVisSpecForExport[K];
    }[];
    dataSources: IDataSource[];
}

export function stringifyGWContent(info: IStoInfo) {
    return JSON.stringify(info);
}

export function parseGWContent(raw: string): IStoInfo {
    return JSON.parse(raw);
}

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
