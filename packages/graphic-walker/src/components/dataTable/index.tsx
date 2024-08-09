import React, { useMemo, useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, ForwardedRef } from 'react';
import styled from 'styled-components';
import type { IMutField, IRow, IComputationFunction, IFilterFiledSimple, IFilterRule, IFilterField, IFilterWorkflowStep, IField, IVisFilter } from '../../interfaces';
import { useTranslation } from 'react-i18next';
import LoadingLayer from '../loadingLayer';
import { dataReadRaw } from '../../computation';
import Pagination from './pagination';
import DropdownContext from '../dropdownContext';
import DataTypeIcon from '../dataTypeIcon';
import { PureFilterEditDialog } from '../../fields/filterField/filterEditDialog';
import { BarsArrowDownIcon, BarsArrowUpIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { ComputationContext } from '../../store';
import { parsedOffsetDate } from '../../lib/op/offset';
import { cn, formatDate } from '../../utils';
import { FieldProfiling } from './profiling';
import { addFilterForQuery, createFilter } from '../../utils/workflow';
import { Button, buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';

interface DataTableProps {
    /** page limit */
    size?: number;
    metas: IMutField[];
    computation: IComputationFunction;
    onMetaChange?: (fid: string, fIndex: number, meta: Partial<IMutField>) => void;
    disableFilter?: boolean;
    hideProfiling?: boolean;
    hidePaginationAtOnepage?: boolean;
    displayOffset?: number;
}
const Container = styled.div`
    overflow-x: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    table {
        box-sizing: content-box;
        border-collapse: collapse;
        font-size: 12px;
        tbody {
            td {
            }
            td.number {
                text-align: right;
            }
            td.text {
                text-align: left;
            }
        }
    }
`;
// const ANALYTIC_TYPE_LIST = ['dimension', 'measure'];
const SEMANTIC_TYPE_LIST = ['nominal', 'ordinal', 'quantitative', 'temporal'];
// function getCellType(field: IMutField): 'number' | 'text' {
//     return field.dataType === 'number' || field.dataType === 'integer' ? 'number' : 'text';
// }
function getHeaderType(field: IMutField): 'number' | 'text' {
    return field.analyticType === 'dimension' ? 'text' : 'number';
}

function getHeaderClassNames(field: IMutField) {
    return field.analyticType === 'dimension' ? 'border-t-2 border-dimension' : 'border-t-2 border-measure';
}

function getSemanticColors(field: IMutField): string {
    switch (field.semanticType) {
        case 'nominal':
            return 'border border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-600';
        case 'ordinal':
            return 'border border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-600';
        case 'quantitative':
            return 'border border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-600';
        case 'temporal':
            return 'border border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-600';
        default:
            return 'border border-transparent bg-gray-400';
    }
}

type wrapMutField = {
    colSpan: number;
    rowSpan: number;
} & (
    | { type: 'field'; value: IMutField; fIndex: number }
    | {
          type: 'name';
          value: string;
      }
);

const getHeaders = (metas: IMutField[]): wrapMutField[][] => {
    const height = metas.map((x) => x.path?.length ?? 1).reduce((a, b) => Math.max(a, b), 0);
    const result: wrapMutField[][] = [...Array(height)].map(() => []);
    let now = 1;
    metas.forEach((x, fIndex) => {
        const path = x.path ?? [x.name ?? x.fid];
        if (path.length > now) {
            for (let i = now - 1; i < path.length - 1; i++) {
                result[i].push({
                    colSpan: 0,
                    rowSpan: 1,
                    type: 'name',
                    value: path[i],
                });
            }
        }
        now = path.length;
        for (let i = 0; i < path.length - 1; i++) {
            result[i][result[i].length - 1].colSpan++;
        }
        result[path.length - 1].push({
            type: 'field',
            value: x,
            colSpan: 1,
            rowSpan: height - path.length + 1,
            fIndex,
        });
    });
    return result;
};

const getHeaderKey = (f: wrapMutField) => {
    if (f.type === 'name') {
        return f.value;
    }
    return f.value.name ?? f.value.fid;
};

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
    const onDeleteFilter = useCallback((index: number) => {
        setFilters((f) => f.filter((_, i) => i !== index));
    }, []);
    const onClose = useCallback(() => {
        setEditingFilterIdx(null);
    }, []);
    return { filters, options, editingFilterIdx, onSelectFilter, onDeleteFilter, onWriteFilter, onClose };
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

const DataTable = forwardRef(
    (
        props: DataTableProps,
        ref: ForwardedRef<{
            getFilters: () => IVisFilter[];
        }>
    ) => {
    const { size = 10, onMetaChange, metas, computation, disableFilter, displayOffset, hidePaginationAtOnepage, hideProfiling } = props;
    const [pageIndex, setPageIndex] = useState(0);
    const { t } = useTranslation();
    const computationFunction = computation;

    const semanticTypeList = useMemo<{ value: string; label: string }[]>(() => {
        return SEMANTIC_TYPE_LIST.map((st) => ({
            value: st,
            label: t(`constant.semantic_type.${st}`),
        }));
    }, []);

    const [rows, setRows] = useState<IRow[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const taskIdRef = useRef(0);

    const [sorting, setSorting] = useState<{ fid: string; sort: 'ascending' | 'descending' } | undefined>();

    const { filters, editingFilterIdx, onClose, onDeleteFilter, onSelectFilter, onWriteFilter, options } = useFilters(metas);

    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    useImperativeHandle(ref, () => ({
        getFilters: () => filtersRef.current.filter(x => x.rule) as IVisFilter[],
    }));

    const [total, setTotal] = useState(0);
    const [statLoading, setStatLoading] = useState(false);

    // Get count when filter changed
    useEffect(() => {
        const f = filters.filter((x) => x.rule).map((x) => ({ ...x, rule: x.rule }));
        setStatLoading(true);
        computation({
            workflow: [
                ...(!disableFilter && f && f.length > 0
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
        }).then((v) => {
            setTotal(v[0]?.count ?? 0);
            setStatLoading(false);
        });
    }, [disableFilter, filters, computation]);

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
            sorting,
            filters: filters.filter((x) => x.rule).map((x) => ({ ...x, rule: x.rule! })),
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
    }, [computationFunction, pageIndex, size, sorting, filters]);

    const filteredComputation = useMemo((): IComputationFunction => {
        const filterRules = filters.filter((f) => f.rule).map(createFilter);
        return (query) => computation(addFilterForQuery(query, filterRules));
    }, [computation, filters]);

    const loading = statLoading || dataLoading;

    const headers = useMemo(() => getHeaders(metas), [metas]);

    const [isSticky, setIsSticky] = useState(false);

    const obRef = useRef<IntersectionObserver>();
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
    return (
        <Container className="relative">
            {!disableFilter && filters.length > 0 && (
                <div className="flex items-center p-2 space-x-2">
                    <span>Filters: </span>
                    {filters.map((x, i) => (
                        <FilterPill key={x.fid} name={x.name} onClick={() => onSelectFilter(x.fid)} onRemove={() => onDeleteFilter(i)} />
                    ))}
                </div>
            )}
            {!(hidePaginationAtOnepage && total <= size) && (
                <nav className="flex items-center justify-end space-x-2 p-2" aria-label="Pagination">
                    <div className="hidden sm:block flex-1">
                        <p className="text-sm text-muted-foreground">
                            Showing <span className="font-medium">{from + 1}</span> to <span className="font-medium">{to + 1}</span> of{' '}
                            <span className="font-medium">{total}</span> results
                        </p>
                    </div>
                    <div className="space-x-2">
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
                </nav>
            )}
            <div className="overflow-y-auto h-full" style={{ maxHeight: '600px' }}>
                <div className="h-0 w-full" ref={stickyDector}></div>
                <table className="min-w-full relative border-x">
                    <thead className={`sticky top-0 bg-background ${isSticky ? 'shadow-md' : ''}`}>
                        {headers.map((row) => (
                            <tr className="divide-x divide-border" key={`row_${getHeaderKey(row[0])}`}>
                                {row.map((f, i) => (
                                    <th
                                        colSpan={f.colSpan}
                                        rowSpan={f.rowSpan}
                                        key={getHeaderKey(f)}
                                        className="align-top p-0 border-b bg-background"
                                        style={{ zIndex: row.length - i }}
                                    >
                                        {f.type === 'name' && (
                                            <div
                                                className={
                                                    'inset-x-0 border-t-4 border-yellow-400 whitespace-nowrap py-3.5 text-left text-xs font-medium text-foreground'
                                                }
                                            >
                                                <b className="sticky inset-x-0 w-fit px-4 sm:pl-6">{f.value}</b>
                                            </div>
                                        )}
                                        {f.type === 'field' && (
                                            <div
                                                className={
                                                    getHeaderClassNames(f.value) +
                                                    ' whitespace-nowrap py-3.5 px-4 text-left text-xs font-medium text-foreground flex items-center gap-1 group'
                                                }
                                            >
                                                <div className="font-normal block">
                                                    {!onMetaChange && (
                                                        <span className={'inline-flex p-0.5 text-xs mt-1 rounded ' + getSemanticColors(f.value)}>
                                                            <DataTypeIcon dataType={f.value.semanticType} analyticType={f.value.analyticType} />
                                                        </span>
                                                    )}
                                                    {onMetaChange && (
                                                        <DropdownContext
                                                            options={semanticTypeList}
                                                            onSelect={(value) => {
                                                                onMetaChange(f.value.fid, f.fIndex, {
                                                                    semanticType: value as IMutField['semanticType'],
                                                                });
                                                            }}
                                                        >
                                                            <span
                                                                className={
                                                                    'cursor-pointer inline-flex p-0.5 text-xs mt-1 rounded hover:scale-125 ' +
                                                                    getSemanticColors(f.value)
                                                                }
                                                            >
                                                                <DataTypeIcon dataType={f.value.semanticType} analyticType={f.value.analyticType} />
                                                            </span>
                                                        </DropdownContext>
                                                    )}
                                                </div>
                                                <b
                                                    className="inline-block"
                                                    onClick={() =>
                                                        setSorting((s) => {
                                                            if (s?.fid === f.value.fid && s.sort === 'descending') {
                                                                return {
                                                                    fid: f.value.fid,
                                                                    sort: 'ascending',
                                                                };
                                                            }
                                                            return {
                                                                fid: f.value.fid,
                                                                sort: 'descending',
                                                            };
                                                        })
                                                    }
                                                >
                                                    {f.value.basename || f.value.name || f.value.fid}
                                                </b>
                                                {sorting?.fid === f.value.fid && (
                                                    <div className="mx-1">
                                                        {sorting.sort === 'ascending' && <BarsArrowUpIcon className="w-3" />}
                                                        {sorting.sort === 'descending' && <BarsArrowDownIcon className="w-3" />}
                                                    </div>
                                                )}
                                                {!disableFilter && (
                                                    <div
                                                        className={buttonVariants({
                                                            variant: 'ghost',
                                                            className: 'cursor-pointer invisible group-hover:visible',
                                                            size: 'icon-sm',
                                                        })}
                                                        onClick={() => onSelectFilter(f.value.fid)}
                                                    >
                                                        <FunnelIcon className="w-4 inline-block" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                        {!props.hideProfiling && (
                            <tr className="divide-x divide-border border-b">
                                {metas.map((field) => (
                                    <th key={field.fid} className={getHeaderType(field) + ' whitespace-nowrap py-2 px-3 text-xs text-muted-foreground'}>
                                        <FieldProfiling
                                            field={field.fid}
                                            semanticType={field.semanticType}
                                            computation={filteredComputation}
                                            displayOffset={displayOffset}
                                            offset={field.offset}
                                        />
                                    </th>
                                ))}
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-border bg-background font-mono">
                        {rows.map((row, index) => (
                            <tr className="divide-x divide-border" key={index}>
                                {metas.map((field) => {
                                    const value = fieldValue({ field, item: row, displayOffset });
                                    return (
                                        <td
                                            key={field.fid + index}
                                            className={getHeaderType(field) + ' whitespace-nowrap py-2 px-4 text-xs text-muted-foreground max-w-[240px]'}
                                        >
                                            <TruncateDector value={value} />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {loading && <LoadingLayer />}
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
        </Container>
    );
});

export default DataTable;

const FilterPill = (props: { name: string; onRemove?: () => void; onClick?: () => void }) => {
    return (
        <Badge onClick={props.onClick} className="gap-x-0.5">
            {props.name}
            <Button
                onClick={(e) => {
                    e.stopPropagation();
                    props.onRemove?.();
                }}
                variant="ghost"
                size="none"
                className="relative -mr-1 h-3.5 w-3.5 rounded-sm"
            >
                <span className="sr-only">Remove</span>
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 stroke-current">
                    <path d="M4 4l6 6m0-6l-6 6" />
                </svg>
                <span className="absolute -inset-1"></span>
            </Button>
        </Badge>
    );
};
