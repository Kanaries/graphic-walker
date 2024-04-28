import { getFieldDistinctCounts, getRange, getTemporalRange } from '@/computation';
import { getComputation } from '@/computation/clientComputation';
import { SimpleOneOfSelector, SimpleRange, SimpleTemporalRange } from '@/fields/filterField/simple';
import {
    IAggregator,
    IChannelScales,
    IChart,
    IComputationFunction,
    IDarkMode,
    IDataQueryPayload,
    IFilterField,
    IFilterRule,
    IRow,
    IThemeKey,
    IUIThemeConfig,
    IVisualLayout,
} from '@/interfaces';
import PureRenderer from '@/renderer/pureRenderer';
import { ShadowDom } from '@/shadow-dom';
import { ComputationContext } from '@/store';
import { addFilterForQuery } from '@/utils/workflow';
import { GWGlobalConfig } from '@/vis/theme';
import React, { useCallback, useMemo } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface IFilterComputationContext {
    computation: IComputationFunction;
    dataComputation: IComputationFunction;
    upsertFilter: (fid: string, rule: IFilterRule) => void;
    removeFilter: (fid: string) => void;
}

const FilterComputationContext = createContext<IFilterComputationContext | null>(null);

export function useNominalFilter(fid: string, initValue?: string[] | (() => string[])) {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use filter outside of ComputationProvider');
    }
    const { computation, upsertFilter, removeFilter } = context;
    const [value, setValue] = useState<string[]>(initValue ?? []);
    const [domain, setDomain] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            setLoading(true);
            const domain = await getFieldDistinctCounts(computation, fid, { sortBy: 'count_dsc' });
            setDomain(domain.map((x) => x.value));
            setLoading(false);
        })();
    }, [computation, fid]);

    useEffect(() => {
        if (value.length) {
            upsertFilter(fid, { type: 'one of', value });
            return () => removeFilter(fid);
        }
        return () => {};
    }, [value]);

    return {
        domain,
        loading,
        value,
        setValue,
    };
}

const isEmptyRange = (a: [number, number]) => a[0] === 0 && a[1] === 0;

export const useTemporalFilter = (fid: string, initValue?: [number, number] | (() => [number, number]), offset?: number) => {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use filter outside of ComputationProvider');
    }
    const { computation, upsertFilter, removeFilter } = context;
    const [value, setValue] = useState<[number, number]>(initValue ?? [0, 0]);
    const [domain, setDomain] = useState<[number, number]>([0, 0]);
    const [format, setFormat] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            setLoading(true);
            const [min, max, format] = await getTemporalRange(computation, fid);
            const newDomain: [number, number] = [min, max];
            setDomain(newDomain);
            setFormat(format);
            setLoading(false);
            if (isEmptyRange(value)) setValue(newDomain);
        })();
    }, [computation, fid]);
    useEffect(() => {
        if (value.length) {
            upsertFilter(fid, { type: 'temporal range', value, format, offset });
            return () => removeFilter(fid);
        }
        return () => {};
    }, [value, format, offset]);
    return {
        domain,
        loading,
        value,
        setValue,
    };
};

export const useQuantitativeFilter = (fid: string, initValue?: [number, number] | (() => [number, number])) => {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use filter outside of ComputationProvider');
    }
    const { computation, upsertFilter, removeFilter } = context;
    const [value, setValue] = useState<[number, number]>(initValue ?? [0, 0]);
    const [domain, setDomain] = useState<[number, number]>([0, 0]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            setLoading(true);
            const domain = await getRange(computation, fid);
            setDomain(domain);
            if (isEmptyRange(value)) setValue(domain);
            setLoading(false);
        })();
    }, [computation, fid]);
    useEffect(() => {
        if (value.length) {
            upsertFilter(fid, { type: 'range', value });
            return () => removeFilter(fid);
        }
        return () => {};
    }, [value]);
    return {
        domain,
        loading,
        value,
        setValue,
    };
};

export function Chart({
    chart,
    ...props
}: {
    chart: IChart;
    className?: string;
    name?: string;
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    appearance?: IDarkMode;
    uiTheme?: IUIThemeConfig;
    locale?: string;
    scales?: IChannelScales;
    overrideSize?: IVisualLayout['size'];
}) {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use chart outside of ComputationProvider');
    }
    const { dataComputation } = context;
    return (
        <PureRenderer
            type="remote"
            computation={dataComputation}
            visualConfig={chart.config}
            visualLayout={chart.layout}
            visualState={chart.encodings}
            {...props}
        />
    );
}

