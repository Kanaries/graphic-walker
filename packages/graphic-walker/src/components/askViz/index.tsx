import { observer } from 'mobx-react-lite';
import React, { useCallback, useState } from 'react';
import { useVizStore } from '../../store';
import { HandThumbDownIcon, HandThumbUpIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Spinner from '../spinner';
import { IAskVizFeedback, IChart, IViewField, IVisSpec } from '../../interfaces';
import { useTranslation } from 'react-i18next';
import { useReporter } from '../../utils/reportError';
import { parseErrorMessage } from '../../utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const api = import.meta.env.DEV ? 'http://localhost:2023/api/vis/text2gw' : 'https://api.kanaries.net/vis/text2gw';

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
        data: IVisSpec | IChart;
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
    api?: string | ((metas: IViewField[], query: string) => PromiseLike<IVisSpec | IChart> | IVisSpec | IChart);
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

    const { reportError } = useReporter();

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
            .catch((err) => {
                reportError(parseErrorMessage(err), 502);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [props.api, props.headers, allFields, query, vizStore]);

    const showFeedback = feedbackApi && lastData && vizStore.showAskvizFeedbackIndex === vizStore.visIndex;

    return (
        <div className="right-0 flex relative">
            <Input
                type="text"
                className="pr-24"
                placeholder={t('main.tabpanel.askviz.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && loading === false && query.length > 0) {
                        startQuery();
                    }
                }}
                disabled={loading || allFields.length === 0}
            />
            <Button
                className="rounded-l-none w-20 absolute inset-y-0 right-0"
                disabled={loading || query.length === 0 || allFields.length === 0}
                onClick={startQuery}
                id="askviz_ask"
            >
                Ask
                {!loading && <PaperAirplaneIcon className="w-4 ml-1" />}
                {loading && <Spinner className="w-4 h-4 ml-1" />}
            </Button>
            {showFeedback && askVizFeedback === 'vote' && (
                <div className="absolute z-10 top-full right-0 flex-col space-y-2 w-56 mt-1 p-4 border rounded bg-popover text-popover-foreground">
                    <div>{t('App.feedback.vote')}</div>
                    <div className="flex space-x-2">
                        <Button
                            type="button"
                            onClick={() => {
                                reportVizQuery(feedbackApi, { action: 'voteup', question: lastData.question, spec: lastData.data }, props.headers ?? {});
                                setAskVizFeedback('none');
                            }}
                        >
                            <HandThumbUpIcon className="w-4 h-4" />
                            {t('App.feedback.voteup')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                reportVizQuery(feedbackApi, { action: 'votedown', question: lastData.question, spec: lastData.data }, props.headers ?? {});
                                setAskVizFeedback('report');
                            }}
                        >
                            <HandThumbDownIcon className="w-4 h-4" />
                            {t('App.feedback.votedown')}
                        </Button>
                    </div>
                </div>
            )}
            {showFeedback && askVizFeedback === 'report' && (
                <div className="absolute z-10 top-full right-0 flex-col space-y-2 w-56 mt-1 p-4 border rounded bg-popover text-popover-foreground">
                    <div>{t('App.feedback.report')}</div>
                    <div>
                        <Button
                            type="button"
                            variant="outline"
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
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default observer(AskViz);
