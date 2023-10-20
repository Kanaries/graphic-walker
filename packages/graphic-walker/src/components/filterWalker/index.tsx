import React, { useEffect } from 'react';
import { IComputationFunction, IMutField, IVisFilter } from '../../interfaces';
import { getDistinctValues, getRange, getTemporalRange } from '../../computation';
import { addFilterForQuery } from '../../utils/workflow';

export interface FilterConfig {
    fid: string;
    mode: 'single' | 'range';
}

const emptyArray = [];

function wrapArray<T>(arr: T[]): T[] {
    if (arr.length === 0) return emptyArray;
    return arr;
}

type values = [number, number] | string[] | number[];
type domains = [number, number] | string[];

export interface SingleProps {
    name: string;
    options: string[];
    value: string;
    onChange?: (v: string) => void;
}
export interface MultiProps {
    name: string;
    options: string[];
    value: string[];
    onChange?: (v: string[]) => void;
}
export interface RangeProps {
    name: string;
    domain: [number, number];
    value: [number, number];
    onChange?: (v: [number, number]) => void;
}

export function createFilterContext(components: {
    SingleSelect: React.FunctionComponent<SingleProps> | React.ComponentClass<SingleProps, any>;
    MultiSelect: React.FunctionComponent<MultiProps> | React.ComponentClass<MultiProps, any>;
    RangeSelect: React.FunctionComponent<RangeProps> | React.ComponentClass<RangeProps, any>;
    TemporalSelect: React.FunctionComponent<RangeProps> | React.ComponentClass<RangeProps, any>;
}) {
    return function FilterContext(props: {
        configs: FilterConfig[];
        computation: IComputationFunction;
        loadingContent?: React.ReactNode | Iterable<React.ReactNode>;
        rawFields: IMutField[];
        children: (computation: IComputationFunction, filterComponents: JSX.Element[]) => React.ReactNode | Iterable<React.ReactNode>;
    }) {
        const { configs, computation, rawFields, children, loadingContent } = props;
        const [loading, setLoading] = React.useState(true);
        const computationRef = React.useRef(computation);
        const valuesRef = React.useRef<Map<string, values>>(new Map());
        const domainsRef = React.useRef<Map<string, Promise<domains>>>(new Map());
        const [values, setValues] = React.useState<values[]>([]);
        const [domains, setDomains] = React.useState<domains[]>([]);
        const fields = React.useMemo(
            () =>
                configs.flatMap((x) => {
                    const f = rawFields.find((a) => a.fid === x.fid);
                    if (!f) return [];
                    return [{ fid: x.fid, name: f.name ?? f.fid, mode: x.mode, type: f.semanticType }];
                }),
            [configs, rawFields]
        );
        useEffect(() => {
            (async () => {
                if (computationRef.current !== computation) {
                    computationRef.current = computation;
                    valuesRef.current.clear();
                    domainsRef.current.clear();
                }
                setLoading(true);
                const domainsP = fields.map(async (x) => {
                    const k = `${x.mode === 'single' ? x.mode : x.type === 'nominal' || x.type === 'ordinal' ? 'nominal' : x.type}__${x.fid}`;
                    if (domainsRef.current.has(k)) {
                        return domainsRef.current.get(k)!;
                    }
                    if (x.mode === 'single') {
                        const p = getDistinctValues(computation, x.fid).then((x) => x.map((i) => i.value));
                        domainsRef.current.set(k, p);
                        return p;
                    }
                    switch (x.type) {
                        case 'nominal':
                        case 'ordinal': {
                            const p = getDistinctValues(computation, x.fid).then((x) => x.map((i) => i.value));
                            domainsRef.current.set(k, p);
                            return p;
                        }
                        case 'quantitative': {
                            const p = getRange(computation, x.fid);
                            domainsRef.current.set(k, p);
                            return p;
                        }
                        case 'temporal': {
                            const p = getTemporalRange(computation, x.fid);
                            domainsRef.current.set(k, p);
                            return p;
                        }
                        default:
                            throw 'unknown type';
                    }
                });
                const domains = await Promise.all(domainsP);
                const values = fields.map((x) => {
                    const k = `${x.mode}__${x.fid}__${x.type === 'nominal' || x.type === 'ordinal' ? 'n' : 'q'}`;
                    if (valuesRef.current.has(k)) {
                        return valuesRef.current.get(k)!;
                    }
                    if (x.mode === 'single' || x.type === 'nominal' || x.type === 'ordinal') {
                        const v = [];
                        valuesRef.current.set(k, v);
                        return v;
                    }
                    const v = [0, 0];
                    valuesRef.current.set(k, v);
                    return v;
                });
                setValues(values);
                setDomains(domains);
                setLoading(false);
            })();
        }, [computation, fields]);
        const filters = wrapArray(
            React.useMemo(
                () =>
                    fields
                        .map(({ mode, type, fid }, i) => {
                            const domain = domains[i];
                            const value = values[i];
                            if (mode === 'single') {
                                if (value.length === 0) return null;
                                return createFilter(fid, value as string[]);
                            }
                            switch (type) {
                                case 'nominal':
                                case 'ordinal':
                                    if (value.length === 0) return null;
                                    return createFilter(fid, value as string[]);
                                case 'quantitative':
                                    return value[0] === domain[0] && value[1] === domain[1]
                                        ? null
                                        : createRangeFilter(fid, value[0] as number, value[1] as number);
                                case 'temporal':
                                    return value[0] === domain[0] && value[1] === domain[1]
                                        ? null
                                        : createDateFilter(fid, value[0] as number, value[1] as number);
                            }
                        })
                        .filter((x): x is IVisFilter => !!x),
                [values, fields]
            )
        );
        const filteredComputation = React.useMemo<IComputationFunction>(() => {
            return (query) => computation(addFilterForQuery(query, filters));
        }, [filters, computation]);
        const elements = React.useMemo(
            () =>
                fields.map(({ mode, type, name }, i) => {
                    const domain = domains[i];
                    const value = values[i];
                    if (mode === 'single') {
                        return (
                            <components.MultiSelect
                                name={name}
                                options={domain as string[]}
                                value={value as string[]}
                                onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                            />
                        );
                    }
                    switch (type) {
                        case 'nominal':
                        case 'ordinal':
                            return (
                                <components.MultiSelect
                                    name={name}
                                    options={domain as string[]}
                                    value={value as string[]}
                                    onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                                />
                            );

                        case 'quantitative':
                            return (
                                <components.RangeSelect
                                    name={name}
                                    domain={domain as [number, number]}
                                    value={value as [number, number]}
                                    onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                                />
                            );
                        case 'temporal':
                            return (
                                <components.TemporalSelect
                                    name={name}
                                    domain={domain as [number, number]}
                                    value={value as [number, number]}
                                    onChange={(value) => setValues((v) => v.map((x, index) => (index === i ? value : x)))}
                                />
                            );
                    }
                }),
            [fields, values, domains]
        );

        return loading ? <>{loadingContent}</> : <>{children(filteredComputation, elements)}</>;
    };
}

