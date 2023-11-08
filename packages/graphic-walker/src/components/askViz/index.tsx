import { observer } from 'mobx-react-lite';
import React, { useCallback, useState } from 'react';
import { useVizStore } from '../../store';
import { HandThumbDownIcon, HandThumbUpIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Spinner from '../spinner';
import { IAskVizFeedback, IChartForExport, IViewField, IVisSpecForExport } from '../../interfaces';
import { useTranslation } from 'react-i18next';

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
        data: IVisSpecForExport | IChartForExport;
        message?: string;
    } = await res.json();
    if (result.success) {
        return result.data;
    } else {
        throw new Error(result.message);
    }
}

async function reportVizQuery(api: string | ((data: IAskVizFeedback) => void), data: IAskVizFeedback, headers: Record<string, string>) {
    if (typeof api === 'function') {
        return api(data);
    }
    const res = await fetch(api, {
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) {
        return;
    } else {
        throw new Error(result.message);
    }
}

const AskViz: React.FC<{
    api?: string | ((metas: IViewField[], query: string) => PromiseLike<IVisSpecForExport | IChartForExport> | IVisSpecForExport | IChartForExport);
    feedbackApi?: string | ((data: IAskVizFeedback) => void);
    headers?: Record<string, string>;
}> = (props) => {
    const { feedbackApi } = props;

    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const vizStore = useVizStore();
    const { t } = useTranslation();
    const [askVizFeedback, setAskVizFeedback] = useState<'vote' | 'report' | 'none'>('none');

    const allFields = vizStore.allFields;

    const [lastData, setLastData] = useState<{ question: string; data: string } | null>(null);

    const startQuery = useCallback(() => {
        setLoading(true);
        const request =
            typeof props.api === 'function' ? Promise.resolve(props.api(allFields, query)) : vizQuery(props.api || api, allFields, query, props.headers ?? {});
        request
            .then((data) => {
                vizStore.appendFromCode(data);
                vizStore.setAskvizFeedback(true);
                setLastData({ question: query, data: JSON.stringify(data) });
                setAskVizFeedback('vote');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [props.api, props.headers, allFields, query, vizStore]);

    const showFeedback = feedbackApi && lastData && vizStore.showAskvizFeedbackIndex === vizStore.visIndex;

    return (
        <div className="right-0 flex relative">
            <input
                type="text"
                className="rounded-l-md px-4 block w-full border-0 py-1.5 text-gray-900 dark:text-gray-50 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-900"
                placeholder={t('main.tabpanel.askviz.placeholder')}
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
            {showFeedback && askVizFeedback === 'vote' && (
                <div className="absolute z-10 top-full right-0 flex-col space-y-2 w-56 mt-1 p-4 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-zinc-900 dark:text-white">
                    <div>{t('App.feedback.vote')}</div>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            className="inline-flex space-x-1 items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                                reportVizQuery(feedbackApi, { action: 'voteup', question: lastData.question, spec: lastData.data }, props.headers ?? {});
                                setAskVizFeedback('none');
                            }}
                        >
                            <HandThumbUpIcon className="w-4 h-4" />
                            {t('App.feedback.voteup')}
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center rounded border border-gray-300 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                            onClick={() => {
                                reportVizQuery(feedbackApi, { action: 'votedown', question: lastData.question, spec: lastData.data }, props.headers ?? {});
                                setAskVizFeedback('report');
                            }}
                        >
                            <HandThumbDownIcon className="w-4 h-4" />
                            {t('App.feedback.votedown')}
                        </button>
                    </div>
                </div>
            )}
            {showFeedback && askVizFeedback === 'report' && (
                <div className="absolute z-10 top-full right-0 flex-col space-y-2 w-56 mt-1 p-4 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-zinc-900 dark:text-white">
                    <div>{t('App.feedback.report')}</div>
                    <div>
                        <button
                            type="button"
                            className="inline-flex items-center rounded border border-gray-300 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                            disabled={!vizStore.canUndo}
                            onClick={() => {
                                reportVizQuery(
                                    feedbackApi,
                                    { action: 'report', question: lastData.question, spec: JSON.stringify(vizStore.exportCode()[vizStore.visIndex]) },
                                    props.headers ?? {}
                                );
                                setAskVizFeedback('none');
                            }}
                        >
                            {t('App.feedback.report_button')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default observer(AskViz);