function ComputationProvider(props: { data: any[]; children?: React.ReactNode | Iterable<React.ReactNode> });
function ComputationProvider(props: { computation: IComputationFunction; children?: React.ReactNode | Iterable<React.ReactNode> });
function ComputationProvider({
    data,
    computation,
    children,
}: {
    data?: any[];
    computation?: IComputationFunction;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}) {
    const computationFunction = useMemo(() => {
        if (data) {
            return getComputation(data);
        }
        return computation!;
    }, [data ? data : computation]);
    const [filterMap, setFilterMap] = useState<{ [fid: string]: IFilterRule }>({});

    const filteredComputation = React.useMemo<IComputationFunction>(() => {
        const filters = Object.entries(filterMap).map(([fid, rule]) => ({ fid, rule }));
        return (query) => computationFunction(addFilterForQuery(query, filters));
    }, [filterMap, computationFunction]);

    const upsertFilter = useCallback((fid: string, rule: IFilterRule) => {
        setFilterMap((prev) => ({ ...prev, [fid]: rule }));
    }, []);

    const removeFilter = useCallback((fid: string) => {
        setFilterMap((prev) => {
            const { [fid]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    return (
        <FilterComputationContext.Provider value={{ computation: computationFunction, dataComputation: filteredComputation, upsertFilter, removeFilter }}>
            {children}
        </FilterComputationContext.Provider>
    );
}

export { ComputationProvider };

const emptyField = [];

export function SelectFilter(props: { fid: string; name: string; defaultValue?: string[]; uiTheme?: IUIThemeConfig }) {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use filter outside of ComputationProvider');
    }
    const { computation, upsertFilter, removeFilter } = context;

    const [rule, setRule] = useState<IFilterRule>({ type: 'one of', value: props.defaultValue ?? [] });
    useEffect(() => {
        if (rule.value.length) {
            upsertFilter(props.fid, rule);
            return () => removeFilter(props.fid);
        }
        return () => {};
    }, [rule]);
    const field = useMemo((): IFilterField => {
        return { fid: props.fid, analyticType: 'dimension', name: props.name, semanticType: 'nominal', rule };
    }, [props.fid, props.name, rule]);

    return (
        <ShadowDom uiTheme={props.uiTheme}>
            <ComputationContext.Provider value={computation}>
                <SimpleOneOfSelector field={field} allFields={emptyField} onChange={setRule} />
            </ComputationContext.Provider>
        </ShadowDom>
    );
}

export function RangeFilter(props: { fid: string; name: string; defaultValue?: [number, number]; uiTheme?: IUIThemeConfig }) {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use filter outside of ComputationProvider');
    }
    const { computation, upsertFilter, removeFilter } = context;

    const [rule, setRule] = useState<IFilterRule>({ type: 'range', value: props.defaultValue ?? [0, 0] });
    useEffect(() => {
        if (!isEmptyRange(rule.value as [number, number])) {
            upsertFilter(props.fid, rule);
            return () => removeFilter(props.fid);
        }
        return () => {};
    }, [rule]);
    const field = useMemo((): IFilterField => {
        return { fid: props.fid, analyticType: 'measure', name: props.name, semanticType: 'quantitative', rule };
    }, [props.fid, props.name, rule]);

    return (
        <ShadowDom uiTheme={props.uiTheme}>
            <ComputationContext.Provider value={computation}>
                <SimpleRange field={field} allFields={emptyField} onChange={setRule} />
            </ComputationContext.Provider>
        </ShadowDom>
    );
}

export function TemporalFilter(props: { fid: string; name: string; defaultValue?: [number, number]; uiTheme?: IUIThemeConfig }) {
    const context = useContext(FilterComputationContext);
    if (!context) {
        throw new Error('cannot use filter outside of ComputationProvider');
    }
    const { computation, upsertFilter, removeFilter } = context;

    const [rule, setRule] = useState<IFilterRule>({ type: 'temporal range', value: props.defaultValue ?? [0, 0] });
    useEffect(() => {
        if (!isEmptyRange(rule.value as [number, number])) {
            upsertFilter(props.fid, rule);
            return () => removeFilter(props.fid);
        }
        return () => {};
    }, [rule]);
    const field = useMemo((): IFilterField => {
        return { fid: props.fid, analyticType: 'dimension', name: props.name, semanticType: 'temporal', rule };
    }, [props.fid, props.name, rule]);

    return (
        <ShadowDom uiTheme={props.uiTheme}>
            <ComputationContext.Provider value={computation}>
                <SimpleTemporalRange field={field} allFields={emptyField} onChange={setRule} />
            </ComputationContext.Provider>
        </ShadowDom>
    );
}

export function useComputedValue(payload: IDataQueryPayload) {
    const { dataComputation } = useContext(FilterComputationContext)!;
    const [value, setValue] = useState<IRow[] | null>(null);
    useEffect(() => {
        (async () => {
            setValue(null);
            const result = await dataComputation(payload);
            setValue(result);
        })();
    }, [dataComputation, payload]);
    return value;
}

export function useAggergateValue(fid: string, aggName: IAggregator): number | undefined {
    const payload = useMemo<IDataQueryPayload>(() => {
        return {
            workflow: [
                {
                    type: 'view',
                    query: [
                        {
                            op: 'aggregate',
                            groupBy: [],
                            measures: [{ agg: aggName, field: fid, asFieldKey: 'value' }],
                        },
                    ],
                },
            ],
        };
    }, [fid, aggName]);
    const result = useComputedValue(payload);
    return result?.[0]?.value;
}
