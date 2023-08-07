import { observer } from 'mobx-react-lite';
import React, { useCallback, useState } from 'react';
import { useGlobalStore } from '../../store';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { IViewField } from '../../interfaces';
import { VisSpecWithHistory } from '../../models/visSpecHistory';

type VEGALite = any;

// const api = 'https://enhanceai.kanaries.net/api/vis/text2gw'
// const api = 'http://127.0.0.1:8000/text2gw'
const api = 'https://kanaries.net/app/gpt-gw/text2gw'

function Spinner() {
    return (
        <svg className="animate-spin ml-2 mr-2 h-5 w-5 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>
    );
}

function decodeSpec(value: string): any {
    const list = JSON.parse(value);
    const result = [];
    for (const vis of list) {
        const res = { ...vis };
        const filters = [] as typeof res.encodings.filters[number][];
        for (const filter of vis.encodings.filters) {
            if (filter.rule?.type === 'one of') {
                filters.push({
                    ...filter,
                    rule: {
                        ...filter.rule,
                        // @ts-ignore
                        value: new Set(filter.rule.value),
                    },
                });
            } else {
                filters.push(filter);
            }
        }
        res.encodings = {
            ...res.encodings,
            filters,
        };
        result.push(res);
    }
    return result;
}

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

const AskViz: React.FC<{api?: string; headers?: Record<string, string>}> = (props) => {
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const { vizStore } = useGlobalStore();

    const allFields = vizStore.allFields;

    const startQuery = useCallback(() => {
        setLoading(true);
        vizQuery(props.api ?? api, allFields, query, props.headers ?? {})
            .then((data) => {
                const decodedData = decodeSpec(JSON.stringify([data]))[0];
                vizStore.visList.push(new VisSpecWithHistory(decodedData));
                vizStore.selectVisualization(vizStore.visList.length - 1);
                // const liteGW = parseGW(spec);
                // vizStore.renderSpec(liteGW);
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
                placeholder="What visualization your want to draw from the dataset"
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
