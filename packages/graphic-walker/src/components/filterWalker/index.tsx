import React, { useEffect } from 'react';
import { IComputationFunction, IMutField, IRow, ISemanticType, IVisFilter } from '../../interfaces';
import { getFieldDistinctCounts, getRange, getTemporalRange } from '../../computation';
import { addFilterForQuery } from '../../utils/workflow';
import { getComputation } from '../../computation/clientComputation';

type rangeValue = [number, number];
type temporalRangeValue = [number, number, string];

type values = rangeValue | string[] | number[];
type domains = rangeValue | temporalRangeValue | string[];

export interface FilterConfig {
    fid: string;
    mode: 'single' | 'multi' | 'range';
    defaultValue?: string | string[] | [number, number];
}

export interface SingleProps {
    name: string;
    options: string[];
    value: string | undefined;
    onChange?: (v: string | undefined) => void;
}
export interface MultiProps {
    name: string;
    options: string[];
    value: string[];
    onChange?: (v: string[]) => void;
}
export interface RangeProps {
    name: string;
    domain: rangeValue;
    value: rangeValue;
    onChange?: (v: rangeValue) => void;
}

const emptyArray = [];

const isEmptyRange = (a: rangeValue) => a[0] === 0 && a[1] === 0;

const isSameRange = (a: rangeValue, b: rangeValue) => {
    return a[0] === b[0] && a[1] === b[1];
};

const isNominalType = (type: ISemanticType) => type === 'nominal' || type === 'ordinal';

function wrapArray<T>(arr: T[]): T[] {
    if (arr.length === 0) return emptyArray;
    return arr;
}

function getDomainAndValue(mode: 'single' | 'multi' | 'range', index: number, domains: domains[], values: values[]) {
    if (!domains[index] || !values[index]) return null;
    if (mode === 'range') {
        return {
            tag: 'range' as const,
            domain: domains[index] as rangeValue,
            value: values[index] as rangeValue,
        };
    }
    return {
        tag: 'array' as const,
        domain: domains[index] as string[],
        value: values[index] as string[],
    };
}

