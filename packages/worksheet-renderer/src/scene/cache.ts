import type { AxisLeaf, DomainBatch, PaneData, ReadVersion, RenderPlan } from '../core/types';
import { getDisplayDomain } from '../core/domains';
import type { DrawCommand, HitRegion, SceneFrame } from './types';

export interface CachedPaneGeometry {
    commands: DrawCommand[];
    hits: HitRegion[];
    /** Includes referenced records, labels, command IDs and local geometry. */
    bytes: number;
}
export interface SceneAccounting {
    bases: ReadonlyArray<{ value: CachedPaneGeometry; bytes: number }>;
    exclusiveBytes: number;
}
const accounting = new WeakMap<SceneFrame, SceneAccounting>();
/** Current/candidate frames may share identical local payloads even after LRU eviction. */
export function sceneAccounting(frame: SceneFrame): SceneAccounting | undefined {
    return accounting.get(frame);
}
export function setSceneAccounting(frame: SceneFrame, value: SceneAccounting): void {
    accounting.set(frame, value);
}
/** The owner routes these entries into its evictable, shared geometry budget. */
export interface SceneCacheStore {
    get(key: string): CachedPaneGeometry | undefined;
    put(key: string, value: CachedPaneGeometry, bytes: number): boolean;
    remove(key: string): void;
    measure(value: unknown): number;
}
let nextCache = 0;
export function createSceneCache(store: SceneCacheStore, maxEntries = 256) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 256)
        throw new Error('resource-limit: Scene cache requires 1–256 entries');
    const prefix = `pane-geometry:${++nextCache}:`,
        keys = new Map<string, true>();
    let signature = '',
        identities = new WeakMap<object, number>(),
        sequence = 0,
        hits = 0,
        misses = 0;
    const identity = (value: object | undefined) => {
        if (!value) return 0;
        let id = identities.get(value);
        if (!id) {
            id = ++sequence;
            identities.set(value, id);
        }
        return id;
    };
    const clear = () => {
        for (const key of keys.keys()) store.remove(key);
        keys.clear();
        identities = new WeakMap();
        sequence = 0;
        signature = '';
    };
    return {
        begin(plan: RenderPlan, version: ReadVersion, width: number, height: number) {
            // Small display specifications are compared once per frame, never once per mark.
            const next = JSON.stringify([plan, version, width, height]);
            if (signature !== next) {
                clear();
                signature = next;
            }
        },
        pane(
            plan: RenderPlan,
            row: AxisLeaf,
            column: AxisLeaf,
            pane: PaneData | undefined,
            domains: DomainBatch,
            complete: boolean,
            state: string,
            build: () => SceneFrame,
        ): CachedPaneGeometry {
            const refs = [
                row.positionRef ? getDisplayDomain(plan, row.positionRef, 'y', domains, row, column) : undefined,
                column.positionRef ? getDisplayDomain(plan, column.positionRef, 'x', domains, row, column) : undefined,
                ...(['color', 'size', 'opacity', 'shape'] as const).map((channel) => {
                    const binding = plan.channels?.[channel];
                    return binding && 'fieldRef' in binding ? getDisplayDomain(plan, binding.fieldRef, channel, domains) : undefined;
                }),
            ];
            // Ranks are unique within begin()'s complete immutable presentation signature.
            // Keeping typed member paths out of this administrative key bounds its footprint.
            const key = `${prefix}${row.rank}:${column.rank}:${identity(pane?.records)}:${refs.map(identity).join(',')}:${identity(domains.series)}:${pane?.seriesCount ?? 0}:${complete}:${state}`;
            const cached = store.get(key);
            keys.delete(key);
            keys.set(key, true);
            if (cached) {
                hits++;
                return cached;
            }
            misses++;
            const frame = build();
            const value: CachedPaneGeometry = { commands: frame.commands, hits: frame.hits, bytes: 0 };
            // A cold pane is measured once. Hot frames sum this cost instead of walking
            // thousands of repeated record values and long accessibility strings again.
            value.bytes = Math.ceil(store.measure(value) * 1.25) + 256;
            while (keys.size > maxEntries) {
                const first = keys.keys().next().value!;
                keys.delete(first);
                store.remove(first);
            }
            if (!store.put(key, value, value.bytes)) keys.delete(key);
            return value;
        },
        measure: store.measure,
        metadataBytes: () => signature.length * 2 + keys.size * 384 + 4096,
        clear,
        stats: () => ({ entries: keys.size, hits, misses }),
    };
}
export type SceneCache = ReturnType<typeof createSceneCache>;
