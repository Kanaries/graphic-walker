import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import { cn } from '../../utils';

type IPageItem = {
    index: number;
    disabled?: boolean;
    type: 'page' | 'placeholder';
};
interface PaginationProps {
    total: number;
    onPrev: () => void;
    onNext: () => void;
    onPageChange?: (index: number) => void;
    pageIndex: number;
    pageSize?: number;
    extendPageNumber?: number;
}

export function getShowIndices(total: number, pageIndex: number, pageSize: number, extendPageNumber: number) {
    const totalPage = Math.ceil(total / (pageSize || 1));
    const pages = [
        {
            index: 0,
            disabled: false,
            type: 'page',
        },
        ...(new Array(1 + extendPageNumber * 2).fill(0).map((p, i) => ({
            index: pageIndex - (extendPageNumber - i),
            disabled: false,
            type: 'page',
        })) as IPageItem[]),
        {
            index: totalPage - 1,
            disabled: false,
            type: 'page',
        },
    ].filter((p) => p.index >= 0 && p.index < totalPage) as IPageItem[];

    const pagesUnique: IPageItem[] = [];
    const indexSet: Set<number> = new Set();
    for (let p of pages) {
        if (!indexSet.has(p.index)) {
            pagesUnique.push(p);
            indexSet.add(p.index);
        }
    }
    const pageResult: IPageItem[] = pagesUnique.reduce<IPageItem[]>((acc, p) => {
        if (acc.length === 0) {
            return [p];
        }
        const last = acc[acc.length - 1];
        if (p.index === last.index + 1) {
            return [...acc, p];
        }
        return [...acc, { index: -1, type: 'placeholder' }, p];
    }, []);
    return pageResult;
}

export default function Pagination(props: PaginationProps) {
    const { total, onNext, onPrev, pageIndex, onPageChange, pageSize = 100, extendPageNumber = 1 } = props;
    const { t } = useTranslation();
    const showIndices: IPageItem[] = useMemo<IPageItem[]>(
        () => getShowIndices(total, pageIndex, pageSize, extendPageNumber),
        [pageIndex, pageSize, extendPageNumber, total, pageIndex]
    );
    const pageCount = Math.ceil(total / (pageSize || 1));

    if (showIndices.length === 0) {
        return null;
    }

    const buttonClassName =
        'inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[13px] tabular-nums text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30';

    return (
        <nav aria-label="pagination" className="flex items-center gap-0.5">
            <button
                type="button"
                className={buttonClassName}
                aria-label={t('actions.prev')}
                title={t('actions.prev')}
                disabled={pageIndex <= 0}
                onClick={onPrev}
            >
                <ChevronLeftIcon className="h-4 w-4" />
            </button>
            {showIndices.map((x, i) => {
                if (x.type === 'placeholder') {
                    return (
                        <span key={`gap-${i}`} aria-hidden className="w-6 text-center text-muted-foreground">
                            …
                        </span>
                    );
                }
                const active = x.index === pageIndex;
                return (
                    <button
                        key={x.index}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            buttonClassName,
                            active && 'bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                        )}
                        onClick={() => {
                            onPageChange && onPageChange(x.index);
                        }}
                    >
                        {x.index + 1}
                    </button>
                );
            })}
            <button
                type="button"
                className={buttonClassName}
                aria-label={t('actions.next')}
                title={t('actions.next')}
                disabled={pageIndex >= pageCount - 1}
                onClick={onNext}
            >
                <ChevronRightIcon className="h-4 w-4" />
            </button>
        </nav>
    );
}
