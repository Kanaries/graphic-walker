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
            <PaginationItem key={index}>
                <PaginationLink
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
                {pageButton(showIndices[0].index)}
                {showIndices.length > 2 && showIndices[1].index > showIndices[0].index + 1 && (
                    <PaginationItem>
                        <PaginationEllipsis />
                    </PaginationItem>
                )}
                {showIndices.slice(1, showIndices.length > 2 ? -1 : undefined).map((page) => pageButton(page.index))}
                {showIndices.length > 2 && showIndices[showIndices.length - 1].index > showIndices[showIndices.length - 2].index + 1 && (
                    <PaginationItem>
                        <PaginationEllipsis />
                    </PaginationItem>
                )}
                {showIndices.length > 2 && pageButton(showIndices[showIndices.length - 1].index)}
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