export function createFilterContext(components: {
    SingleSelect: React.FunctionComponent<SingleProps> | React.ComponentClass<SingleProps, any>;
    MultiSelect: React.FunctionComponent<MultiProps> | React.ComponentClass<MultiProps, any>;
    RangeSelect: React.FunctionComponent<RangeProps> | React.ComponentClass<RangeProps, any>;
    TemporalSelect: React.FunctionComponent<RangeProps> | React.ComponentClass<RangeProps, any>;
}) {
    return function FilterContext(props: {
        configs: FilterConfig[];
        data?: IRow[];
        computation?: IComputationFunction;
        loadingContent?: React.ReactNode | Iterable<React.ReactNode>;
        fields: IMutField[];
        children: (computation: IComputationFunction, filterComponents: React.ReactNode[]) => React.ReactNode;
    }) {
        const { configs, data, computation: remoteComputation, fields, children, loadingContent } = props;
        const computation = React.useMemo(() => {
            if (remoteComputation) return remoteComputation;
            if (data) return getComputation(data);
            throw new Error('You should provide either dataSource or computation to use FilterContext.');
        }, [data, remoteComputation]);
        const [loading, setLoading] = React.useState(true);
        const computationRef = React.useRef(computation);
        const valuesRef = React.useRef<Map<string, values>>(new Map());
        const domainsRef = React.useRef<Map<string, Promise<domains>>>(new Map());
        const [values, setValues] = React.useState<values[]>([]);
        const [domains, setDomains] = React.useState<domains[]>([]);
        const resolvedFields = React.useMemo(
            () =>
                configs.flatMap((x) => {
                    const f = fields.find((a) => a.fid === x.fid);
                    if (!f) return [];
                    return [{ fid: x.fid, name: f.name ?? f.fid, mode: x.mode, type: f.semanticType, offset: f.offset, defaultValue: x.defaultValue }];
                }),
            [configs, fields]
        );
        useEffect(() => {
            (async () => {
                if (computationRef.current !== computation) {
                    computationRef.current = computation;
                    valuesRef.current.clear();
                    domainsRef.current.clear();
                }
                setLoading(true);
                const domainsP = resolvedFields.map(async (x) => {
                    const k = `${x.mode === 'range' ? x.type : x.mode}__${x.fid}`;
                    if (domainsRef.current.has(k)) {
                        return domainsRef.current.get(k)!;
                    }
                    if (x.mode === 'single' || x.mode === 'multi') {
                        const p = getFieldDistinctCounts(computation, x.fid, { sortBy: 'count_dsc' }).then((x) => x.map((i) => i.value));
                        domainsRef.current.set(k, p);
                        return p;
                    }
                    switch (x.type) {
                        case 'quantitative': {
                            const p = getRange(computation, x.fid);
                            domainsRef.current.set(k, p);
                            return p;
                        }
                        case 'temporal': {
                            const p = getTemporalRange(computation, x.fid, x.offset);
                            domainsRef.current.set(k, p);
                            return p;
                        }
                        default:
                            throw new Error('Cannot use range on nominal/ordinal field.');
                    }
                });
                const domains = await Promise.all(domainsP);
                const values = resolvedFields.map((x, i) => {
                    const k = `${x.mode}__${x.fid}__${isNominalType(x.type) ? 'n' : 'q'}`;
                    if (x.defaultValue) {
                        return x.defaultValue instanceof Array ? x.defaultValue : [x.defaultValue];
                    }
                    if (valuesRef.current.has(k)) {
                        return valuesRef.current.get(k)!;
                    }
                    if (x.mode === 'single' || x.mode === 'multi') {
                        const v = [];
                        valuesRef.current.set(k, v);
                        return v;
                    }
                    const [min, max] = domains[i] as [number, number] | [number, number, string];
                    const v: [number, number] = [min, max];
                    valuesRef.current.set(k, v);
                    return v;
                });
                setValues(values);
                setDomains(domains);
                setLoading(false);
            })();
        }, [computation, fields]);
        const filters = wrapArray(
            React.useMemo(() => {
                const defaultOffset = new Date().getTimezoneOffset();
                return resolvedFields
                    .map(({ mode, type, fid, offset }, i) => {
                        const data = getDomainAndValue(mode, i, domains, values);
                        if (!data) return null;
                        const { domain, tag, value } = data;
                        if (tag === 'array') {
                            if (value.length === 0) return null;
                            if (type === 'quantitative' || (type === 'temporal' && value.every((x) => !isNaN(Number(x))))) {
                                return createFilter(
                                    fid,
                                    value.map((x) => Number(x))
                                );
                            }
                            return createFilter(fid, value);
                        }
                        // value and domain is rangeValue
                        switch (type) {
                            case 'quantitative':
                                return isSameRange(value, domain) ? null : createRangeFilter(fid, value[0], value[1]);
                            case 'temporal':
                                const d = domain as unknown as temporalRangeValue;
                                return isSameRange(value, domain) ? null : createDateFilter(fid, value[0], value[1], d[2], offset ?? defaultOffset);
                            default:
                                throw new Error('Cannot use range on nominal/ordinal field.');
                        }
                    })
                    .filter((x): x is IVisFilter => !!x);
            }, [values, fields])
        );
        const filteredComputation = React.useMemo<IComputationFunction>(() => {
            return (query) => computation(addFilterForQuery(query, filters));
        }, [filters, computation]);
        const elements = React.useMemo(
            () =>
            resolvedFields.map(({ mode, type, name, fid }, i) => {
                    const data = getDomainAndValue(mode, i, domains, values);
                    if (!data) return <></>;
                    const { tag, domain, value } = data;
                    if (tag === 'array') {
                        if (mode === 'single') {
                            return (
                                <components.SingleSelect
                                    key={fid}
                                    name={name}
                                    options={domain}
                                    value={value[0]}
                                    onChange={(value) =>
                                        setValues((v) =>
                                            v.map((x, index) => {
                                                if (index === i) {
                                                    return value === undefined ? [] : [value];
                                                }
                                                return x;
                                            })
                                        )
                                    }
                                />
                            );
                        } else if (mode === 'multi') {
                            return (
                                <components.MultiSelect
                                    key={fid}
                                    name={name}
                                    options={domain}
                                    value={value}
                                    onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                                />
                            );
                        }
                    }
                    if (tag === 'range') {
                        switch (type) {
                            case 'quantitative':
                                return (
                                    <components.RangeSelect
                                        key={fid}
                                        name={name}
                                        domain={domain}
                                        value={value}
                                        onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                                    />
                                );
                            case 'temporal':
                                return (
                                    <components.TemporalSelect
                                        key={fid}
                                        name={name}
                                        domain={domain}
                                        value={value}
                                        onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                                    />
                                );
                            default:
                                throw new Error('Cannot use range on nominal/ordinal field.');
                        }
                    }
                    return <></>;
                }),
            [fields, values, domains]
        );
        if (loading) {
            return <>{loadingContent}</>;
        }
        return children(filteredComputation, elements);
    } as {
        (props: {
            configs: FilterConfig[];
            data: IRow[];
            loadingContent?: React.ReactNode | Iterable<React.ReactNode>;
            fields: IMutField[];
            children: (computation: IComputationFunction, filterComponents: React.ReactNode[]) => React.ReactNode;
        }): React.ReactNode;
        (props: {
            configs: FilterConfig[];
            computation: IComputationFunction;
            loadingContent?: React.ReactNode | Iterable<React.ReactNode>;
            fields: IMutField[];
            children: (computation: IComputationFunction, filterComponents: React.ReactNode[]) => React.ReactNode;
        }): React.ReactNode;
    };
}

