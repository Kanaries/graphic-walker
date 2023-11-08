import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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
function btnStylePrefix(...className: string[]) {
    return `rounded-md px-2.5 py-1.5 text-xs font-medium ${className?.join(' ')}`;
}

const defaultColor = 'ring-1 ring-inset ring-gray-300 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800';

export default function Pagination(props: PaginationProps) {
    const { total, onNext, onPrev, pageIndex, onPageChange, pageSize = 100, extendPageNumber = 1 } = props;
    const { t } = useTranslation();
    const showIndices: IPageItem[] = useMemo<IPageItem[]>(() => {
        const totalPage = Math.ceil(total / (pageSize ?? 1));
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
        return pagesUnique;
    }, [pageIndex, pageSize, extendPageNumber, total, pageIndex]);

    const pageButton = (index: number) => {
        return (
            <button
                key={index}
                className={btnStylePrefix('inline-block', index === pageIndex ? 'bg-indigo-600 text-white' : defaultColor)}
                onClick={() => {
                    onPageChange && onPageChange(index);
                }}
            >
                {index + 1}
            </button>
        );
    };

    return showIndices.length > 0 ? (
        <div className="flex flex-1 justify-between sm:justify-end gap-2">
            <button
                onClick={() => {
                    onPrev();
                }}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
                {t('actions.prev')}
            </button>
            {pageButton(showIndices[0].index)}
            {showIndices.length > 2 && showIndices[1].index > showIndices[0].index + 1 && (
                <div className={btnStylePrefix('inline-block', defaultColor)} aria-hidden>
                    ...
                </div>
            )}
            {showIndices.slice(1, -1).map((page) => pageButton(page.index))}
            {showIndices.length > 2 && showIndices[showIndices.length - 1].index > showIndices[showIndices.length - 2].index + 1 && (
                <div className={btnStylePrefix('inline-block', defaultColor)} aria-hidden>
                    ...
                </div>
            )}
            {showIndices.length > 2 && pageButton(showIndices[showIndices.length - 1].index)}
            <button
                onClick={() => {
                    onNext();
                }}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white dark:bg-zinc-900  px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
                {t('actions.next')}
            </button>
        </div>
    ) : null;
}
