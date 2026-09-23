import React, { useMemo, useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, ForwardedRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/16/solid';
import type { IMutField, IRow, IComputationFunction, IFilterRule, IFilterField, IFilterWorkflowStep, IVisFilter, ISemanticType } from '../../interfaces';
import { dataReadRaw } from '../../computation';
import Pagination from './pagination';
import { getHeaderKey, getHeaders } from './headers';
import { PureFilterEditDialog } from '../../fields/filterField/filterEditDialog';
import { ComputationContext } from '../../store';
import { parsedOffsetDate } from '../../lib/op/offset';
import { _unstable_encodeRuleValue, cn, formatDate } from '../../utils';
import { FieldProfiling, formatNumber } from './profiling';
import { ColumnHeader, type ISortDirection } from './columnHeader';
import { addFilterForQuery, createFilter } from '../../utils/workflow';
import { Button } from '../ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import Spinner from '../spinner';

interface DataTableProps {
    /** page limit */
    size?: number;
    metas: IMutField[];
    computation: IComputationFunction;
    onMetaChange?: (fid: string, fIndex: number, meta: Partial<IMutField>) => void;
    disableFilter?: boolean;
    disableSorting?: boolean;
    hideSemanticType?: boolean;
    hideProfiling?: boolean;
    hidePaginationAtOnepage?: boolean;
    displayOffset?: number;
}

const SEMANTIC_TYPE_LIST: ISemanticType[] = ['nominal', 'ordinal', 'quantitative', 'temporal'];

const formatCount = (n: number) => n.toLocaleString();

function useFilters(metas: IMutField[]) {
    const [filters, setFilters] = useState<IFilterField[]>([]);
    const [editingFilterIdx, setEditingFilterIdx] = useState<number | null>(null);
    const options = useMemo(() => {
        return metas.map((x) => ({ label: x.name ?? x.fid, value: x.fid }));
    }, [metas]);
    const onSelectFilter = useCallback(
        (fid: string) => {
            const i = filters.findIndex((x) => x.fid === fid);
            if (i > -1) {
                setEditingFilterIdx(i);
            } else {
                const meta = metas.find((x) => x.fid === fid);
                if (!meta) return;
                const newFilter: IFilterField = {
                    fid,
                    rule: null,
                    analyticType: meta.analyticType,
                    name: meta.name ?? meta.fid,
                    semanticType: meta.semanticType,
                };
                if (editingFilterIdx === null || !filters[editingFilterIdx]) {
                    setFilters(filters.concat(newFilter));
                    setEditingFilterIdx(filters.length);
                } else {
                    setFilters(filters.map((x, i) => (i === editingFilterIdx ? newFilter : x)));
                }
            }
        },
        [metas, filters, editingFilterIdx]
    );
    const onWriteFilter = useCallback((index: number, rule: IFilterRule | null) => {
        setFilters((f) => f.map((x, i) => (i === index ? { ...x, rule } : x)));
    }, []);
    const onClose = useCallback(() => {
        setEditingFilterIdx(null);
        // a filter that was opened but never given a rule should not linger as an empty chip
        setFilters((f) => (f.every((x) => x.rule) ? f : f.filter((x) => x.rule)));
    }, []);
    /** creates, replaces or (with `null`) removes the filter of a field */
    const setFieldRule = useCallback(
        (fid: string, rule: IFilterRule | null) => {
            setFilters((fs) => {
                const i = fs.findIndex((x) => x.fid === fid);
                if (!rule) {
                    return i > -1 ? fs.filter((_, j) => j !== i) : fs;
                }
                if (i > -1) {
                    return fs.map((x, j) => (j === i ? { ...x, rule } : x));
                }
                const meta = metas.find((x) => x.fid === fid);
                if (!meta) return fs;
                return fs.concat({ fid, rule, analyticType: meta.analyticType, name: meta.name ?? meta.fid, semanticType: meta.semanticType });
            });
        },
        [metas]
    );
    const clearFilters = useCallback(() => setFilters([]), []);
    return { filters, options, editingFilterIdx, onSelectFilter, onWriteFilter, onClose, setFieldRule, clearFilters };
}

function fieldValue(props: { field: IMutField; item: IRow; displayOffset?: number }) {
    const { field, item } = props;
    if (field.semanticType === 'temporal') {
        return formatDate(parsedOffsetDate(props.displayOffset, field.offset)(item[field.fid]));
    }
    return `${item[field.fid]}`;
}

function CopyButton(props: { value: string }) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => {
                setCopied(false);
            }, 2000);
            return () => {
                clearTimeout(timer);
            };
        }
    }, [copied]);
    return (
        <Button
            variant="secondary"
            className="h-6 px-2 text-xs w-14"
            size="sm"
            onClick={() => {
                try {
                    navigator.clipboard.writeText(props.value);
                    setCopied(true);
                } catch (e) {
                    console.error(e);
                }
            }}
            disabled={copied}
        >
            {copied ? 'Copied' : 'Copy'}
        </Button>
    );
}

