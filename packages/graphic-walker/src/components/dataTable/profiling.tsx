import React, { ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'd3-format';
import type { IAnalyticType, IComputationFunction, IFilterRule, ISemanticType } from '../../interfaces';
import { profileNonmialField, profileQuantitativeField, wrapComputationWithTag, type IQuantitativeProfileBin } from '../../computation';
import { _unstable_encodeRuleValue, cn, formatDate, isNotEmpty } from '../../utils';
import { parsedOffsetDate } from '../../lib/op/offset';

export interface FieldProfilingProps {
    field: string;
    computation: IComputationFunction;
}

interface ProfilingInteractionProps {
    analyticType: IAnalyticType;
    /** the filter currently applied on this field, used to highlight the selection */
    rule?: IFilterRule | null;
    /** toggles a value in a `one of` filter; omitted when filtering is disabled */
    onToggleValue?: (value: any) => void;
    /** filters the field to a range; `extend` merges the range into the current one */
    onSelectRange?: (range: [number, number], extend: boolean) => void;
}

const CHART_HEIGHT = 'h-[58px]';

// Tailwind needs the full class names to be present in the source, so every accent variant is spelled out.
const ACCENT = {
    dimension: {
        wash: 'bg-dimension/[0.16]',
        washHover: 'group-hover/value:bg-dimension/30',
        washOn: 'bg-dimension/40',
        bar: 'bg-dimension',
    },
    measure: {
        wash: 'bg-measure/[0.16]',
        washHover: 'group-hover/value:bg-measure/30',
        washOn: 'bg-measure/40',
        bar: 'bg-measure',
    },
} as const;

const formatCount = (n: number) => n.toLocaleString();

const siFormatter = format('.3~s');
const decimalFormatter = format(',.2~f');
const smallFormatter = format('.3~g');
export function formatNumber(x: number) {
    if (!Number.isFinite(x)) return `${x}`;
    const abs = Math.abs(x);
    if (abs >= 1e5) return siFormatter(x);
    if (abs >= 1 || x === 0) return decimalFormatter(x);
    return smallFormatter(x);
}

const approxFormatter = format(',.3~r');
/** A glanceable summary number, e.g. an average. */
function formatApprox(x: number) {
    if (!Number.isFinite(x)) return `${x}`;
    return Math.abs(x) >= 1e5 ? siFormatter(x) : approxFormatter(x);
}

/** Integer percentages that always add up to 100 (largest remainder). */
function toPercents(counts: number[], total: number) {
    if (!total) return counts.map(() => 0);
    const raw = counts.map((c) => (c * 100) / total);
    const result = raw.map(Math.floor);
    let left = 100 - result.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => [v - result[i], i] as const).sort((a, b) => b[0] - a[0]);
    for (let k = 0; left > 0 && k < order.length; k++, left--) {
        result[order[k][1]] += 1;
    }
    return result;
}

/** Keeps the previous result on screen while a new one loads, and drops stale responses. */
function useProfile<T>(load: () => Promise<T>, deps: React.DependencyList) {
    const [state, setState] = useState<{ data?: T; loading: boolean }>({ loading: true });
    useEffect(() => {
        let alive = true;
        setState((s) => ({ data: s.data, loading: true }));
        load().then(
            (data) => alive && setState({ data, loading: false }),
            (err) => {
                if (!alive) return;
                console.error(err);
                setState((s) => ({ data: s.data, loading: false }));
            }
        );
        return () => {
            alive = false;
        };
    }, deps);
    return state;
}

function Caption({ children }: { children?: React.ReactNode }) {
    return <div className="mt-2 h-3.5 truncate text-[11.5px] leading-[14px] text-muted-foreground">{children}</div>;
}

function Skeleton({ kind }: { kind: 'nominal' | 'quantitative' }) {
    if (kind === 'quantitative') {
        return (
            <div className={cn(CHART_HEIGHT, 'flex items-end gap-0.5 pb-[18px]')}>
                {[18, 30, 55, 80, 100, 85, 60, 40, 22, 12].map((h, i) => (
                    <div key={i} className="flex-1 animate-pulse rounded-t-[3px] bg-muted" style={{ height: `${h}%` }} />
                ))}
            </div>
        );
    }
    return (
        <div className={cn(CHART_HEIGHT, 'flex flex-col gap-[3px]')}>
            {[72, 54, 38].map((w) => (
                <div key={w} className="h-[17px] animate-pulse rounded-[5px] bg-muted" style={{ width: `${w}%` }} />
            ))}
        </div>
    );
}

function Constant({ children }: { children: React.ReactNode }) {
    return <div className={cn(CHART_HEIGHT, 'flex items-center truncate text-[15px] text-foreground/80')}>= {children}</div>;
}