function createDateFilter(fid: string, from: number, to: number): IVisFilter {
    return {
        fid,
        rule: {
            type: 'temporal range',
            value: [from, to],
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

function createFilter(fid: string, value: string[]): IVisFilter {
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
    initValue?: [number, number] | (() => [number, number])
): {
    filter: IVisFilter | null;
    domain: [number, number];
    value: [number, number];
    setValue: (v: [number, number]) => void;
} => {
    const [value, setValue] = React.useState<[number, number]>(initValue ?? [0, 0]);
    const [domain, setDomain] = React.useState<[number, number]>([0, 0]);
    useEffect(() => {
        (async () => {
            const domain = await getTemporalRange(computation, fid);
            setDomain(domain);
            if (value[0] === 0 && value[1] === 0) setValue(domain);
        })();
    }, [computation, fid]);
    const filter = React.useMemo(
        () => (value[0] === domain[0] && value[1] === domain[1] ? null : createDateFilter(fid, value[0], value[1])),
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
    initValue?: [number, number] | (() => [number, number])
): {
    filter: IVisFilter | null;
    domain: [number, number];
    value: [number, number];
    setValue: (v: [number, number]) => void;
} => {
    const [value, setValue] = React.useState<[number, number]>(initValue ?? [0, 0]);
    const [domain, setDomain] = React.useState<[number, number]>([0, 0]);
    useEffect(() => {
        (async () => {
            const domain = await getRange(computation, fid);
            setDomain(domain);
            if (value[0] === 0 && value[1] === 0) setValue(domain);
        })();
    }, [computation, fid]);
    const filter = React.useMemo(
        () => (value[0] === domain[0] && value[1] === domain[1] ? null : createRangeFilter(fid, value[0], value[1])),
        [value, domain, fid]
    );
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
            const domain = await getDistinctValues(computation, fid);
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
