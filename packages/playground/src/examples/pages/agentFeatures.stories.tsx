import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentEvent, IGWAgentState, IGWAgentTargetSummary, IGWHandler } from '@kanaries/graphic-walker';
import { GraphicWalker } from '@kanaries/graphic-walker';
import { IDataSource, useFetch } from '../util';
import { useTheme } from '../context';

const DATASET_URL = 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-cars-service.json';
const EVENT_LOG_LIMIT = 12;

type PresenceDraft = {
    displayName: string;
    color: string;
    targetId: string;
};

const formatEventLabel = (event: AgentEvent, lookup: Map<string, IGWAgentTargetSummary>) => {
    if (event.type === 'hover') {
        const label = lookup.get(event.targetId)?.label ?? event.targetId;
        return `${event.action === 'enter' ? 'Entered' : 'Left'} ${label} (${event.targetKind})`;
    }
    const prefix = event.status === 'success' ? '✓' : '⚠️';
    return `${prefix} ${event.method} via ${event.source}${event.status === 'error' ? ` · ${event.error?.message ?? 'Unknown error'}` : ''}`;
};

export default function AgentFeatureDemo() {
    const { theme } = useTheme();
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const gwRef = useRef<IGWHandler | null>(null);
    const [agentState, setAgentState] = useState<IGWAgentState | null>(null);
    const [eventLog, setEventLog] = useState<AgentEvent[]>([]);
    const [statusMessage, setStatusMessage] = useState('Waiting for agent snapshot…');
    const [presenceDraft, setPresenceDraft] = useState<PresenceDraft>({
        displayName: 'Agent Tester',
        color: '#2563eb',
        targetId: '',
    });
    const [lastHoverId, setLastHoverId] = useState<string | null>(null);

    const targetList = agentState?.targets ?? [];
    const targetLookup = useMemo(() => {
        const entries: [string, IGWAgentTargetSummary][] = targetList.map((target) => [target.id, target]);
        return new Map(entries);
    }, [targetList]);
    const lastHoverLabel = lastHoverId ? targetLookup.get(lastHoverId)?.label ?? lastHoverId : '—';

    useEffect(() => {
        let dispose: (() => void) | undefined;
        let raf: number | null = null;
        let cancelled = false;

        const tryBindAgentBridge = () => {
            if (cancelled) return;
            const handler = gwRef.current;
            if (!handler) {
                raf = requestAnimationFrame(tryBindAgentBridge);
                return;
            }
            try {
                const snapshot = handler.getAgentState();
                setAgentState(snapshot);
                setStatusMessage(`Snapshot updated at ${new Date(snapshot.timestamp).toLocaleTimeString()}`);
            } catch (err) {
                raf = requestAnimationFrame(tryBindAgentBridge);
                return;
            }
            dispose = handler.onAgentEvent((event) => {
                setEventLog((prev) => [event, ...prev].slice(0, EVENT_LOG_LIMIT));
                if (event.type === 'hover') {
                    setLastHoverId(event.targetId);
                }
            });
            raf = null;
        };

        tryBindAgentBridge();

        return () => {
            cancelled = true;
            dispose?.();
            if (raf !== null) {
                cancelAnimationFrame(raf);
            }
        };
    }, []);

    useEffect(() => {
        if (!targetList.length) return;
        setPresenceDraft((prev) => {
            if (prev.targetId) return prev;
            return { ...prev, targetId: targetList[0].id };
        });
    }, [targetList]);

    const refreshSnapshot = () => {
        const handler = gwRef.current;
        if (!handler) {
            setStatusMessage('Graphic Walker is not ready yet.');
            return;
        }
        try {
            const snapshot = handler.getAgentState();
            setAgentState(snapshot);
            setStatusMessage(`Snapshot updated at ${new Date(snapshot.timestamp).toLocaleTimeString()}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown agent bridge error';
            setStatusMessage(`Snapshot failed: ${message}`);
        }
    };

    const dispatchTranspose = async () => {
        const handler = gwRef.current;
        if (!handler) {
            setStatusMessage('Graphic Walker is not ready yet.');
            return;
        }
        setStatusMessage('Dispatching transpose…');
        const result = await handler.dispatchMethod({ method: 'transpose', args: [] });
        if (result.success) {
            setAgentState(result.state);
            setStatusMessage('Transpose applied via dispatchMethod.');
        } else {
            setStatusMessage(`Method failed: ${result.error.message}`);
        }
    };

    const dispatchCloneField = async () => {
        const handler = gwRef.current;
        if (!handler) {
            setStatusMessage('Graphic Walker is not ready yet.');
            return;
        }

        const snapshot =
            agentState ??
            (() => {
                try {
                    const latest = handler.getAgentState();
                    setAgentState(latest);
                    return latest;
                } catch (error) {
                    return null;
                }
            })();

        if (!snapshot) {
            setStatusMessage('Agent state is unavailable.');
            return;
        }

        const { spec } = snapshot;
        const sourceFields = spec.encodings.dimensions;
        if (!sourceFields?.length) {
            setStatusMessage('Add a dimension before cloning.');
            return;
        }

        const sourceIndex = 0;
        const destinationFields = spec.encodings.rows ?? [];
        const destinationIndex = destinationFields.length;

        setStatusMessage('Dispatching cloneField…');
        const result = await handler.dispatchMethod({
            method: 'cloneField' as const,
            args: ['dimensions', sourceIndex, 'rows', destinationIndex, `agent_clone_${Date.now()}`, null],
        });
        if (result.success) {
            setAgentState(result.state);
            setStatusMessage('Field cloned into rows via dispatchMethod.');
        } else {
            setStatusMessage(`Method failed: ${result.error.message}`);
        }
    };

    const applyPresence = () => {
        const handler = gwRef.current;
        if (!handler) {
            setStatusMessage('Graphic Walker is not ready yet.');
            return;
        }
        if (!presenceDraft.targetId) {
            setStatusMessage('Select a valid target before highlighting.');
            return;
        }
        handler.updatePresence({
            userId: 'agent-demo-user',
            displayName: presenceDraft.displayName || 'Agent Tester',
            color: presenceDraft.color,
            targetId: presenceDraft.targetId,
        });
        setStatusMessage(`Presence broadcast to ${presenceDraft.displayName || 'Agent Tester'}.`);
    };

    const clearPresence = () => {
        gwRef.current?.clearPresence();
        setStatusMessage('Presence overlays cleared.');
    };

    const specSummary = agentState?.spec;

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent playground</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Move your pointer across dataset fields, encoding channels, or filter pills to see hover events in real-time. Use the buttons below to
                    snapshot the agent state, dispatch VisSpec methods, and test the new collaborative presence APIs.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        onClick={refreshSnapshot}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100"
                    >
                        Snapshot state
                    </button>
                    <button
                        onClick={dispatchTranspose}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-indigo-500"
                    >
                        Dispatch transpose()
                    </button>
                    <button onClick={dispatchCloneField} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-sky-500">
                        Dispatch cloneField()
                    </button>
                    <button
                        onClick={applyPresence}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-500"
                    >
                        Highlight target
                    </button>
                    <button
                        onClick={clearPresence}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100"
                    >
                        Clear presence
                    </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{statusMessage}</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Presence controls</h4>
                    <div className="mt-3 space-y-3">
                        <label className="flex flex-col text-sm text-gray-700 dark:text-gray-300">
                            Target
                            <select
                                value={presenceDraft.targetId}
                                onChange={(event) => setPresenceDraft((prev) => ({ ...prev, targetId: event.target.value }))}
                                className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            >
                                <option value="" disabled>
                                    {targetList.length ? 'Choose a target' : 'Run "Snapshot state" to load targets'}
                                </option>
                                {targetList.map((target) => (
                                    <option value={target.id} key={target.id}>
                                        {target.label} · {target.kind}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col text-sm text-gray-700 dark:text-gray-300">
                            Display name
                            <input
                                value={presenceDraft.displayName}
                                onChange={(event) => setPresenceDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                                className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            />
                        </label>
                        <label className="flex flex-col text-sm text-gray-700 dark:text-gray-300">
                            Accent color
                            <input
                                type="color"
                                value={presenceDraft.color}
                                onChange={(event) => setPresenceDraft((prev) => ({ ...prev, color: event.target.value }))}
                                className="mt-1 h-9 w-24 cursor-pointer rounded-md border border-gray-300 bg-white text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800"
                            />
                        </label>
                        <div className="rounded-md border border-dashed border-gray-300 p-3 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
                            Last hover: <span className="font-semibold text-gray-900 dark:text-gray-100">{lastHoverLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Agent event feed</h4>
                    <div className="mt-3 space-y-2">
                        {eventLog.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Interact with the canvas to populate the feed.</p>}
                        <ul className="max-h-64 space-y-1 overflow-auto rounded-lg bg-gray-950/5 p-2 text-xs font-mono text-gray-800 dark:bg-white/5 dark:text-gray-200">
                            {eventLog.map((event, index) => (
                                <li key={`${event.type}-${index}`} className="rounded px-2 py-1">
                                    {formatEventLabel(event, targetLookup)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Spec snapshot</h4>
                {specSummary ? (
                    <div className="mt-3 grid gap-4 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-3">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Vis ID</div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{specSummary.visId}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Dimensions</div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{specSummary.encodings.dimensions.length}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Measures</div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{specSummary.encodings.measures.length}</div>
                        </div>
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Take a snapshot to inspect the current visualization spec.</p>
                )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white/70 p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                <GraphicWalker ref={gwRef} data={dataSource} fields={fields} appearance={theme} vizThemeConfig="g2" />
            </section>
        </div>
    );
}
