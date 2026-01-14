import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentMethodRequest, AgentVizEvent, IGWHandler, IChart } from '@kanaries/graphic-walker';
import { GraphicWalker, createChartFromFields } from '@kanaries/graphic-walker';
import { IDataSource, useFetch } from '../util';
import { useTheme } from '../context';

const DATASET_URL = 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-cars-service.json';

type PresenceProfile = {
    userId: string;
    displayName: string;
    color: string;
};

const PRESENCE_PROFILES: Record<'alpha' | 'beta', PresenceProfile> = {
    alpha: { userId: 'sync-alpha', displayName: 'Explorer Alpha', color: '#f97316' },
    beta: { userId: 'sync-beta', displayName: 'Explorer Beta', color: '#6366f1' },
};

const PRESENCE_TTL = 30_000;


export default function DualSyncDemo() {
    const { theme } = useTheme();
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const primaryRef = useRef<IGWHandler | null>(null);
    const secondaryRef = useRef<IGWHandler | null>(null);
    const [sharedCharts, setSharedCharts] = useState<IChart[] | null>(null);
    const sharedVisSeed = useMemo(() => `dual-sync-chart-${Math.random().toString(36).slice(2, 8)}`, []);
    const initializedRef = useRef(false);
    const [status, setStatus] = useState('Waiting for both canvases to mount...');
    const [lastAction, setLastAction] = useState('No mirrored action yet');
    const [lastCursor, setLastCursor] = useState('No remote cursor yet');

    useEffect(() => {
        if (initializedRef.current) return;
        if (!fields?.length) return;
        const baseChart = createChartFromFields(fields, { name: 'Shared Chart 1', visId: sharedVisSeed });
        const payload = [baseChart];
        setSharedCharts(payload);
        initializedRef.current = true;
    }, [fields, sharedVisSeed]);

    useEffect(() => {
        let disposed = false;
        let raf: number | null = null;
        let bound = false;
        const disposers: Array<() => void> = [];

        const bindPair = (source: IGWHandler, target: IGWHandler, profile: PresenceProfile, originLabel: string) => {
            let expiryTimer: number | null = null;

            const resetPresenceExpiry = () => {
                if (expiryTimer !== null) {
                    window.clearTimeout(expiryTimer);
                }
                expiryTimer = window.setTimeout(() => {
                    target.clearPresence(profile.userId);
                    expiryTimer = null;
                    setLastCursor('No remote cursor yet');
                }, PRESENCE_TTL);
            };
            const describeVizEvent = (event: AgentVizEvent) => {
                switch (event.action) {
                    case 'add':
                        return 'created a new chart';
                    case 'duplicate':
                        return 'duplicated a chart';
                    case 'remove':
                        return 'removed a chart';
                    case 'select':
                        return 'switched charts';
                    default:
                        return 'updated charts';
                }
            };

            const dispose = source.onAgentEvent((event) => {
                if (event.type === 'viz') {
                    target.applyVizEvent(event);
                    setLastAction(`${originLabel} ${describeVizEvent(event)}`);
                    return;
                }

                if (event.type === 'hover') {
                    if (event.action === 'enter') {
                        target.updatePresence({
                            userId: profile.userId,
                            displayName: profile.displayName,
                            color: profile.color,
                            targetId: event.targetId,
                        });
                        setLastCursor(`${originLabel} cursor on ${event.targetKind} (${event.targetId})`);
                    }
                    resetPresenceExpiry();
                    return;
                }

                if (event.type === 'method' && event.status === 'success' && event.source === 'ui') {
                    const request = {
                        method: event.method,
                        args: event.args as AgentMethodRequest['args'],
                        targetVisId: event.visId,
                    } as AgentMethodRequest;

                    void target
                        .dispatchMethod(request)
                        .then((result) => {
                            if (result.success) {
                                setLastAction(`${originLabel} ran ${event.method}`);
                            }
                        })
                        .catch((error) => {
                            console.warn('Failed to mirror method', error);
                        });
                }
            });

            return () => {
                if (expiryTimer !== null) {
                    window.clearTimeout(expiryTimer);
                    expiryTimer = null;
                }
                dispose();
            };
        };

        const ensureHandlers = () => {
            if (disposed || bound) return;
            const left = primaryRef.current;
            const right = secondaryRef.current;

            if (left && right) {
                bound = true;
                disposers.push(bindPair(left, right, PRESENCE_PROFILES.alpha, 'Workspace A'));
                disposers.push(bindPair(right, left, PRESENCE_PROFILES.beta, 'Workspace B'));
                setStatus('Live sync active. Hover or edit either panel to mirror it in the other.');
                return;
            }

            raf = requestAnimationFrame(ensureHandlers);
        };

        ensureHandlers();

        return () => {
            disposed = true;
            disposers.forEach((dispose) => dispose?.());
            if (raf !== null) {
                cancelAnimationFrame(raf);
            }
            primaryRef.current?.clearPresence();
            secondaryRef.current?.clearPresence();
        };
    }, []);

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dual GraphicWalker sync</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    This demo mounts two GraphicWalker instances that share hover presence highlights and mirror VisSpec method calls. Drag fields, toggle
                    marks, or apply filters in either panel to see the other side update automatically.
                </p>
                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 bg-white/60 p-3 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-100">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Sync status</div>
                        <div className="mt-1 font-semibold">{status}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white/60 p-3 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-100">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Last mirrored action</div>
                        <div className="mt-1 font-semibold">{lastAction}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white/60 p-3 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-100">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Remote cursor</div>
                        <div className="mt-1 font-semibold">{lastCursor}</div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-xl border border-gray-200 bg-white/70 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                    <header className="flex items-center justify-between">
                        <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Workspace A</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Acts as Explorer Alpha (orange cursor)</p>
                        </div>
                    </header>
                    <div className="mt-3 h-[60vh] min-h-[360px] rounded-lg border border-dashed border-gray-300 bg-white/60 p-2 dark:border-gray-700 dark:bg-gray-900/60">
                        <GraphicWalker
                            ref={primaryRef}
                            data={dataSource}
                            fields={fields}
                            chart={sharedCharts ?? undefined}
                            appearance={theme}
                            vizThemeConfig="g2"
                        />
                    </div>
                </article>

                <article className="rounded-xl border border-gray-200 bg-white/70 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                    <header className="flex items-center justify-between">
                        <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Workspace B</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Acts as Explorer Beta (indigo cursor)</p>
                        </div>
                    </header>
                    <div className="mt-3 h-[60vh] min-h-[360px] rounded-lg border border-dashed border-gray-300 bg-white/60 p-2 dark:border-gray-700 dark:bg-gray-900/60">
                        <GraphicWalker
                            ref={secondaryRef}
                            data={dataSource}
                            fields={fields}
                            chart={sharedCharts ?? undefined}
                            appearance={theme}
                            vizThemeConfig="g2"
                        />
                    </div>
                </article>
            </section>
        </div>
    );
}
