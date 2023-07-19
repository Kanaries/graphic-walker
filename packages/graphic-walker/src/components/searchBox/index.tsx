import React, { useEffect, useRef, useState } from 'react';
import produce from 'immer';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useGlobalStore } from '../../store';
import type { IDataSet, IDataSource, IGWSearchFunction, IVisSpec } from '../../interfaces';
import { useAppRootContext } from '../appRoot';
import Message, { IMessageHandle } from './message';


const onSearch: IGWSearchFunction = async (query, chart, context, rawStores) => {
    if (!query.trim()) {
        return;
    }
    const currentId = chart.visId;
    const url = '';
    const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            dataSchema: chart.fields.map(f => ({
                fid: f.fid,
                name: f.name || f.fid,
                analyticType: f.analyticType,
                semanticType: f.semanticType,
            })),
            inputText: query,
        }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const result = await res.json() as (
        | { success: true; data: { dslJson: Omit<IVisSpec, 'name'> } }
        | { success: false; message: string }
    );
    const curChart = rawStores.vizStore.visList[rawStores.vizStore.visIndex];
    if (curChart.visId !== currentId) {
        return;
    }
    if (result.success === false) {
        throw new Error(result.message);
    }
    const state = JSON.parse(rawStores.vizStore.exportAsRaw()) as {
        datasets: IDataSet[];
        dataSources: IDataSource[];
        specList: IVisSpec[];
    };
    const nextState = produce(state, draft => {
        const spec = draft.specList.find(s => s.visId === currentId);
        if (!spec) {
            return;
        }
        // @ts-expect-error - the field is readonly
        spec.config = result.data.dslJson.config;
        // @ts-expect-error - the field is readonly
        spec.encodings = result.data.dslJson.encodings;
    });
    rawStores.vizStore.importRaw(JSON.stringify(nextState));
};

const SearchBox = observer (function SearchBox () {
    const rawStores = useGlobalStore();
    const { vizStore } = rawStores;
    const { visList, visIndex, allFields } = vizStore;
    const chart = visList[visIndex];
    const { t } = useTranslation('translation', { keyPrefix: 'search' });

    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);

    const queriesRef = useRef(new Map<string, string>());

    const currId = chart?.visId;

    const messageRef = useRef<IMessageHandle>(null);

    useEffect(() => {
        if (!currId) {
            return;
        }
        const prevQuery = queriesRef.current.get(currId);
        setQuery(prevQuery ?? '');
        messageRef.current?.clear();
        return () => {
            const next = rawStores.vizStore.visList.find(which => which.visId === currId);
            if (!next) {
                queriesRef.current.delete(currId);
            }
        };
    }, [currId]);

    useEffect(() => {
        if (!currId) {
            return;
        }
        queriesRef.current.set(currId, query);
    }, [query]);

    const context = useAppRootContext();

    const search = async () => {
        if (busy || !context.current || !chart) {
            return;
        }
        messageRef.current?.clear();
        setBusy(true);
        const visId = chart.visId;
        const input = query;
        try {
            await onSearch(input, {
                visId,
                name: chart.name,
                config: chart.config,
                encodings: chart.encodings,
                fields: allFields,
            }, context.current, rawStores);
        } catch (error) {
            console.error('Failed to search', {error});
            if (error instanceof Error) {
                if (error.name === 'TypeError') {
                    messageRef.current?.show(t('error.network'));
                } else {
                    messageRef.current?.show(t('error.unknown'));
                }
            } else {
                messageRef.current?.show(t('error.unknown'));
            }
        } finally {
            setTimeout(() => {
                setBusy(false);
            }, 200);
        }
    };

    return (
        <div style={{ margin: '0.38em 0.11em 0.2em' }}>
            <form
                name={t('label')}
                className="rounded overflow-hidden flex leading-10 h-10 sm:text-sm sm:leading-8 sm:h-8"
                onSubmit={e => {
                    e.preventDefault();
                    search();
                }}
            >
                <input
                    type="text"
                    className="flex-1 h-full truncate border border-r-0 border-gray-200 dark:border-gray-700 rounded-l block w-full py-1 px-2 ring-0 hover:ring-1 focus:ring-1 ring-inset ring-gray-300/25 dark:ring-gray-600/25 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-indigo-600/50 dark:focus:ring-indigo-300/50"
                    placeholder={t('placeholder')}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                <Message ref={messageRef} />
                <button
                    type="submit"
                    name="search"
                    className={
                        `group flex-none whitespace-nowrap h-full flex items-center justify-center border-0 rounded-r overflow-hidden bg-gradient-to-r from-indigo-600 to-pink-400 px-3 space-x-2 text-gray-200 hover:text-white disabled:!text-gray-200 focus:ring-2 ring-inset ring-purple-600 disabled:!ring-0 disabled:saturate-50 disabled:contrast-75 disabled:brightness-150 ${busy ? 'animate-pulse' : ''}`
                    }
                    disabled={busy || !chart}
                    onClick={search}
                >
                    <span className="capitalize px-1">{t('action')}</span>
                    {!busy && <PaperAirplaneIcon className={`w-4 h-4 ${!chart ? '' : 'group-hover:animate-pulse'}`} aria-hidden />}
                    {busy && (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="currentColor" />
                                    <stop offset="100%" stopColor="transparent" />
                                </linearGradient>
                            </defs>
                            <circle className="opacity-25" cx={12} cy={12} r={10} stroke="currentColor" fill="none" strokeWidth={4} />
                            <path
                                className="opacity-75"
                                fill="url(#gradient)"
                                fillRule="evenodd"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                    )}
                </button>
            </form>
        </div>
    );
});

export default SearchBox;