function NominalProfiling({
    computation,
    field,
    analyticType,
    rule,
    onToggleValue,
    valueRenderer = (s) => `${s}`,
}: FieldProfilingProps & ProfilingInteractionProps & { valueRenderer?: (v: string | number) => string }) {
    const { t } = useTranslation('translation', { keyPrefix: 'data_table' });
    const { data: stat, loading } = useProfile(() => profileNonmialField(wrapComputationWithTag(computation, 'profiling'), field), [computation, field]);

    if (!isNotEmpty(stat)) {
        return (
            <>
                <Skeleton kind="nominal" />
                <Caption />
            </>
        );
    }

    const [meta, tops] = stat;
    const render = (value: string | number) => {
        const displayValue = valueRenderer(value);
        if (!displayValue) {
            return <span className="text-destructive">{t('empty_value')}</span>;
        }
        return displayValue;
    };

    if (meta.total === 0 || tops.length === 0) {
        return (
            <>
                <div className={cn(CHART_HEIGHT, 'flex items-center text-muted-foreground')}>—</div>
                <Caption />
            </>
        );
    }

    if (meta.distinctTotal === 1) {
        return (
            <>
                <Constant>{render(tops[0].value)}</Constant>
                <Caption>{t('unique_count', { count: 1, value: formatCount(1) })}</Caption>
            </>
        );
    }

    // shows the top values when the most frequent one is more than 1.3x the average and over 1%,
    // or when there are fewer than 10 unique values.
    const showsTops = meta.distinctTotal < 10 || (tops[0].count > (1.3 * meta.total) / meta.distinctTotal && tops[0].count > meta.total / 100);
    if (!showsTops) {
        return (
            <div className={cn('transition-opacity', loading && 'opacity-50')}>
                <div className={cn(CHART_HEIGHT, 'flex flex-col justify-center')}>
                    <div className="text-lg font-semibold leading-6">{formatCount(meta.distinctTotal)}</div>
                    <div className="text-[11.5px] text-muted-foreground">{t('unique_values')}</div>
                </div>
                <Caption>{t('distinct_ratio', { percent: Math.round((meta.distinctTotal * 100) / meta.total) })}</Caption>
            </div>
        );
    }

    const shown = meta.distinctTotal <= tops.length ? tops : tops.slice(0, 2);
    const otherCount = meta.total - shown.reduce((sum, x) => sum + x.count, 0);
    const otherValues = meta.distinctTotal - shown.length;
    const percents = toPercents(otherValues > 0 ? [...shown.map((x) => x.count), otherCount] : shown.map((x) => x.count), meta.total);

    const selected = rule?.type === 'one of' || rule?.type === 'not in' ? new Set(rule.value.map(_unstable_encodeRuleValue)) : null;
    const isOn = (value: unknown) => {
        if (!selected || !rule) return false;
        const has = selected.has(_unstable_encodeRuleValue(value));
        return rule.type === 'one of' ? has : !has;
    };
    const accent = ACCENT[analyticType];

    return (
        <div className={cn('transition-opacity', loading && 'opacity-50')}>
            <div className={cn(CHART_HEIGHT, 'flex flex-col gap-[3px]')}>
                {shown.map(({ value, count }, i) => {
                    const on = isOn(value);
                    const content = (
                        <>
                            <span
                                className={cn(
                                    'absolute inset-y-0 left-0 rounded-[5px] transition-[background-color,opacity]',
                                    on ? accent.washOn : cn(accent.wash, onToggleValue && accent.washHover),
                                    selected && !on && 'opacity-[0.45]'
                                )}
                                style={{ width: `${(count * 100) / meta.total}%` }}
                            />
                            <span className={cn('relative min-w-0 truncate', on ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                                {render(value)}
                            </span>
                            <span className={cn('relative shrink-0 text-[11.5px] tabular-nums', on ? 'text-foreground' : 'text-muted-foreground')}>
                                {percents[i]}%
                            </span>
                        </>
                    );
                    const className = 'group/value relative flex h-[17px] w-full items-center justify-between gap-2 rounded-[5px] px-1.5 text-left text-xs';
                    return onToggleValue ? (
                        <button
                            key={i}
                            type="button"
                            className={cn(className, 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}
                            title={`${valueRenderer(value) || t('empty_value')} · ${formatCount(count)}`}
                            aria-label={`${valueRenderer(value) || t('empty_value')}, ${percents[i]}%`}
                            aria-pressed={on}
                            onClick={() => onToggleValue(value)}
                        >
                            {content}
                        </button>
                    ) : (
                        <div key={i} className={className} title={`${valueRenderer(value) || t('empty_value')} · ${formatCount(count)}`}>
                            {content}
                        </div>
                    );
                })}
                {otherValues > 0 && (
                    <div className="relative flex h-[17px] w-full items-center justify-between gap-2 rounded-[5px] px-1.5 text-xs">
                        <span
                            className="absolute inset-y-0 left-0 rounded-[5px] bg-muted-foreground/[0.13]"
                            style={{ width: `${(otherCount * 100) / meta.total}%` }}
                        />
                        <span className="relative min-w-0 truncate text-muted-foreground">{t('other', { count: otherValues })}</span>
                        <span className="relative shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{percents[percents.length - 1]}%</span>
                    </div>
                )}
            </div>
            <Caption>{t('unique_count', { count: meta.distinctTotal, value: formatCount(meta.distinctTotal) })}</Caption>
        </div>
    );
}

function binIsOn(bin: IQuantitativeProfileBin, rule?: IFilterRule | null) {
    if (rule?.type !== 'range' || bin.count === 0) return false;
    const lo = rule.value[0] ?? -Infinity;
    const hi = rule.value[1] ?? Infinity;
    return (bin.min ?? bin.from) <= hi && (bin.max ?? bin.to) >= lo;
}

function QuantitativeProfiling({ computation, field, analyticType, rule, onSelectRange }: FieldProfilingProps & ProfilingInteractionProps) {
    const { t } = useTranslation('translation', { keyPrefix: 'data_table' });
    const { data: stat, loading } = useProfile(() => profileQuantitativeField(wrapComputationWithTag(computation, 'profiling'), field), [computation, field]);

    if (!isNotEmpty(stat)) {
        return (
            <>
                <Skeleton kind="quantitative" />
                <Caption />
            </>
        );
    }
    if (stat.total === 0 || stat.binValues.length === 0) {
        return (
            <>
                <div className={cn(CHART_HEIGHT, 'flex items-center text-muted-foreground')}>—</div>
                <Caption />
            </>
        );
    }
    if (stat.min === stat.max) {
        return (
            <>
                <Constant>{formatNumber(stat.min)}</Constant>
                <Caption>{t('avg', { value: formatApprox(stat.mean) })}</Caption>
            </>
        );
    }

    const peak = Math.max(...stat.binValues.map((b) => b.count));
    const hasSelection = rule?.type === 'range';
    const accent = ACCENT[analyticType];
    const lastIndex = stat.binValues.length - 1;

    return (
        <div className={cn('transition-opacity', loading && 'opacity-50')}>
            <div className={CHART_HEIGHT}>
                <div className="flex h-10 items-end gap-0.5 border-b">
                    {stat.binValues.map((bin, i) => {
                        const on = binIsOn(bin, rule);
                        const lo = bin.min ?? bin.from;
                        const hi = bin.max ?? bin.to;
                        const label = `${formatNumber(bin.from)} – ${formatNumber(bin.to)}`;
                        const interactive = onSelectRange && bin.count > 0;
                        return (
                            <button
                                key={i}
                                type="button"
                                disabled={!interactive}
                                aria-label={`${label}: ${t('row_count', { count: bin.count, value: formatCount(bin.count) })}`}
                                aria-pressed={interactive ? on : undefined}
                                className="group/bin relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-none enabled:cursor-pointer disabled:cursor-default"
                                onClick={(e) => onSelectRange?.([lo, hi], e.shiftKey)}
                            >
                                <span
                                    className={cn(
                                        'w-full rounded-t-[3px] transition-opacity',
                                        accent.bar,
                                        hasSelection
                                            ? on
                                                ? 'opacity-100'
                                                : 'opacity-25'
                                            : 'opacity-80 group-hover/bin:opacity-100 group-focus-visible/bin:opacity-100'
                                    )}
                                    style={{ height: bin.count ? `${Math.max(4, (bin.count / peak) * 100)}%` : 0 }}
                                />
                                <span
                                    className={cn(
                                        'pointer-events-none absolute bottom-[calc(100%+6px)] z-20 flex items-baseline gap-1.5 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11.5px] leading-4 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/bin:opacity-100 group-focus-visible/bin:opacity-100',
                                        i < 2 ? 'left-0' : i > lastIndex - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                                    )}
                                >
                                    <b className="font-semibold tabular-nums">{label}</b>
                                    <span className="tabular-nums text-muted-foreground">
                                        {t('row_count', { count: bin.count, value: formatCount(bin.count) })}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-[5px] flex justify-between text-[11px] leading-3 tabular-nums text-muted-foreground">
                    <span>{formatNumber(stat.min)}</span>
                    <span>{formatNumber(stat.max)}</span>
                </div>
            </div>
            <Caption>{t('avg', { value: formatApprox(stat.mean) })}</Caption>
        </div>
    );
}

function LazyLoaded<T>(Component: ComponentType<T>) {
    return function (props: T & { key?: React.Key }) {
        const [loaded, setLoaded] = useState(false);
        const obRef = useRef<IntersectionObserver>(null);
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

function FieldProfilingElement(
    props: FieldProfilingProps & ProfilingInteractionProps & { semanticType: ISemanticType; displayOffset?: number; offset?: number }
) {
    const { semanticType, displayOffset, offset, ...fieldProps } = props;
    switch (semanticType) {
        case 'nominal':
        case 'ordinal':
            return <NominalProfiling {...fieldProps} />;
        case 'temporal': {
            const formatter = (date: string | number) => formatDate(parsedOffsetDate(displayOffset, offset)(date));
            // temporal filters are edited as ranges, so picking single dates from the profile is not offered
            return <NominalProfiling {...fieldProps} onToggleValue={undefined} valueRenderer={formatter} />;
        }
        case 'quantitative':
            return <QuantitativeProfiling {...fieldProps} />;
    }
}

export const FieldProfiling = LazyLoaded(FieldProfilingElement);
