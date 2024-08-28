import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Pagination as PaginationRoot,
    PaginationEllipsis,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
    PaginationContent,
    PaginationLink,
} from '../ui/pagination';

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

    const pageButton = (index: number) => {
        return (
            <PaginationItem key={index}>
                <PaginationLink
                    size="default"
                    className='px-3 min-w-[2.25rem]'
                    isActive={index === pageIndex}
                    onClick={() => {
                        onPageChange && onPageChange(index);
                    }}
                >
                    {index + 1}
                </PaginationLink>
            </PaginationItem>
        );
    };

    return showIndices.length > 0 ? (
        <PaginationRoot>
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        onClick={() => {
                            onPrev();
                        }}
                    >
                        {t('actions.prev')}
                    </PaginationPrevious>
                </PaginationItem>
                {showIndices.map((x) => {
                    if (x.type === 'placeholder') {
                        return (
                            <PaginationItem key={x.index}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        );
                    }
                    return pageButton(x.index);
                })}
                <PaginationItem>
                    <PaginationNext
                        onClick={() => {
                            onNext();
                        }}
                    >
                        {t('actions.next')}
                    </PaginationNext>
                </PaginationItem>
            </PaginationContent>
        </PaginationRoot>
    ) : null;
}
