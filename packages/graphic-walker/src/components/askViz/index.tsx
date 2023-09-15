import { observer } from 'mobx-react-lite';
import React, { useCallback, useState } from 'react';
import { useVizStore } from '../../store';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Spinner from '../spinner';
import { IViewField } from '../../interfaces';
import { useTranslation } from 'react-i18next';

type VEGALite = any;

const api = import.meta.env.DEV ? 'http://localhost:2023/api/vis/text2gw' : 'https://enhanceai.kanaries.net/api/vis/text2gw';

async function vizQuery(api: string, metas: IViewField[], query: string, headers: Record<string, string>) {
    const res = await fetch(api, {
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({
            metas,
            messages: [
                {
                    role: 'user',
                    content: query,
                },
            ],
        }),
    });
    const result: {
        success: boolean;
        data: VEGALite;
        message?: string;
    } = await res.json();
    if (result.success) {
        return result.data;
    } else {
        throw new Error(result.message);
    }
}

const AskViz: React.FC<{ api?: string; headers?: Record<string, string> }> = (props) => {
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const vizStore = useVizStore();
    const {t} = useTranslation();

    const allFields = vizStore.allFields;

    const startQuery = useCallback(() => {
        setLoading(true);
        vizQuery(props.api ?? api, allFields, query, props.headers ?? {})
            .then((data) => {
                vizStore.appendFromOld(data);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [query, allFields]);
    return (
        <div className="right-0 flex">
            <input
                type="text"
                className="rounded-l-md px-4 block w-full border-0 py-1.5 text-gray-900 dark:text-gray-50 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-900"
                placeholder={t("main.tabpanel.askviz.placeholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && loading === false && query.length > 0) {
                        startQuery();
                    }
                }}
                disabled={loading || allFields.length === 0}
            />
            <button
                type="button"
                className="flex items-center grow-0 rounded-r-md bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || query.length === 0 || allFields.length === 0}
                onClick={startQuery}
            >
                Ask
                {!loading && <PaperAirplaneIcon className="w-4 ml-1" />}
                {loading && <Spinner />}
            </button>
        </div>
    );
};

export default observer(AskViz);
