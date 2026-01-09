import { useEffect, useRef, useState } from 'react';
import type { AgentMethodRequest, IGWAgentState, IGWAgentTargetSummary, IGWHandler } from '@kanaries/graphic-walker';
import { GraphicWalker } from '@kanaries/graphic-walker';
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

type TargetDirection = 'aToB' | 'bToA';

const fingerprintTarget = (target: IGWAgentTargetSummary) =>
    [
        target.kind,
        target.channel ?? '-',
        target.index ?? '-',
        target.fid ?? '-',
        target.actionKey ?? '-',
        target.role ?? '-',
        target.label,
    ].join('|');

const createTargetMap = (from: IGWAgentState, to: IGWAgentState) => {
    const toFingerprints = new Map<string, string>();
    to.targets.forEach((target) => {
        toFingerprints.set(fingerprintTarget(target), target.id);
    });
    const mapping = new Map<string, string>();
    from.targets.forEach((target) => {
        const candidate = toFingerprints.get(fingerprintTarget(target));
        if (candidate) {
            mapping.set(target.id, candidate);
        }
    });
    return mapping;
};

export default function DualSyncDemo() {
    const { theme } = useTheme();
    const { dataSource, fields } = useFetch<IDataSource>(DATASET_URL);
    const primaryRef = useRef<IGWHandler | null>(null);
    const secondaryRef = useRef<IGWHandler | null>(null);
    const [status, setStatus] = useState('Waiting for both canvases to mount...');
    const [lastAction, setLastAction] = useState('No mirrored action yet');
    const [lastCursor, setLastCursor] = useState('No remote cursor yet');

    useEffect(() => {
        let disposed = false;
        let raf: number | null = null;
        let bound = false;
        const disposers: Array<() => void> = [];
        let targetIdMaps: Record<TargetDirection, Map<string, string>> = {
            aToB: new Map(),
            bToA: new Map(),
        };

        const refreshTargetMaps = () => {
            const a = primaryRef.current;
            const b = secondaryRef.current;
            if (!a || !b) return;
            try {
                const left = a.getAgentState();
                const right = b.getAgentState();
                targetIdMaps = {
                    aToB: createTargetMap(left, right),
                    bToA: createTargetMap(right, left),
                };
            } catch (error) {
                console.warn('Failed to refresh target maps', error);
            }
        };

        const bindPair = (source: IGWHandler, target: IGWHandler, profile: PresenceProfile, originLabel: string, direction: TargetDirection) =>
            source.onAgentEvent((event) => {
                if (event.type === 'hover') {
                    const map = targetIdMaps[direction];
                    if (event.action === 'enter') {
                        const mirroredTargetId = map.get(event.targetId);
                        if (!mirroredTargetId) {
                            refreshTargetMaps();
                            return;
                        }
                        target.updatePresence({
                            userId: profile.userId,
                            displayName: profile.displayName,
                            color: profile.color,
                            targetId: mirroredTargetId,
                        });
                        setLastCursor(`${originLabel} cursor on ${event.targetKind} (${event.targetId})`);
                    } else {
                        target.clearPresence(profile.userId);
                        setLastCursor('No remote cursor yet');
                    }
                    return;
                }

                if (event.type === 'method' && event.status === 'success' && event.source === 'ui') {
                    const request = {
                        method: event.method,
                        args: event.args as AgentMethodRequest['args'],
                    } as AgentMethodRequest;

                    void target
                        .dispatchMethod(request)
                        .then((result) => {
                            if (result.success) {
                                setLastAction(`${originLabel} ran ${event.method}`);
                                refreshTargetMaps();
                            }
                        })
                        .catch((error) => {
                            console.warn('Failed to mirror method', error);
                        });
                }
            });

        const ensureHandlers = () => {
            if (disposed || bound) return;
            const left = primaryRef.current;
            const right = secondaryRef.current;

            if (left && right) {
                bound = true;
                refreshTargetMaps();
                disposers.push(bindPair(left, right, PRESENCE_PROFILES.alpha, 'Workspace A', 'aToB'));
                disposers.push(bindPair(right, left, PRESENCE_PROFILES.beta, 'Workspace B', 'bToA'));
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
                    This demo mounts two GraphicWalker instances that share hover presence highlights and mirror VisSpec method calls. Drag fields, toggle marks, or
                    apply filters in either panel to see the other side update automatically.
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
                        <GraphicWalker ref={primaryRef} data={dataSource} fields={fields} appearance={theme} vizThemeConfig="g2" />
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
                        <GraphicWalker ref={secondaryRef} data={dataSource} fields={fields} appearance={theme} vizThemeConfig="g2" />
                    </div>
                </article>
            </section>
        </div>
    );
}