function TruncateDector(props: { value: string }) {
    const ref = useRef<HTMLAnchorElement>(null);
    const [isTruncate, setIsTruncate] = useState(false);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (ref.current) {
            setIsTruncate(ref.current.offsetWidth < ref.current.scrollWidth);
        }
    }, [ref.current]);
    return (
        <HoverCard open={open && isTruncate} onOpenChange={setOpen}>
            <HoverCardTrigger ref={ref} className="truncate block">
                {props.value}
            </HoverCardTrigger>
            <HoverCardContent className="flex space-x-2 items-center w-fit py-2 px-3">
                <p className="text-xs max-w-[360px] line-clamp-4 break-all">{props.value}</p>
                <CopyButton value={props.value} />
            </HoverCardContent>
        </HoverCard>
    );
}

function useRuleDescription(displayOffset?: number) {
    const { t } = useTranslation('translation', { keyPrefix: 'data_table' });
    return useCallback(
        (rule: IFilterRule) => {
            switch (rule.type) {
                case 'one of':
                case 'not in': {
                    const values = rule.value.map((x) => `${x}`);
                    const text = values.length > 2 ? t('n_values', { count: values.length }) : values.join(', ');
                    return rule.type === 'not in' ? `≠ ${text}` : text;
                }
                case 'range':
                    return `${rule.value[0] === null ? '…' : formatNumber(rule.value[0])} – ${rule.value[1] === null ? '…' : formatNumber(rule.value[1])}`;
                case 'temporal range': {
                    const format = (x: number | null) => (x === null ? '…' : formatDate(parsedOffsetDate(displayOffset, rule.offset)(x)));
                    return `${format(rule.value[0])} – ${format(rule.value[1])}`;
                }
                case 'regexp':
                    return `/${rule.value}/`;
            }
        },
        [t, displayOffset]
    );
}

function FilterChip(props: { name: string; description: string; analyticType: IMutField['analyticType']; onEdit: () => void; onRemove: () => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'data_table' });
    return (
        <span className="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-md border pl-2 pr-0.5 text-xs">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-[2px]', props.analyticType === 'dimension' ? 'bg-dimension' : 'bg-measure')} />
            <button
                type="button"
                className="flex min-w-0 items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={props.onEdit}
            >
                <span className="text-muted-foreground">{props.name}</span>
                <span className="max-w-[180px] truncate font-medium text-foreground">{props.description}</span>
            </button>
            <button
                type="button"
                aria-label={t('remove_filter', { name: props.name })}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={props.onRemove}
            >
                <XMarkIcon className="h-3 w-3" />
            </button>
        </span>
    );
}

const strong = <b className="font-semibold tabular-nums text-foreground" />;

