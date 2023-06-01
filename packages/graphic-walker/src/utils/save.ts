import produce from "immer";
import { IDataSet, IDataSource, IFilterField, IVisSpec, IFilterRule } from "../interfaces";
import { VisSpecWithHistory } from "../models/visSpecHistory";

export function dumpsGWPureSpec(list: VisSpecWithHistory[]): IVisSpec[] {
    return list.map((l) => l.exportGW());
}

export function parseGWPureSpec(list: IVisSpec[]): VisSpecWithHistory[] {
    return list.map((l) => new VisSpecWithHistory(l));
}

export interface IStoInfo {
    datasets: IDataSet[];
    specList: {
        [K in keyof IVisSpec]: K extends "config" ? Partial<IVisSpec[K]> : IVisSpec[K];
    }[];
    visIndex?: number;
    dataSources: IDataSource[];
}

type SerializedFilter = Omit<IFilterField, 'rule'> & {
    rule: Extract<IFilterRule, { type: 'range' | 'temporal range' }> | (
        Omit<Extract<IFilterRule, { type: 'one of' }>, 'value'> & {
            value: (string | number)[];
        }
    );
};

type SerializedSpec = {
    [K in keyof IStoInfo]: K extends 'specList' ? {
        [K in keyof IStoInfo['specList'][number]]: K extends 'encodings' ? {
            [K in keyof IStoInfo['specList'][number]['encodings']]: K extends 'filters' ? SerializedFilter[] : IStoInfo['specList'][number]['encodings'][K];
        } : IStoInfo['specList'][number][K];
    }[] : IStoInfo[K];
};

export function stringifyGWContent(info: IStoInfo) {
    // transform all Set objects from filters into arrays
    const spec = produce(info, draft => {
        for (const spec of draft.specList) {
            const filtersSet = spec.encodings.filters;
            const filtersArr = filtersSet.map<SerializedFilter>(f => {
                if (f.rule?.type === 'one of') {
                    return {
                        ...f,
                        rule: {
                            type: 'one of',
                            value: Array.from(f.rule.value),
                        },
                    };
                }
                return f as SerializedFilter;
            });
            // @ts-expect-error
            spec.encodings.filters = filtersArr;
        }
    }) as unknown as SerializedSpec;
    return JSON.stringify(spec);
}

export function parseGWContent(raw: string): IStoInfo {
    // transform parsed filter value arrays into Set objects
    const specRaw = JSON.parse(raw) as SerializedSpec;
    return produce(specRaw, draft => {
        for (const spec of draft.specList) {
            const filtersArr = spec.encodings.filters;
            const filtersSet = new Set(filtersArr.map<IFilterField>(f => {
                if (f.rule?.type === 'one of') {
                    return {
                        ...f,
                        rule: {
                            type: 'one of',
                            value: new Set(f.rule.value),
                        },
                    };
                }
                return f as IFilterField;
            }));
            // @ts-expect-error
            spec.encodings.filters = filtersSet;
        }
    }) as unknown as IStoInfo;
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
        var a = document.createElement("a"),
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
