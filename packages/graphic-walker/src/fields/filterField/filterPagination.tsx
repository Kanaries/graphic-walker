import React from 'react';
import { useTranslation } from 'react-i18next';
interface PaginationProps {
    from: number;
    to: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
}
export default function Pagination(props: PaginationProps) {
    const { from , to, total, onNext, onPrev } = props;
    const { t } = useTranslation();
    return (
        <nav
            className="sticky inset-x-0	flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900"
            aria-label="Pagination"
        >
            <label className="hidden sm:block">
                <p className="text-xs text-gray-800 dark:text-gray-100">
                    Showing <span className="font-medium">{from}</span> to <span className="font-medium">{to}</span> of{" "}
                    <span className="font-medium">{total}</span> results
                </p>
            </label>
            <div className="flex flex-1 justify-between sm:justify-end">
                <button
                    onClick={() => {
                        onPrev();
                    }}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white dark:bg-zinc-900 px-2.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    {t('actions.prev')}
                </button>
                <button
                    onClick={() => {
                        onNext()
                    }}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white dark:bg-zinc-900  px-2.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    {t('actions.next')}
                </button>
            </div>
        </nav>
    );
}