const DataTable = forwardRef(
    (
        props: DataTableProps,
        ref: ForwardedRef<{
            getFilters: () => IVisFilter[];
        }>
    ) => {
        const {
            size = 10,
            onMetaChange,
            metas,
            computation,
            disableFilter,
            disableSorting,
            hideSemanticType,
            displayOffset,
            hidePaginationAtOnepage,
            hideProfiling,
        } = props;
        const [pageIndex, setPageIndex] = useState(0);
        const { t } = useTranslation();
        const computationFunction = computation;

        const semanticTypeList = useMemo(() => {
            return SEMANTIC_TYPE_LIST.map((st) => ({
                value: st,
                label: t(`constant.semantic_type.${st}`),
            }));
        }, [t]);

        const [rows, setRows] = useState<IRow[]>([]);
        const [dataLoading, setDataLoading] = useState(false);
        const taskIdRef = useRef(0);

        const [sorting, setSorting] = useState<{ fid: string; sort: ISortDirection } | undefined>();

        const { filters, editingFilterIdx, onClose, onSelectFilter, onWriteFilter, setFieldRule, clearFilters, options } = useFilters(metas);

        const filtersRef = useRef(filters);
        filtersRef.current = filters;

        useImperativeHandle(ref, () => ({
            getFilters: () => filtersRef.current.filter((x) => x.rule) as IVisFilter[],
        }));

        const activeFilters = useMemo(() => (disableFilter ? [] : filters.filter((x) => x.rule)), [disableFilter, filters]);
        const filterRules = useMemo(() => activeFilters.map(createFilter), [activeFilters]);
        const describeRule = useRuleDescription(displayOffset);

        const [total, setTotal] = useState(0);
        const [unfilteredTotal, setUnfilteredTotal] = useState(0);
        const [statLoading, setStatLoading] = useState(false);

        // Get count when filter changed
        useEffect(() => {
            setStatLoading(true);
            const countOf = (f: IVisFilter[]) =>
                computation({
                    workflow: [
                        ...(f.length > 0
                            ? [
                                  {
                                      type: 'filter',
                                      filters: f,
                                  } as IFilterWorkflowStep,
                              ]
                            : []),
                        {
                            type: 'view',
                            query: [
                                {
                                    op: 'aggregate',
                                    groupBy: [],
                                    measures: [
                                        {
                                            field: '*',
                                            agg: 'count',
                                            asFieldKey: 'count',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }).then((v) => (v[0]?.count ?? 0) as number);
            let alive = true;
            countOf(filterRules).then((count) => {
                if (!alive) return;
                setTotal(count);
                setStatLoading(false);
            });
            if (filterRules.length > 0) {
                countOf([]).then((count) => alive && setUnfilteredTotal(count));
            }
            return () => {
                alive = false;
            };
        }, [filterRules, computation]);

        // a new filter or sort order starts from the first page
        useEffect(() => {
            setPageIndex(0);
        }, [filterRules, sorting]);

        const from = pageIndex * size;
        const to = Math.min((pageIndex + 1) * size - 1, total - 1);

        useEffect(() => {
            if (from > total) {
                setPageIndex(0);
            }
        }, [from, total]);

        useEffect(() => {
            setDataLoading(true);
            const taskId = ++taskIdRef.current;
            dataReadRaw(computationFunction, size, pageIndex, {
                sorting: disableSorting ? undefined : sorting,
                filters: filterRules,
            })
                .then((data) => {
                    if (taskId === taskIdRef.current) {
                        setDataLoading(false);
                        setRows(data);
                    }
                })
                .catch((err) => {
                    if (taskId === taskIdRef.current) {
                        console.error(err);
                        setDataLoading(false);
                        setRows([]);
                    }
                });
            return () => {
                taskIdRef.current++;
            };
        }, [computationFunction, pageIndex, size, sorting, filterRules, disableSorting]);

        // Each column is profiled against every filter except its own, so a filtered column keeps showing its whole
        // distribution with the selection highlighted. Functions are reused while a column's filters are unchanged,
        // which keeps its profile from being fetched again.
        const profileCache = useRef(new Map<string, { key: string; base: IComputationFunction; fn: IComputationFunction }>());
        const profileComputations = useMemo(() => {
            const next = new Map<string, { key: string; base: IComputationFunction; fn: IComputationFunction }>();
            for (const meta of metas) {
                const rules = filterRules.filter((x) => x.fid !== meta.fid);
                const key = JSON.stringify(rules);
                const prev = profileCache.current.get(meta.fid);
                if (prev && prev.key === key && prev.base === computation) {
                    next.set(meta.fid, prev);
                } else {
                    next.set(meta.fid, {
                        key,
                        base: computation,
                        fn: rules.length > 0 ? (query) => computation(addFilterForQuery(query, rules)) : computation,
                    });
                }
            }
            profileCache.current = next;
            return next;
        }, [computation, filterRules, metas]);

        const loading = statLoading || dataLoading;

        const headers = useMemo(() => getHeaders(metas), [metas]);

        const [isSticky, setIsSticky] = useState(false);

        const obRef = useRef<IntersectionObserver>(null);
        const stickyDector = useCallback((node: HTMLDivElement) => {
            obRef.current?.disconnect();
            if (node) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        setIsSticky(!entry.isIntersecting);
                    });
                });
                observer.observe(node);
                obRef.current = observer;
            }
        }, []);

        const filterByFid = useMemo(() => new Map(activeFilters.map((x) => [x.fid, x])), [activeFilters]);

        const toggleValue = useCallback(
            (fid: string, value: any) => {
                const rule = filterByFid.get(fid)?.rule;
                const values = rule?.type === 'one of' ? [...rule.value] : [];
                const encoded = _unstable_encodeRuleValue(value);
                const i = values.findIndex((x) => _unstable_encodeRuleValue(x) === encoded);
                if (i > -1) {
                    values.splice(i, 1);
                } else {
                    values.push(value);
                }
                setFieldRule(fid, values.length > 0 ? { type: 'one of', value: values } : null);
            },
            [filterByFid, setFieldRule]
        );

        const selectRange = useCallback(
            (fid: string, [lo, hi]: [number, number], extend: boolean) => {
                const rule = filterByFid.get(fid)?.rule;
                if (rule?.type === 'range') {
                    if (extend) {
                        setFieldRule(fid, { type: 'range', value: [Math.min(rule.value[0] ?? lo, lo), Math.max(rule.value[1] ?? hi, hi)] });
                        return;
                    }
                    if (rule.value[0] === lo && rule.value[1] === hi) {
                        setFieldRule(fid, null);
                        return;
                    }
                }
                setFieldRule(fid, { type: 'range', value: [lo, hi] });
            },
            [filterByFid, setFieldRule]
        );

        const toggleSort = useCallback((fid: string) => {
            setSorting((s) => {
                if (s?.fid !== fid) return { fid, sort: 'descending' };
                if (s.sort === 'descending') return { fid, sort: 'ascending' };
                return undefined;
            });
        }, []);

        const showFooter = !(hidePaginationAtOnepage && total <= size);
        const headerRowCount = headers.length + (hideProfiling ? 0 : 1);

        return (
            <div className="relative flex h-full flex-col overflow-hidden rounded-lg border bg-background text-[13px] text-foreground">
                <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
                    <span className="whitespace-nowrap text-muted-foreground">
                        {activeFilters.length > 0 ? (
                            <Trans
                                i18nKey="data_table.rows_filtered"
                                count={total}
                                values={{ value: formatCount(total), total: formatCount(unfilteredTotal) }}
                                components={{ b: strong }}
                            />
                        ) : (
                            <Trans i18nKey="data_table.rows" count={total} values={{ value: formatCount(total) }} components={{ b: strong }} />
                        )}
                    </span>
                    <span className="h-4 w-px shrink-0 bg-border" />
                    <span className="whitespace-nowrap text-muted-foreground">
                        <Trans i18nKey="data_table.columns" count={metas.length} values={{ value: formatCount(metas.length) }} components={{ b: strong }} />
                    </span>
                    {activeFilters.length > 0 && (
                        <>
                            <span className="h-4 w-px shrink-0 bg-border" />
                            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
                                {activeFilters.map((x) => (
                                    <FilterChip
                                        key={x.fid}
                                        name={x.name}
                                        analyticType={x.analyticType}
                                        description={describeRule(x.rule!)}
                                        onEdit={() => onSelectFilter(x.fid)}
                                        onRemove={() => setFieldRule(x.fid, null)}
                                    />
                                ))}
                                <button
                                    type="button"
                                    className="shrink-0 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    onClick={clearFilters}
                                >
                                    {t('data_table.clear')}
                                </button>
                            </div>
                        </>
                    )}
                    {loading && <Spinner className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </div>
                <div className="relative min-h-0 flex-1 overflow-auto" style={{ maxHeight: '600px' }}>
                    <div className="h-0 w-full" ref={stickyDector}></div>
                    <table className="w-full border-separate border-spacing-0">
                        <thead className={cn('sticky top-0 z-10 bg-background', isSticky && 'shadow-[0_8px_16px_-12px_rgba(0,0,0,0.35)]')}>
                            {headers.map((row, rowIndex) => (
                                <tr key={`row_${rowIndex}`}>
                                    {rowIndex === 0 && (
                                        <th
                                            rowSpan={headerRowCount}
                                            scope="col"
                                            className="w-11 min-w-[44px] border-b pr-2.5 pt-[15px] text-right align-top text-[11px] font-normal text-muted-foreground/70"
                                        >
                                            #
                                        </th>
                                    )}
                                    {row.map((f, i) => {
                                        if (f.type === 'name') {
                                            return (
                                                <th
                                                    key={`group_${i}_${f.value}`}
                                                    colSpan={f.colSpan}
                                                    rowSpan={f.rowSpan}
                                                    scope="colgroup"
                                                    className="border-b border-border/60 px-3 pb-1.5 pt-3 text-left align-bottom text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                                                >
                                                    <span className="sticky left-3 whitespace-nowrap">{f.value}</span>
                                                </th>
                                            );
                                        }
                                        const field = f.value;
                                        const sort = sorting?.fid === field.fid ? sorting.sort : undefined;
                                        return (
                                            <th
                                                key={getHeaderKey(f)}
                                                colSpan={f.colSpan}
                                                rowSpan={f.rowSpan}
                                                scope="col"
                                                aria-sort={sort ?? 'none'}
                                                className={cn(
                                                    'group/th min-w-[128px] px-3 pt-3 text-left align-bottom font-normal',
                                                    hideProfiling ? 'border-b pb-3' : 'pb-2.5',
                                                    sort && 'bg-foreground/[0.025]'
                                                )}
                                            >
                                                <ColumnHeader
                                                    field={field}
                                                    sort={sort}
                                                    filtered={filterByFid.has(field.fid)}
                                                    hideSemanticType={hideSemanticType}
                                                    semanticTypeOptions={semanticTypeList}
                                                    onToggleSort={disableSorting ? undefined : () => toggleSort(field.fid)}
                                                    onSort={disableSorting ? undefined : (s) => setSorting(s ? { fid: field.fid, sort: s } : undefined)}
                                                    onFilter={disableFilter ? undefined : () => onSelectFilter(field.fid)}
                                                    onClearFilter={disableFilter ? undefined : () => setFieldRule(field.fid, null)}
                                                    onChangeSemanticType={
                                                        onMetaChange ? (semanticType) => onMetaChange(field.fid, f.fIndex, { semanticType }) : undefined
                                                    }
                                                />
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                            {!hideProfiling && (
                                <tr>
                                    {metas.map((field) => (
                                        <th
                                            key={field.fid}
                                            className={cn(
                                                'border-b px-3 pb-3 text-left align-top font-normal',
                                                sorting?.fid === field.fid && 'bg-foreground/[0.025]'
                                            )}
                                        >
                                            <FieldProfiling
                                                field={field.fid}
                                                semanticType={field.semanticType}
                                                analyticType={field.analyticType}
                                                computation={profileComputations.get(field.fid)?.fn ?? computation}
                                                displayOffset={displayOffset}
                                                offset={field.offset}
                                                rule={filterByFid.get(field.fid)?.rule}
                                                onToggleValue={disableFilter ? undefined : (value) => toggleValue(field.fid, value)}
                                                onSelectRange={disableFilter ? undefined : (range, extend) => selectRange(field.fid, range, extend)}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            )}
                        </thead>
                        <tbody className={cn('transition-opacity', dataLoading && rows.length > 0 && 'opacity-60')}>
                            {rows.map((row, index) => (
                                <tr className="hover:bg-muted/50" key={index}>
                                    <td className="border-b border-border/60 pr-2.5 text-right text-[11.5px] tabular-nums text-muted-foreground/70">
                                        {formatCount(from + index + 1)}
                                    </td>
                                    {metas.map((field) => {
                                        const value = fieldValue({ field, item: row, displayOffset });
                                        return (
                                            <td
                                                key={field.fid + index}
                                                className={cn(
                                                    'h-9 max-w-[280px] whitespace-nowrap border-b border-border/60 px-3',
                                                    field.analyticType === 'measure'
                                                        ? 'text-right tabular-nums text-foreground'
                                                        : 'text-left text-foreground/80',
                                                    sorting?.fid === field.fid && 'bg-foreground/[0.025]'
                                                )}
                                            >
                                                <TruncateDector value={value} />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!loading && rows.length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                            <span>{activeFilters.length > 0 ? t('data_table.no_matching_rows') : t('data_table.no_rows')}</span>
                            {activeFilters.length > 0 && (
                                <Button variant="outline" size="sm" onClick={clearFilters}>
                                    {t('data_table.clear_filters')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                {showFooter && (
                    <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-t pl-4 pr-3">
                        <span className="whitespace-nowrap text-muted-foreground">
                            {total > 0 && (
                                <Trans
                                    i18nKey="data_table.range"
                                    values={{ from: formatCount(from + 1), to: formatCount(to + 1), total: formatCount(total) }}
                                    components={{ b: strong }}
                                />
                            )}
                        </span>
                        <Pagination
                            total={total}
                            pageSize={size}
                            pageIndex={pageIndex}
                            onNext={() => {
                                setPageIndex(Math.min(Math.ceil(total / size) - 1, pageIndex + 1));
                            }}
                            onPrev={() => {
                                setPageIndex(Math.max(0, pageIndex - 1));
                            }}
                            onPageChange={(index) => {
                                setPageIndex(Math.max(0, Math.min(Math.ceil(total / size) - 1, index)));
                            }}
                        />
                    </div>
                )}
                {!disableFilter && (
                    <ComputationContext.Provider value={computation}>
                        <div className="text-xs">
                            <PureFilterEditDialog
                                editingFilterIdx={editingFilterIdx}
                                meta={metas}
                                onClose={onClose}
                                onSelectFilter={onSelectFilter}
                                onWriteFilter={onWriteFilter}
                                options={options}
                                viewFilters={filters}
                                displayOffset={displayOffset}
                            />
                        </div>
                    </ComputationContext.Provider>
                )}
            </div>
        );
    }
);

export default DataTable;
