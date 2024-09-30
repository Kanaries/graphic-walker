import { DraggableFieldState, IAssistantChatMessage, IChannelScales, IChatMessage, IUserChatMessage, IViewField } from '@/interfaces';
import { useCompututaion, useVizStore } from '@/store';
import { observer } from 'mobx-react-lite';
import React, { useMemo, useState, useContext } from 'react';
import { Card, CardContent, CardTitle } from '../ui/card';
import { CpuChipIcon, TrashIcon, UserIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';
import SpecRenderer from '@/renderer/specRenderer';
import { vegaThemeContext } from '@/store/theme';
import { useRenderer } from '@/renderer/hooks';
import { getSort, parseErrorMessage } from '@/utils';
import { useReporter } from '@/utils/reportError';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Textarea } from '../ui/textarea';
import LoadingLayer from '../loadingLayer';

async function fetchQueryChat(api: string, metas: IViewField[], messages: IChatMessage[], headers: Record<string, string>) {
    const res = await fetch(api, {
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({
            metas,
            messages,
        }),
    });
    const result: {
        success: boolean;
        data: any;
        message?: string;
    } = await res.json();
    if (result.success) {
        return result.data;
    } else {
        throw new Error(result.message);
    }
}

async function queryChat(
    api: string | ((metas: IViewField[], chats: IChatMessage[]) => PromiseLike<any> | any),
    data: {
        metas: IViewField[];
        chats: IChatMessage[];
        query: string;
    },
    headers: Record<string, string>
) {
    const chats = data.chats.concat({
        role: 'user',
        content: data.query,
        type: 'normal',
    });
    if (typeof api === 'string') {
        return fetchQueryChat(api, data.metas, chats, headers);
    }
    return api(data.metas, chats);
}

function UserMessage(props: { message: IUserChatMessage; onRemove?: () => void }) {
    const collapasable = props.message.type === 'generated';
    return (
        <Card>
            <div className="p-6 pb-2 flex space-x-2 items-center">
                <div className="p-1 w-6 h-6 rounded-full bg-muted">
                    <UserIcon className="w-4 h-4" />
                </div>
                <CardTitle className="flex-1">You</CardTitle>
                {props.onRemove && (
                    <Button variant="ghost" size="icon-sm" onClick={props.onRemove}>
                        <TrashIcon className="w-4 h-4" />
                    </Button>
                )}
            </div>
            <CardContent className="pl-14">
                {collapasable && (
                    <Collapsible>
                        <CollapsibleTrigger className="text-muted-foreground">Click to expand auto generated message</CollapsibleTrigger>
                        <CollapsibleContent className="whitespace-pre">{props.message.content}</CollapsibleContent>
                    </Collapsible>
                )}
                {!collapasable && props.message.content}
            </CardContent>
        </Card>
    );
}

const AssistantMessage = observer(function AssistantMessage(props: { message: IAssistantChatMessage; onRemove?: () => void; scales?: IChannelScales }) {
    const computation = useCompututaion();
    const { config, encodings, layout, name } = props.message.chart;
    const { vizThemeConfig } = useContext(vegaThemeContext);

    const sort = getSort(encodings);

    const { allFields, viewDimensions, viewMeasures, filters } = useMemo(() => {
        const viewDimensions: IViewField[] = [];
        const viewMeasures: IViewField[] = [];

        const { dimensions, measures, filters, ...state } = encodings;
        const allFields = [...dimensions, ...measures];

        const dKeys = Object.keys(state) as (keyof DraggableFieldState)[];
        for (const dKey of dKeys) {
            for (const f of state[dKey]) {
                if (f.analyticType === 'dimension') {
                    viewDimensions.push(f);
                } else if (f.analyticType === 'measure') {
                    viewMeasures.push(f);
                }
            }
        }

        return { allFields, viewDimensions, viewMeasures, filters };
    }, [encodings]);

    const { viewData: data, loading: waiting } = useRenderer({
        allFields,
        viewDimensions,
        viewMeasures,
        filters,
        defaultAggregated: config.defaultAggregated,
        sort,
        folds: config.folds,
        limit: config.limit ?? -1,
        computationFunction: computation,
        timezoneDisplayOffset: config['timezoneDisplayOffset'],
    });
    const { i18n } = useTranslation();

    return (
        <Card>
            <div className="p-6 pb-2 flex space-x-2 items-center">
                <div className="p-1 w-6 h-6 rounded-full bg-muted">
                    <CpuChipIcon className="w-4 h-4" />
                </div>
                <CardTitle className="flex-1">Viz.GPT</CardTitle>
                {props.onRemove && (
                    <Button variant="ghost" size="icon-sm" onClick={props.onRemove}>
                        <TrashIcon className="w-4 h-4" />
                    </Button>
                )}
            </div>
            <CardContent className="pl-16">
                {waiting && <LoadingLayer />}
                <SpecRenderer
                    vizThemeConfig={vizThemeConfig}
                    name={name}
                    data={data}
                    draggableFieldState={encodings}
                    visualConfig={config}
                    layout={{
                        ...layout,
                        size: {
                            mode: 'auto',
                            width: 300,
                            height: 200,
                        },
                    }}
                    locale={i18n.language}
                    scales={props.scales}
                />
            </CardContent>
        </Card>
    );
});

const api = 'https://api.kanaries.net/vis/chat2gw';

export const VegaliteChat = observer(function VegaliteChat(props: {
    api: string | ((metas: IViewField[], chats: IChatMessage[]) => PromiseLike<any> | any);
    headers?: Record<string, string>;
    scales?: IChannelScales;
}) {
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const vizStore = useVizStore();
    const { chatMessages, allFields } = vizStore;
    const { reportError } = useReporter();

    const submit = async () => {
        setLoading(true);
        queryChat(props.api || api, { chats: chatMessages, metas: allFields, query }, props.headers ?? {})
            .then((res) => {
                vizStore.replaceWithNLPQuery(query, JSON.stringify(res));
                setQuery('');
            })
            .catch((err) => {
                reportError(parseErrorMessage(err), 502);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div className="flex flex-col gap-4 p-4 pb-12">
            {chatMessages.map((m, i, arr) => {
                if (m.role === 'assistant') {
                    return (
                        <AssistantMessage
                            message={m}
                            scales={props.scales}
                            key={i}
                            onRemove={i === arr.length - 1 && m.type === 'normal' ? () => vizStore.undo() : undefined}
                        />
                    );
                }
                if (m.role === 'user') {
                    return <UserMessage message={m} key={i} onRemove={i === arr.length - 2 && m.type == 'normal' ? () => vizStore.undo() : undefined} />;
                }
            })}
            <div className="flex gap-4">
                <Textarea
                    className="resize-none min-h-[36px]"
                    disabled={loading}
                    rows={1}
                    value={query}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey && loading === false && query.length > 0) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    placeholder="Ask question about your data"
                    onChange={(e) => setQuery(e.target.value)}
                />
                <Button disabled={loading} onClick={submit}>
                    {loading && <ArrowPathIcon className="w-3 h-3 mr-2 animate-spin" />}Submit
                </Button>
            </div>
        </div>
    );
});
