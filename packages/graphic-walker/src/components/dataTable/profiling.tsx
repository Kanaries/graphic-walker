import { ComponentType, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IComputationFunction, ISemanticType } from '../../interfaces';
import { profileNonmialField, profileQuantitativeField } from '../../computation';
import React from 'react';
import { formatDate, isNotEmpty } from '../../utils';
import Tooltip from '../tooltip';
import { themeContext, vegaThemeContext } from '../../store/theme';
import { parsedOffsetDate } from '../../lib/op/offset';
import embed, { VisualizationSpec } from 'vega-embed';
import { format } from 'd3-format';
import { getTheme } from '../../utils/useTheme';

export interface FieldProfilingProps {
    field: string;
    computation: IComputationFunction;
}

function NominalProfiling({ computation, field, valueRenderer = (s) => `${s}` }: FieldProfilingProps & { valueRenderer?: (v: string | number) => string }) {
    const [stat, setStat] = useState<Awaited<ReturnType<typeof profileNonmialField>>>();
    useEffect(() => {
        profileNonmialField(computation, field).then(setStat);
    }, [computation, field]);
    const dark = useContext(themeContext);

    if (!isNotEmpty(stat)) {
        return <div className="h-24 flex items-center justify-center">Loading...</div>;
    }

    const [meta, tops] = stat;
    // shows top 2 when the maximum quantity is more than 1.3x the average quantity, and over 1%.
    // or there are only 2 types of value.
    const showsTops =
        meta.distinctTotal === 2 || (meta.distinctTotal > 2 && tops[0].count > (1.3 * meta.total) / meta.distinctTotal && tops[0].count > meta.total / 100);

    if (meta.distinctTotal === 1) {
        return <div className="h-24 flex items-center justify-center text-xl">= {tops[0].value || '(Empty)'}</div>;
    }

    return (
        <div className="h-24 flex items-center justify-center flex-col gap-2 text-xs">
            {showsTops && (
                <>
                    {tops.map(({ count, value }) => {
                        const displayValue = valueRenderer(value) || '(Empty)';
                        return (
                            <Tooltip content={displayValue} darkModePreference={dark}>
                                <div className="w-full rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between space-x-2">
                                    <div className="min-w-[0px] flex-shrink whitespace-nowrap text-ellipsis overflow-hidden">{displayValue}</div>
                                    <div className="flex-shrink-0">{Math.floor((100 * count) / meta.total)}%</div>
                                </div>
                            </Tooltip>
                        );
                    })}
                    {meta.distinctTotal > tops.length && (
                        <div className="w-full rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between space-x-2">
                            <div className="min-w-[0px] flex-shrink whitespace-nowrap text-ellipsis overflow-hidden">
                                Other ({meta.distinctTotal - tops.length})
                            </div>
                            <div className="flex-shrink-0">
                                {100 - tops.reduce((totalPercent, { count }) => totalPercent + Math.floor((100 * count) / meta.total), 0)}%
                            </div>
                        </div>
                    )}
                </>
            )}
            {!showsTops && (
                <>
                    <div className="text-lg">{meta.distinctTotal}</div>
                    <div>unique values</div>
                </>
            )}
        </div>
    );
}

const formatter = format('~s');

function QuantitativeProfiling({ computation, field }: FieldProfilingProps) {
    const [stat, setStat] = useState<Awaited<ReturnType<typeof profileQuantitativeField>>>();
    useEffect(() => {
        profileQuantitativeField(computation, field).then(setStat);
    }, [computation, field]);
    if (!isNotEmpty(stat)) {
        return <div className="h-24 flex items-center justify-center">Loading...</div>;
    }
    if (stat.min === stat.max) {
        return <div className="h-24 flex items-center justify-center text-xl">= {stat.min}</div>;
    }
    return (
        <div className="h-24 w-full flex flex-col space-y-1">
            <BinRenderer data={stat} />
            <div className="flex justify-between w-full text-xs font-medium leading-none">
                <div>{formatter(stat.min)}</div>
                <div>{formatter(stat.max)}</div>
            </div>
        </div>
    );
}

function BinRenderer({ data }: { data: Awaited<ReturnType<typeof profileQuantitativeField>> }) {
    const mediaTheme = useContext(themeContext);
    const { themeConfig, themeKey } = useContext(vegaThemeContext);

    const theme = getTheme({
        mediaTheme,
        themeConfig,
        themeKey,
    });

    const vegaConfig = useMemo(() => {
        const config: any = {
            ...theme,
            background: mediaTheme === 'dark' ? '#18181f' : '#ffffff',
        };
        return config;
    }, [theme]);

    const ref = useCallback(
        (node: HTMLDivElement) => {
            if (!node) {
                return;
            }
            const { width } = node.getBoundingClientRect();
            const spec = {
                width: width - 10,
                height: 70,
                autosize: 'fit',
                data: {
                    values: data.binValues.map(({ from, to, count }) => ({
                        value: `${formatter(from)} - ${formatter(to)}`,
                        sort: from,
                        count,
                    })),
                },
                mark: { type: 'bar', opacity: 0.96, tooltip: { content: 'data' } },
                encoding: {
                    x: {
                        field: 'value',
                        type: 'ordinal',
                        sort: { op: 'sum', field: 'sort' },
                        axis: false,
                    },
                    y: {
                        field: 'count',
                        type: 'quantitative',
                        axis: false,
                    },
                    tooltip: [
                        { field: 'value', type: 'ordinal', title: 'Value' },
                        { field: 'count', type: 'quantitative', title: 'Count' },
                    ],
                },
                config: { view: { stroke: null } },
            };
            embed(node, spec as unknown as VisualizationSpec, {
                renderer: 'canvas',
                mode: 'vega-lite',
                actions: false,
                config: vegaConfig,
            });
        },
        [data, vegaConfig]
    );
    return <div ref={ref} />;
}

function LazyLoaded<T>(Component: ComponentType<T>) {
    return function (props: T & { key?: React.Key }) {
        const [loaded, setLoaded] = useState(false);
        const obRef = useRef<IntersectionObserver>();
        const ref = useCallback((node: HTMLDivElement) => {
            obRef.current?.disconnect();
            if (node) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setLoaded(true);
                            observer.disconnect();
                        }
                    });
                });
                observer.observe(node);
                obRef.current = observer;
            }
        }, []);
        return (
            <>
                {loaded && <Component {...props} />}
                <div className="w-0 h-0" ref={ref}></div>
            </>
        );
    };
}

function FieldProfilingElement(props: FieldProfilingProps & { semanticType: ISemanticType; displayOffset?: number; offset?: number }) {
    const { semanticType, displayOffset, offset, ...fieldProps } = props;
    switch (semanticType) {
        case 'nominal':
        case 'ordinal':
            return <NominalProfiling {...fieldProps} />;
        case 'temporal': {
            const formatter = (date: string | number) => formatDate(parsedOffsetDate(displayOffset, offset)(date));
            return <NominalProfiling {...fieldProps} valueRenderer={formatter} />;
        }
        case 'quantitative':
            return <QuantitativeProfiling {...fieldProps} />;
    }
}

export const FieldProfiling = LazyLoaded(FieldProfilingElement);