function createDateFilter(fid: string, from: number, to: number, format: string, offset: number): IVisFilter {
    return {
        fid,
        rule: {
            type: 'temporal range',
            value: [from, to],
            format,
            offset,
        },
    };
}

function createRangeFilter(fid: string, from: number, to: number): IVisFilter {
    return {
        fid,
        rule: {
            type: 'range',
            value: [from, to],
        },
    };
}

function createFilter(fid: string, value: (string | number)[]): IVisFilter {
    return {
        fid,
        rule: {
            type: 'one of',
            value: value,
        },
    };
}

export const useTemporalFilter = (
    computation: IComputationFunction,
    fid: string,
    initValue?: rangeValue | (() => rangeValue),
    offset?: number
): {
    filter: IVisFilter | null;
    domain: rangeValue;
    value: rangeValue;
    setValue: (v: rangeValue) => void;
} => {
    const [value, setValue] = React.useState<rangeValue>(initValue ?? [0, 0]);
    const [domain, setDomain] = React.useState<rangeValue>([0, 0]);
    const [format, setFormat] = React.useState('');
    useEffect(() => {
        (async () => {
            const [min, max, format] = await getTemporalRange(computation, fid);
            const newDomain: rangeValue = [min, max];
            setDomain(newDomain);
            setFormat(format);
            if (isEmptyRange(value)) setValue(newDomain);
        })();
    }, [computation, fid]);
    const filter = React.useMemo(
        () => (isSameRange(value, domain) ? null : createDateFilter(fid, value[0], value[1], format, offset ?? new Date().getTimezoneOffset())),
        [value, domain, fid]
    );
    return {
        filter,
        domain,
        value,
        setValue,
    };
};

export const useQuantitativeFilter = (
    computation: IComputationFunction,
    fid: string,
    initValue?: rangeValue | (() => rangeValue)
): {
    filter: IVisFilter | null;
    domain: rangeValue;
    value: rangeValue;
    setValue: (v: rangeValue) => void;
} => {
    const [value, setValue] = React.useState<rangeValue>(initValue ?? [0, 0]);
    const [domain, setDomain] = React.useState<rangeValue>([0, 0]);
    useEffect(() => {
        (async () => {
            const domain = await getRange(computation, fid);
            setDomain(domain);
            if (isEmptyRange(value)) setValue(domain);
        })();
    }, [computation, fid]);
    const filter = React.useMemo(() => (isSameRange(value, domain) ? null : createRangeFilter(fid, value[0], value[1])), [value, domain, fid]);
    return {
        filter,
        domain,
        value,
        setValue,
    };
};

export const useNominalFilter = (
    computation: IComputationFunction,
    fid: string,
    initValue: string[] | (() => string[])
): {
    filter: IVisFilter | null;
    domain: string[];
    value: string[];
    setValue: (v: string[]) => void;
} => {
    const [value, setValue] = React.useState<string[]>(initValue ?? []);
    const [domain, setDomain] = React.useState<string[]>([]);
    useEffect(() => {
        (async () => {
            const domain = await getFieldDistinctCounts(computation, fid, { sortBy: 'count_dsc' });
            setDomain(domain.map((x) => x.value));
        })();
    }, [computation, fid]);
    const filter = React.useMemo(() => (value.length === 0 ? null : createFilter(fid, value)), [value, fid]);
    return {
        filter,
        domain,
        value,
        setValue,
    };
};
