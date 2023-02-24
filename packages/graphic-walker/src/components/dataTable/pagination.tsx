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
            className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
            aria-label="Pagination"
        >
            <div className="hidden sm:block">
                <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{from}</span> to <span className="font-medium">{to}</span> of{" "}
                    <span className="font-medium">{total}</span> results
                </p>
            </div>
            <div className="flex flex-1 justify-between sm:justify-end">
                <button
                    onClick={() => {
                        onPrev();
                    }}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    {t('actions.prev')}
                </button>
                <button
                    onClick={() => {
                        onNext()
                    }}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    {t('actions.next')}
                </button>
            </div>
        </nav>
    );
}
