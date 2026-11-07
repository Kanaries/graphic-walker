import type {
    Axis,
    AxisLocation,
    AxisWindow,
    DomainBatch,
    DomainRequest,
    LocateRequest,
    PaneBatch,
    PaneData,
    PaneWindow,
    RankRange,
    ReadVersion,
    RenderDataManifest,
    RenderDataSource,
    RenderPlan,
} from '../core/types';
import { sameVersion } from '../core/keys';
import { domainRequestForWindow, domainStorageKey, hasFixedDomain } from '../core/domains';
import { needsSeriesDomain } from '../core/series';
import { PreparedDataError } from '../core/prepared';
import { assertCompleteWindow, assertLocation, assertWindowProgress, validateAxis, type CompleteWindowInput } from '../core/validateWindow';
import {
    abortError,
    estimateBytes,
    versionKey,
    type CacheLayer,
    type ResourceManager,
    type ResourcePartition,
    type ResourcePriority,
} from './resources';
import { intersection, mergeWindows, rangeContains, subtractWindows, windowContains } from './ranges';
export interface ReadOptions {
    signal?: AbortSignal;
    priority?: ResourcePriority;
    partition?: ResourcePartition;
}
export interface WindowProgress extends CompleteWindowInput {
    readonly status: 'loading' | 'complete' | 'preview';
    readonly loadingWindows: readonly PaneWindow[];
    readonly domainsReady: boolean;
    /** Estimated immutable payload bytes (plan, version, manifest, window, axes, panes and domains); excludes timings and release. */
    readonly retainedBytes: number;
    readonly timings: {
        readonly readMs: number;
        readonly validationCpuMs: number;
        readonly sourceSyncMs: number;
        readonly readerCpuMs: number;
    };
}
export interface WindowReadResult extends WindowProgress {
    release(): void;
}
export interface WindowReadOptions extends ReadOptions {
    onProgress?: (progress: WindowProgress) => void;
}
/** sourceIdentity is only for trusted wrappers delegating to the same immutable provider. */
export interface ReaderOptions {
    sourceIdentity?: RenderDataSource;
    maxPages?: number;
    maxRecords?: number;
    maxPaneRecords?: number;
    maxWindowCells?: number;
}
interface PaneCache {
    windows: readonly PaneWindow[];
    batch: PaneBatch;
    preview: boolean;
    validated?: { progress: WindowProgress; bytes: number; limits: string };
}
interface PaneConsumer {
    options: ReadOptions;
    resolve(value: PaneCache): void;
    reject(error: unknown): void;
    progress?(batch: PaneBatch): void;
    detach(): void;
}
interface PaneFlight {
    windows: PaneWindow[];
    controller: AbortController;
    consumers: Set<PaneConsumer>;
    latest?: PaneBatch;
    partition: ResourcePartition;
    priority: ResourcePriority;
    recordBudget: number;
}
let readerSequence = 0,
    leaseSequence = 0,
    sourceSequence = 0;
const sourceTokens = new WeakMap<RenderDataSource, number>();
const fail = (message: string, code = 'source-contract-violation'): never => {
    throw new PreparedDataError(code, message);
};
const stable = (value: unknown): string =>
    JSON.stringify(value, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(
                  Object.keys(item)
                      .sort()
                      .map((key) => [key, item[key]]),
              )
            : item,
    );
const validRange = (range: RankRange, total: number) =>
    !!range &&
    Number.isSafeInteger(range.start) &&
    Number.isSafeInteger(range.end) &&
    range.start >= 0 &&
    range.end >= range.start &&
    range.end <= total;
const containsPane = (window: PaneWindow, pane: PaneData) =>
    pane.rowRank >= window.rows.start &&
    pane.rowRank < window.rows.end &&
    pane.columnRank >= window.columns.start &&
    pane.columnRank < window.columns.end;
// Source objects are not owned by the renderer. Snapshot them before validation or
// caching; only snapshots created here may share subtrees on later window assembly.
const ownedSnapshots = new WeakSet<object>();
function ownSnapshot<T>(value: T): T {
    const seen = new WeakMap<object, unknown>();
    let visited = 0;
    const copy = (item: any): any => {
        if (!item || typeof item !== 'object' || ownedSnapshots.has(item)) return item;
        if (seen.has(item)) return seen.get(item);
        if (++visited > 2_000_000) fail('One response exceeds the bounded snapshot traversal.', 'resource-limit');
        const result: any = item instanceof Date ? new Date(item.getTime()) : Array.isArray(item) ? [] : {};
        seen.set(item, result);
        for (const property of Object.keys(item))
            Object.defineProperty(result, property, { value: copy(item[property]), enumerable: true });
        ownedSnapshots.add(result);
        return Object.freeze(result);
    };
    return copy(value);
}
const optionalRead = (options: ReadOptions) => options.priority === 'overscan';
const pointWindow = (pane: PaneData): PaneWindow => ({
    rows: { start: pane.rowRank, end: pane.rowRank + 1 },
    columns: { start: pane.columnRank, end: pane.columnRank + 1 },
});
/** One fixed source/version reader. Disposal cancels only its consumers, never the shared manager or source. */
export function createWindowReader(source: RenderDataSource, plan: RenderPlan, resources: ResourceManager, limits: ReaderOptions = {}) {
    plan = ownSnapshot(plan);
    const identity = limits.sourceIdentity ?? source;
    if (!sameVersion(identity.version, source.version))
        fail('A reader wrapper identity must use the same immutable version.', 'version-expired');
    if (!sourceTokens.has(identity)) sourceTokens.set(identity, ++sourceSequence);
    const version: ReadVersion = { ...source.version },
        id = ++readerSequence;
    let prefix = JSON.stringify([sourceTokens.get(identity), versionKey(version), stable(plan)]);
    const lifetime = new AbortController();
    const written = new Map<
        string,
        {
            layer: CacheLayer;
            key: string;
            partition: ResourcePartition;
        }
    >();
    const leases = new Set<string>();
    let sourceSyncMs = 0,
        readerCpuMs = 0,
        outsideMs = 0,
        cpuDepth = 0,
        activeCpuStart = 0,
        activeExcluded = 0;
    // Drive each async continuation as a measured synchronous generator step. Awaited
    // time is excluded, nested reader calls count once, and provider/host callbacks
    // are excluded explicitly. The provider's synchronous portion is reported separately.
    function measured<T>(work: () => T): T {
        const outer = cpuDepth++ === 0,
            start = performance.now(),
            excluded = outsideMs;
        if (outer) {
            activeCpuStart = start;
            activeExcluded = excluded;
        }
        try {
            return work();
        } finally {
            cpuDepth--;
            if (outer) readerCpuMs += Math.max(0, performance.now() - start - (outsideMs - excluded));
        }
    }
    const currentReaderCpu = () =>
        readerCpuMs + (cpuDepth ? Math.max(0, performance.now() - activeCpuStart - (outsideMs - activeExcluded)) : 0);
    function outside<T>(work: () => T): T {
        const start = performance.now();
        try {
            return work();
        } finally {
            outsideMs += performance.now() - start;
        }
    }
    function* awaitValue<T>(value: Promise<T>): Generator<Promise<T>, T, T> {
        return yield value;
    }
    function tracked<T>(factory: () => Generator<Promise<unknown>, T, any>): Promise<Awaited<T>> {
        const iterator = factory();
        return new Promise<Awaited<T>>((resolve, reject) => {
            const step = (method: 'next' | 'throw', value: unknown) => {
                let result: IteratorResult<Promise<unknown>, T>;
                try {
                    result = measured(() => iterator[method](value));
                } catch (error) {
                    reject(error);
                    return;
                }
                if (result.done) resolve(result.value as Awaited<T>);
                else
                    Promise.resolve(result.value).then(
                        (value) => step('next', value),
                        (error) => step('throw', error),
                    );
            };
            step('next', undefined);
        });
    }
    const invoke = <T>(read: () => Promise<T>): Promise<T> => {
        const start = performance.now();
        try {
            return outside(read);
        } finally {
            sourceSyncMs += performance.now() - start;
        }
    };
    function put<T>(
        layer: CacheLayer,
        cacheKey: string,
        value: T,
        options: {
            partition?: ResourcePartition;
            priority?: ResourcePriority;
            bytes?: number;
        } = {},
    ) {
        if (lifetime.signal.aborted) return false;
        const partition = options.partition ?? 'display';
        const accepted = resources.cachePut(layer, cacheKey, value, options);
        if (accepted && partition === 'export')
            written.set(JSON.stringify([layer, cacheKey, partition]), { layer, key: cacheKey, partition });
        return accepted;
    }
    const maxPages = limits.maxPages ?? 256,
        maxRecords = limits.maxRecords ?? 20000,
        maxPaneRecords = limits.maxPaneRecords ?? 20000,
        maxWindowCells = limits.maxWindowCells ?? 20000;
    if (![maxPages, maxRecords, maxPaneRecords, maxWindowCells].every((n) => Number.isSafeInteger(n) && n > 0))
        throw new Error('invalid-option: reader limits must be positive safe integers');
    const validationLimits = JSON.stringify([maxRecords, maxPaneRecords, maxWindowCells]);
    const axisEntries: {
        axis: Axis;
        range: RankRange;
        key: string;
        partition: ResourcePartition;
    }[] = [];
    const paneEntries: {
        key: string;
        partition: ResourcePartition;
        windows: readonly PaneWindow[];
    }[] = [];
    const axisPending: {
        axis: Axis;
        range: RankRange;
        options: ReadOptions;
        resolve(value: AxisWindow): void;
        reject(error: unknown): void;
    }[] = [];
    const axisFlights: {
        axis: Axis;
        range: RankRange;
        key: string;
        partition: ResourcePartition;
        optional: boolean;
        run(signal: AbortSignal): Promise<AxisWindow>;
    }[] = [];
    const panePending: {
        windows: PaneWindow[];
        options: ReadOptions;
        progress?(batch: PaneBatch): void;
        resolve(value: PaneCache): void;
        reject(error: unknown): void;
    }[] = [];
    const paneFlights = new Set<PaneFlight>();
    let axisQueued = false,
        paneQueued = false;
    const key = (kind: string, value: unknown = null) => JSON.stringify([prefix, kind, value]);
    const check = (actual: ReadVersion, signal?: AbortSignal) => {
        if (signal?.aborted) throw abortError();
        if (!sameVersion(source.version, version) || !sameVersion(actual, version))
            fail('The source changed its fixed read version.', 'version-expired');
    };
    function fixedJob<T>(
        work: (
            context: { source: RenderDataSource; plan: RenderPlan; key: typeof key; check: typeof check },
            signal: AbortSignal,
        ) => Promise<T>,
    ) {
        // A deduplicated queued job may outlive the reader that first scheduled it.
        // Only the manager-owned job keeps these immutable read inputs until settlement.
        const provider = source,
            displayPlan = plan,
            cachePrefix = prefix;
        const context = {
            source: provider,
            plan: displayPlan,
            key: (kind: string, value: unknown = null) => JSON.stringify([cachePrefix, kind, value]),
            check: (actual: ReadVersion, signal?: AbortSignal) => {
                if (signal?.aborted) throw abortError();
                if (!sameVersion(provider.version, version) || !sameVersion(actual, version))
                    fail('The source changed its fixed read version.', 'version-expired');
            },
        };
        return (signal: AbortSignal) => work(context, signal);
    }
    function linked(options: ReadOptions) {
        const controller = new AbortController(),
            abort = () => controller.abort();
        lifetime.signal.addEventListener('abort', abort, { once: true });
        options.signal?.addEventListener('abort', abort, { once: true });
        if (lifetime.signal.aborted || options.signal?.aborted) abort();
        return {
            signal: controller.signal,
            cancel: abort,
            close() {
                lifetime.signal.removeEventListener('abort', abort);
                options.signal?.removeEventListener('abort', abort);
            },
        };
    }
    async function run<T>(
        options: ReadOptions,
        work: (
            options: ReadOptions & {
                signal: AbortSignal;
                cancel(): void;
            },
        ) => Promise<T>,
    ): Promise<T> {
        return tracked(function* () {
            const link = linked(options);
            try {
                check(version, link.signal);
                return yield* awaitValue(work({ ...options, signal: link.signal, cancel: link.cancel }));
            } finally {
                link.cancel();
                link.close();
            }
        });
    }
    const cacheOptions = (options: ReadOptions) => ({
        partition: options.partition ?? ('display' as ResourcePartition),
        priority: options.priority ?? ('metadata' as ResourcePriority),
    });
    async function describe(options: ReadOptions = {}): Promise<RenderDataManifest> {
        return tracked(function* () {
            return run(options, async (own) => {
                return tracked(function* () {
                    const partition = own.partition ?? 'display',
                        cacheKey = key('manifest');
                    const cached = resources.cacheGet<RenderDataManifest>('metadata', cacheKey, partition);
                    if (cached) return cached;
                    const result = yield* awaitValue(
                        resources.schedule({
                            key: cacheKey,
                            version,
                            ...own,
                            priority: own.priority ?? 'metadata',
                            run: fixedJob(async ({ source, plan, key, check }, signal) => {
                                return tracked(function* () {
                                    const manifest = ownSnapshot(yield* awaitValue(invoke(() => source.describe(signal))));
                                    check(manifest.version, signal);
                                    if (
                                        !['complete', 'preview'].includes(manifest.status) ||
                                        manifest.domainPlanKey !== plan.domainPlanKey ||
                                        !manifest.capabilities.domainPlanKeys.includes(plan.domainPlanKey)
                                    )
                                        fail('Manifest does not match the prepared display plan.');
                                    for (const n of [
                                        manifest.rowLeafCount,
                                        manifest.columnLeafCount,
                                        manifest.recordCount,
                                        manifest.nonEmptyPaneCount,
                                        manifest.capabilities.maxAxisWindow,
                                        manifest.capabilities.maxPaneWindows,
                                    ])
                                        if (!Number.isSafeInteger(n) || n < 0)
                                            fail('Manifest counts and limits must be nonnegative safe integers.');
                                    if (!manifest.capabilities.maxAxisWindow || !manifest.capabilities.maxPaneWindows)
                                        fail('Source read limits must be positive.');
                                    if (!manifest.capabilities.randomAxisAccess && manifest.status !== 'preview')
                                        fail('Complete scrolling requires random axis access.', 'unsupported-source');
                                    return manifest;
                                });
                            }),
                        }),
                    );
                    check(result.version, own.signal);
                    put('metadata', cacheKey, result, cacheOptions(own));
                    return result;
                });
            });
        });
    }
    const sliceAxis = (data: AxisWindow, range: RankRange): AxisWindow => ({
        ...data,
        range,
        leaves: data.leaves.filter((leaf) => leaf.rank >= range.start && leaf.rank < range.end),
        ancestors: data.ancestors.filter((span) => span.start < range.end && span.end > range.start),
    });
    function joinAxisFlight(flight: (typeof axisFlights)[number], options: ReadOptions) {
        return resources
            .schedule({ key: flight.key, version, ...options, priority: options.priority ?? 'metadata', run: flight.run })
            .then((data) =>
                measured(() => {
                    check(data.version, options.signal);
                    if (
                        put('members', flight.key, data, cacheOptions(options)) &&
                        !axisEntries.some((entry) => entry.key === flight.key && entry.partition === flight.partition)
                    )
                        axisEntries.push({ axis: flight.axis, range: flight.range, key: flight.key, partition: flight.partition });
                    return data;
                }),
            );
    }
    function enqueueAxis(axis: Axis, range: RankRange, options: ReadOptions): Promise<AxisWindow> {
        const flight = axisFlights.find(
            (item) =>
                item.axis === axis &&
                item.partition === (options.partition ?? 'display') &&
                item.optional === optionalRead(options) &&
                rangeContains(item.range, range),
        );
        if (flight) return joinAxisFlight(flight, options).then((data) => measured(() => sliceAxis(data, range)));
        return new Promise((resolve, reject) => {
            axisPending.push({ axis, range, options, resolve, reject });
            if (axisQueued) return;
            axisQueued = true;
            queueMicrotask(async () => {
                return tracked(function* () {
                    axisQueued = false;
                    const pending = axisPending.splice(0);
                    for (const axis of ['row', 'column'] as const)
                        for (const partition of ['display', 'export'] as const)
                            for (const optional of [false, true]) {
                                const candidates = pending.filter(
                                    (item) =>
                                        item.axis === axis &&
                                        (item.options.partition ?? 'display') === partition &&
                                        optionalRead(item.options) === optional,
                                );
                                for (const item of candidates) if (item.options.signal?.aborted) item.reject(abortError());
                                const requests = candidates.filter((item) => !item.options.signal?.aborted);
                                if (!requests.length) continue;
                                try {
                                    const manifest = yield* awaitValue(
                                        describe({
                                            signal: lifetime.signal,
                                            partition,
                                            priority: partition === 'export' ? 'export' : 'metadata',
                                        }),
                                    );
                                    const groups: (typeof requests)[] = [];
                                    for (const request of requests.sort((a, b) => a.range.start - b.range.start)) {
                                        const previous = groups[groups.length - 1];
                                        if (
                                            previous &&
                                            request.range.start <= Math.max(...previous.map((item) => item.range.end)) &&
                                            request.range.end - previous[0].range.start <= manifest.capabilities.maxAxisWindow
                                        )
                                            previous.push(request);
                                        else groups.push([request]);
                                    }
                                    for (const group of groups) {
                                        const range = {
                                                start: group[0].range.start,
                                                end: Math.max(...group.map((item) => item.range.end)),
                                            },
                                            cacheKey = key('axis', [axis, range]);
                                        const flight = {
                                            axis,
                                            range,
                                            key: cacheKey,
                                            partition,
                                            optional,
                                            run: fixedJob(async ({ source, plan, check }, signal) => {
                                                return tracked(function* () {
                                                    try {
                                                        const data = ownSnapshot(
                                                            yield* awaitValue(
                                                                invoke(() => source.readAxis({ version, axis, range }, signal)),
                                                            ),
                                                        );
                                                        check(data.version, signal);
                                                        validateAxis(
                                                            data,
                                                            axis,
                                                            axis === 'row' ? plan.rows : plan.columns,
                                                            range,
                                                            axis === 'row' ? manifest.rowLeafCount : manifest.columnLeafCount,
                                                            version,
                                                        );
                                                        if (put('members', cacheKey, data, cacheOptions(group[0].options))) {
                                                            axisEntries.push({ axis, range, key: cacheKey, partition });
                                                            if (axisEntries.length > 2048) axisEntries.shift();
                                                        }
                                                        return data;
                                                    } finally {
                                                        const at = axisFlights.indexOf(flight);
                                                        if (at >= 0) axisFlights.splice(at, 1);
                                                    }
                                                });
                                            }),
                                        };
                                        axisFlights.push(flight);
                                        for (const request of group)
                                            joinAxisFlight(flight, request.options).then(
                                                (data) => measured(() => request.resolve(sliceAxis(data, request.range))),
                                                request.reject,
                                            );
                                    }
                                } catch (error) {
                                    for (const request of requests) request.reject(error);
                                }
                            }
                });
            });
        });
    }
    async function readAxis(axis: Axis, range: RankRange, options: ReadOptions = {}): Promise<AxisWindow> {
        return tracked(function* () {
            return run(options, async (own) => {
                return tracked(function* () {
                    const manifest = yield* awaitValue(describe(own)),
                        total = axis === 'row' ? manifest.rowLeafCount : manifest.columnLeafCount;
                    if (!validRange(range, total)) fail('Invalid requested axis range.');
                    if (range.end - range.start > manifest.capabilities.maxAxisWindow)
                        fail('Axis window exceeds source capacity.', 'resource-limit');
                    const partition = own.partition ?? 'display',
                        pieces: AxisWindow[] = [],
                        cover: PaneWindow[] = [];
                    const exact = resources.cacheGet<AxisWindow>('members', key('axis', [axis, range]), partition);
                    if (exact) return exact;
                    for (const entry of axisEntries)
                        if (
                            entry.axis === axis &&
                            entry.partition === partition &&
                            entry.range.start < range.end &&
                            entry.range.end > range.start
                        ) {
                            const cached = resources.cacheGet<AxisWindow>('members', entry.key, partition);
                            if (cached) {
                                pieces.push(sliceAxis(cached, range));
                                cover.push({ rows: cached.range, columns: { start: 0, end: 1 } });
                            }
                        }
                    const missing = subtractWindows([{ rows: range, columns: { start: 0, end: 1 } }], cover);
                    pieces.push(...(yield* awaitValue(Promise.all(missing.map((window) => enqueueAxis(axis, window.rows, own))))));
                    check(version, own.signal);
                    const leaves = new Map<number, AxisWindow['leaves'][number]>(),
                        headers = new Map<string, AxisWindow['ancestors'][number]>();
                    for (const piece of pieces) {
                        for (const leaf of piece.leaves) {
                            const old = leaves.get(leaf.rank);
                            if (old && stable(old) !== stable(leaf)) fail('Conflicting axis leaf for one version/rank.');
                            leaves.set(leaf.rank, leaf);
                        }
                        for (const span of piece.ancestors) {
                            const old = headers.get(span.key);
                            if (old && stable(old) !== stable(span)) fail('Conflicting ancestor span for one version.');
                            headers.set(span.key, span);
                        }
                    }
                    const result: AxisWindow = {
                        version,
                        axis,
                        range,
                        leaves: [...leaves.values()].sort((a, b) => a.rank - b.rank),
                        ancestors: [...headers.values()],
                    };
                    validateAxis(result, axis, axis === 'row' ? plan.rows : plan.columns, range, total, version);
                    return result;
                });
            });
        });
    }
    async function readDomains(request: DomainRequest, options: ReadOptions = {}): Promise<DomainBatch> {
        return tracked(function* () {
            return run(options, async (own) => {
                return tracked(function* () {
                    check(request.version, own.signal);
                    const partition = own.partition ?? 'display',
                        domains: Record<string, DomainBatch['domains'][string]> = {};
                    const refs = [...new Set(request.fieldRefs)].filter((ref) => !hasFixedDomain(plan, ref)),
                        keys = [
                            ...new Map(
                                (request.keys ?? []).filter((k) => !hasFixedDomain(plan, k.fieldRef)).map((k) => [domainStorageKey(k), k]),
                            ).values(),
                        ];
                    const missingRefs: string[] = [],
                        missingKeys: typeof keys = [];
                    for (const ref of refs) {
                        const value = resources.cacheGet<DomainBatch['domains'][string]>('domains', key('domain', ref), partition);
                        if (value) domains[ref] = value;
                        else missingRefs.push(ref);
                    }
                    for (const item of keys) {
                        const storage = domainStorageKey(item),
                            value = resources.cacheGet<DomainBatch['domains'][string]>('domains', key('domain', storage), partition);
                        if (value) domains[storage] = value;
                        else missingKeys.push(item);
                    }
                    let series = needsSeriesDomain(plan)
                        ? resources.cacheGet<NonNullable<DomainBatch['series']>>('domains', key('series'), partition)
                        : undefined;
                    if (missingRefs.length || missingKeys.length || (needsSeriesDomain(plan) && !series)) {
                        const requested: DomainRequest = {
                            version,
                            fieldRefs: missingRefs.sort(),
                            keys: missingKeys.sort((a, b) => domainStorageKey(a).localeCompare(domainStorageKey(b))),
                        };
                        const result = yield* awaitValue(
                            resources.schedule({
                                key: key('domains-request', requested),
                                version,
                                ...own,
                                priority: own.priority ?? 'metadata',
                                run: fixedJob(async ({ source, plan, key, check }, signal) => {
                                    return tracked(function* () {
                                        const result = ownSnapshot(yield* awaitValue(invoke(() => source.readDomains(requested, signal))));
                                        check(result.version, signal);
                                        for (const [storage, domain] of Object.entries(result.domains))
                                            put('domains', key('domain', storage), domain, cacheOptions(own));
                                        if (needsSeriesDomain(plan) && result.series)
                                            put('domains', key('series'), result.series, cacheOptions(own));
                                        return result;
                                    });
                                }),
                            }),
                        );
                        check(result.version, own.signal);
                        for (const [storage, domain] of Object.entries(result.domains))
                            put('domains', key('domain', storage), domain, cacheOptions(own));
                        if (needsSeriesDomain(plan) && result.series) put('domains', key('series'), result.series, cacheOptions(own));
                        Object.assign(domains, result.domains);
                        series = needsSeriesDomain(plan) ? (result.series ?? series) : undefined;
                    }
                    return { version, domains, ...(series ? { series } : {}) };
                });
            });
        });
    }
    async function locate(request: LocateRequest, options: ReadOptions = {}): Promise<AxisLocation> {
        return tracked(function* () {
            return run(options, async (own) => {
                return tracked(function* () {
                    check(request.version, own.signal);
                    const manifest = yield* awaitValue(describe(own)),
                        cacheKey = key('locate', request),
                        partition = own.partition ?? 'display';
                    const cached = resources.cacheGet<AxisLocation>('members', cacheKey, partition);
                    if (cached) return cached;
                    return resources.schedule({
                        key: cacheKey,
                        version,
                        ...own,
                        run: fixedJob(async ({ source, plan, key, check }, signal) => {
                            return tracked(function* () {
                                const location = ownSnapshot(yield* awaitValue(invoke(() => source.locate(request, signal))));
                                check(location.version, signal);
                                assertLocation({ location, request, plan, manifest });
                                put('members', cacheKey, location, cacheOptions(own));
                                return location;
                            });
                        }),
                    });
                });
            });
        });
    }
    function attach(flight: PaneFlight, options: ReadOptions, progress?: (batch: PaneBatch) => void): Promise<PaneCache> {
        if (options.signal?.aborted) return Promise.reject(abortError());
        return new Promise((resolve, reject) => {
            const cancel = () => {
                flight.consumers.delete(consumer);
                consumer.detach();
                reject(abortError());
                if (!flight.consumers.size) flight.controller.abort();
            };
            const consumer: PaneConsumer = {
                options,
                resolve,
                reject,
                progress,
                detach: () => options.signal?.removeEventListener('abort', cancel),
            };
            flight.consumers.add(consumer);
            options.signal?.addEventListener('abort', cancel, { once: true });
            if (flight.latest) progress?.(flight.latest);
        });
    }
    async function loadPages(flight: PaneFlight) {
        return tracked(function* () {
            const owner = `reader:${id}:pages:${++leaseSequence}`,
                signal = flight.controller.signal;
            try {
                const manifest = yield* awaitValue(describe({ signal, partition: flight.partition, priority: flight.priority }));
                const panes = new Map<string, PaneData>(),
                    rankKeys = new Map<string, string>(),
                    cursors = new Set<string>();
                let coverage: PaneWindow[] = [],
                    cursor: string | undefined;
                for (let pageIndex = 0; ; pageIndex++) {
                    if (pageIndex >= maxPages) fail('Pane continuation exceeds the bounded page count.', 'resource-limit');
                    const batch = ownSnapshot(
                        yield* awaitValue(
                            resources.schedule({
                                key: key('pane-page', [flight.windows, cursor ?? null, flight.priority === 'overscan']),
                                version,
                                signal,
                                partition: flight.partition,
                                priority: flight.priority === 'export' ? 'export' : pageIndex ? 'continuation' : flight.priority,
                                run: fixedJob(async ({ source }, current) =>
                                    invoke(() =>
                                        source.readPaneData({ version, windows: flight.windows, ...(cursor ? { cursor } : {}) }, current),
                                    ),
                                ),
                            }),
                        ),
                    );
                    check(batch.version, signal);
                    for (const covered of batch.coveredWindows) {
                        if (
                            !validRange(covered.rows, manifest.rowLeafCount) ||
                            !validRange(covered.columns, manifest.columnLeafCount) ||
                            subtractWindows([covered], flight.windows).length
                        )
                            fail('Coverage lies outside its original pane request.');
                    }
                    for (const pane of batch.panes) {
                        if (
                            !flight.windows.some((window) => containsPane(window, pane)) ||
                            !Number.isSafeInteger(pane.rowRank) ||
                            !Number.isSafeInteger(pane.columnRank)
                        )
                            fail('Paged pane lies outside its original request.');
                        const rank = JSON.stringify([pane.rowRank, pane.columnRank]),
                            rankKey = rankKeys.get(rank);
                        if (rankKey && rankKey !== pane.key) fail('One pane rank has conflicting stable keys.');
                        rankKeys.set(rank, pane.key);
                        const old = panes.get(pane.key);
                        if (!old && coverage.some((window) => containsPane(window, pane)))
                            fail('A continuation added a pane to a previously confirmed empty slot.');
                        if (old && stable({ ...old, records: [], complete: false }) !== stable({ ...pane, records: [], complete: false }))
                            fail('Continuation changed pane identity or series metadata.');
                        const records = new Map((old?.records ?? []).map((record) => [record.datumKey, record]));
                        const pageKeys = new Set<string>();
                        for (const record of pane.records) {
                            if (typeof record.datumKey !== 'string' || !record.datumKey || pageKeys.has(record.datumKey))
                                fail('A page contains duplicate or invalid datum identities.');
                            pageKeys.add(record.datumKey);
                            const previous = records.get(record.datumKey);
                            if (previous && stable(previous) !== stable(record))
                                fail('A continuation changed a datum under the same identity.');
                            if (old?.complete && !previous) fail('A continuation appended records to a completed pane.');
                            records.set(record.datumKey, record);
                        }
                        if (old?.complete && !pane.complete) fail('A completed pane became partial.');
                        if (records.size > maxPaneRecords) fail('One pane exceeds its complete-record budget.', 'resource-limit');
                        panes.set(pane.key, { ...pane, records: [...records.values()], complete: pane.complete || old?.complete || false });
                    }
                    coverage = mergeWindows([...coverage, ...batch.coveredWindows]);
                    for (const pane of panes.values())
                        if (!pane.complete && coverage.some((window) => containsPane(window, pane)))
                            fail('Coverage cannot certify an incomplete pane.');
                    const all = [...panes.values()];
                    if (all.reduce((n, pane) => n + pane.records.length, 0) > flight.recordBudget)
                        fail('A window exceeds its complete-record budget.', 'resource-limit');
                    resources.reserve(owner, estimateBytes({ panes: all, coverage }), { partition: flight.partition });
                    const visible = ownSnapshot<PaneBatch>({
                        version,
                        panes: all.filter((pane) => pane.complete),
                        coveredWindows: coverage,
                    });
                    if (batch.nextCursor === undefined) {
                        const missing = subtractWindows(flight.windows, coverage),
                            preview = manifest.status === 'preview';
                        if (!preview && (missing.length || all.some((pane) => !pane.complete)))
                            fail('The final pane page leaves missing coverage or incomplete panes.', 'incomplete-data');
                        const result: PaneCache = { windows: flight.windows, batch: visible, preview };
                        const cacheKey = key('panes', flight.windows);
                        if (put('data', cacheKey, result, { partition: flight.partition, priority: flight.priority })) {
                            paneEntries.push({ key: cacheKey, partition: flight.partition, windows: flight.windows });
                            if (paneEntries.length > 2048) paneEntries.shift();
                        }
                        for (const consumer of flight.consumers) {
                            consumer.detach();
                            consumer.resolve(result);
                        }
                        flight.consumers.clear();
                        return;
                    }
                    if (typeof batch.nextCursor !== 'string' || !batch.nextCursor || cursors.has(batch.nextCursor))
                        fail('Pane continuation cursor is invalid or cyclic.');
                    cursors.add(batch.nextCursor);
                    cursor = batch.nextCursor;
                    flight.latest = visible;
                    for (const consumer of flight.consumers) consumer.progress?.(visible);
                }
            } catch (error) {
                for (const consumer of flight.consumers) {
                    consumer.detach();
                    consumer.reject(error);
                }
                flight.consumers.clear();
            } finally {
                resources.release(owner);
                paneFlights.delete(flight);
            }
        });
    }
    function requestPanes(windows: PaneWindow[], options: ReadOptions, progress?: (batch: PaneBatch) => void): Promise<PaneCache> {
        const active = [...paneFlights].find(
            (flight) =>
                !flight.controller.signal.aborted &&
                flight.partition === (options.partition ?? 'display') &&
                optionalRead({ priority: flight.priority }) === optionalRead(options) &&
                !subtractWindows(windows, flight.windows).length,
        );
        if (active) return attach(active, options, progress);
        return new Promise((resolve, reject) => {
            panePending.push({ windows, options, progress, resolve, reject });
            if (paneQueued) return;
            paneQueued = true;
            queueMicrotask(async () => {
                return tracked(function* () {
                    paneQueued = false;
                    const pending = panePending.splice(0);
                    for (const partition of ['display', 'export'] as const)
                        for (const optional of [false, true]) {
                            const requests = pending.filter(
                                (item) =>
                                    (item.options.partition ?? 'display') === partition &&
                                    optionalRead(item.options) === optional &&
                                    !item.options.signal?.aborted,
                            );
                            for (const item of pending.filter(
                                (item) =>
                                    (item.options.partition ?? 'display') === partition &&
                                    optionalRead(item.options) === optional &&
                                    item.options.signal?.aborted,
                            ))
                                item.reject(abortError());
                            if (!requests.length) continue;
                            try {
                                const manifest = yield* awaitValue(
                                    describe({
                                        signal: lifetime.signal,
                                        partition,
                                        priority: partition === 'export' ? 'export' : 'metadata',
                                    }),
                                );
                                const batches: (typeof requests)[] = [];
                                for (const item of requests) {
                                    const previous = batches[batches.length - 1],
                                        combined = previous
                                            ? mergeWindows([...previous.flatMap((item) => item.windows), ...item.windows])
                                            : [];
                                    if (
                                        previous &&
                                        combined.length <= manifest.capabilities.maxPaneWindows &&
                                        combined.reduce(
                                            (n, window) =>
                                                n + (window.rows.end - window.rows.start) * (window.columns.end - window.columns.start),
                                            0,
                                        ) <= maxWindowCells
                                    )
                                        previous.push(item);
                                    else batches.push([item]);
                                }
                                for (const items of batches) {
                                    const flight: PaneFlight = {
                                        windows: mergeWindows(items.flatMap((item) => item.windows)),
                                        controller: new AbortController(),
                                        consumers: new Set(),
                                        partition,
                                        recordBudget: maxRecords * items.length,
                                        priority:
                                            partition === 'export'
                                                ? 'export'
                                                : items.some((item) => item.options.priority !== 'overscan')
                                                  ? 'viewport'
                                                  : 'overscan',
                                    };
                                    paneFlights.add(flight);
                                    for (const item of items) attach(flight, item.options, item.progress).then(item.resolve, item.reject);
                                    if (flight.consumers.size) void loadPages(flight);
                                    else paneFlights.delete(flight);
                                }
                            } catch (error) {
                                for (const request of requests) request.reject(error);
                            }
                        }
                });
            });
        });
    }
    function slicePanes(batches: readonly PaneBatch[], window: PaneWindow): PaneBatch {
        const panes = new Map<string, PaneData>();
        const coverage: PaneWindow[] = [];
        for (const batch of batches) {
            for (const pane of batch.panes)
                if (containsPane(window, pane)) {
                    const previous = panes.get(pane.key);
                    if (previous && stable(previous) !== stable(pane)) fail('Cached pane records conflict for one read version.');
                    panes.set(pane.key, pane);
                }
            for (const covered of batch.coveredWindows) {
                const clipped = intersection(covered, window);
                if (clipped) coverage.push(clipped);
            }
        }
        return {
            version,
            panes: [...panes.values()].sort((a, b) => a.rowRank - b.rowRank || a.columnRank - b.columnRank),
            coveredWindows: mergeWindows(coverage),
        };
    }
    function lease(progress: WindowProgress, bytes: number, partition: ResourcePartition): WindowReadResult {
        const owner = `reader:${id}:lease:${++leaseSequence}`;
        resources.reserve(owner, bytes, { partition });
        leases.add(owner);
        let released = false;
        return {
            ...progress,
            release() {
                if (released) return;
                released = true;
                leases.delete(owner);
                resources.release(owner);
            },
        };
    }
    async function readWindow(window: PaneWindow, options: WindowReadOptions = {}): Promise<WindowReadResult> {
        const wholeCpuStarted = currentReaderCpu(),
            wholeReadStarted = performance.now();
        window = ownSnapshot(window);
        return tracked(function* () {
            return run(options, async (own) => {
                return tracked(function* () {
                    const readStarted = performance.now(),
                        syncStarted = sourceSyncMs,
                        cpuStarted = currentReaderCpu();
                    let validationCpuMs = 0;
                    const partition = own.partition ?? 'display',
                        completeKey = key('panes', [window]);
                    const hot = resources.cacheGet<PaneCache>('data', completeKey, partition)?.validated;
                    if (hot?.limits === validationLimits) {
                        check(hot.progress.version, own.signal);
                        return lease(
                            { ...hot.progress, timings: { readMs: 0, validationCpuMs: 0, sourceSyncMs: 0, readerCpuMs: 0 } },
                            hot.bytes,
                            partition,
                        );
                    }
                    const manifest = yield* awaitValue(describe(own));
                    if (!validRange(window.rows, manifest.rowLeafCount) || !validRange(window.columns, manifest.columnLeafCount))
                        fail('Invalid pane window.');
                    if ((window.rows.end - window.rows.start) * (window.columns.end - window.columns.start) > maxWindowCells)
                        fail('Requested logical window exceeds its bounded slot count.', 'resource-limit');
                    const [rows, columns] = yield* awaitValue(
                        Promise.all([readAxis('row', window.rows, own), readAxis('column', window.columns, own)]),
                    );
                    const domains = yield* awaitValue(readDomains(domainRequestForWindow(plan, version, rows.leaves, columns.leaves), own));
                    const base = { plan, version, manifest, window, rows, columns, domains },
                        empty: PaneBatch = { version, panes: [], coveredWindows: [] };
                    const workingOwner = `reader:${id}:working:${++leaseSequence}`;
                    resources.reserve(workingOwner, estimateBytes(base), { partition: own.partition });
                    try {
                        let domainsReady = true;
                        try {
                            assertWindowProgress({ ...base, panes: empty });
                        } catch (error) {
                            if (
                                manifest.status !== 'preview' ||
                                !(error instanceof PreparedDataError) ||
                                error.code !== 'domain-unavailable'
                            )
                                throw error;
                            domainsReady = false;
                            assertWindowProgress({ ...base, panes: empty }, { allowUnavailableDomains: true });
                        }
                        const make = (panes: PaneBatch, final: boolean): WindowProgress => {
                            const validateStarted = performance.now();
                            if (
                                panes.panes.some((pane) => pane.records.length > maxPaneRecords) ||
                                panes.panes.reduce((total, pane) => total + pane.records.length, 0) > maxRecords
                            )
                                fail('A consumer window exceeds its record budget.', 'resource-limit');
                            const payload = ownSnapshot({ ...base, panes: domainsReady ? panes : { ...panes, panes: [] } });
                            const value = {
                                ...payload,
                                domainsReady,
                                retainedBytes: 0,
                                status:
                                    manifest.status === 'preview'
                                        ? ('preview' as const)
                                        : final
                                          ? ('complete' as const)
                                          : ('loading' as const),
                                timings: {
                                    readMs: performance.now() - readStarted,
                                    validationCpuMs,
                                    sourceSyncMs: sourceSyncMs - syncStarted,
                                    readerCpuMs: currentReaderCpu() - cpuStarted,
                                },
                                loadingWindows: subtractWindows([window], [...panes.coveredWindows, ...panes.panes.map(pointWindow)]),
                            };
                            if (final && value.status === 'complete') assertCompleteWindow(value);
                            else assertWindowProgress(value, { allowUnavailableDomains: !domainsReady });
                            validationCpuMs += performance.now() - validateStarted;
                            value.timings.validationCpuMs = validationCpuMs;
                            value.retainedBytes = estimateBytes(payload);
                            return value;
                        };
                        const pieces: PaneBatch[] = [],
                            covered: PaneWindow[] = [];
                        let terminalPreview: PaneCache | undefined;
                        const entries = [{ key: key('panes', [window]), partition, windows: [window] }, ...paneEntries];
                        const seen = new Set<string>();
                        for (const entry of entries)
                            if (
                                entry.partition === partition &&
                                !seen.has(entry.key) &&
                                entry.windows.some((item) => intersection(item, window))
                            ) {
                                seen.add(entry.key);
                                const cached = resources.cacheGet<PaneCache>('data', entry.key, partition);
                                if (!cached || !cached.windows.some((item) => intersection(item, window))) continue;
                                if (cached.preview && cached.windows.some((item) => windowContains(item, window))) terminalPreview = cached;
                                pieces.push(cached.batch);
                                covered.push(...cached.batch.coveredWindows);
                            }
                        const missing = terminalPreview ? [] : subtractWindows([window], covered);
                        let progressFailure: unknown,
                            observed = slicePanes(pieces, window);
                        const report = (batch: PaneBatch) => {
                            if (own.signal.aborted) return;
                            try {
                                observed = slicePanes([observed, batch], window);
                                resources.reserve(workingOwner, estimateBytes({ base, observed }), { partition });
                                const validated = ownSnapshot(make(observed, false));
                                const progress = Object.freeze({
                                    ...validated,
                                    timings: Object.freeze({
                                        ...validated.timings,
                                        readerCpuMs: currentReaderCpu() - cpuStarted,
                                        readMs: performance.now() - readStarted,
                                    }),
                                });
                                outside(() => options.onProgress?.(progress));
                            } catch (error) {
                                progressFailure = error;
                                own.cancel();
                            }
                        };
                        if (missing.length) {
                            const busy: PaneWindow[] = [],
                                reads: Promise<PaneCache>[] = [];
                            for (const flight of paneFlights)
                                if (
                                    !flight.controller.signal.aborted &&
                                    flight.partition === partition &&
                                    optionalRead({ priority: flight.priority }) === optionalRead(own)
                                ) {
                                    const overlaps = missing.flatMap((hole) =>
                                        flight.windows.map((part) => intersection(hole, part)).filter((part): part is PaneWindow => !!part),
                                    );
                                    if (overlaps.length) {
                                        busy.push(...overlaps);
                                        reads.push(attach(flight, own, report));
                                    }
                                }
                            const holes = subtractWindows(missing, busy);
                            for (let at = 0; at < holes.length; at += manifest.capabilities.maxPaneWindows)
                                reads.push(requestPanes(holes.slice(at, at + manifest.capabilities.maxPaneWindows), own, report));
                            let results: PaneCache[];
                            try {
                                results = yield* awaitValue(Promise.all(reads));
                            } catch (error) {
                                throw progressFailure ?? error;
                            }
                            if (progressFailure) throw progressFailure;
                            pieces.push(...results.map((result) => result.batch));
                        }
                        check(version, own.signal);
                        const progress = ownSnapshot(make(slicePanes(pieces, window), true));
                        const bytes =
                            progress.retainedBytes +
                            estimateBytes({
                                status: progress.status,
                                domainsReady: progress.domainsReady,
                                loadingWindows: progress.loadingWindows,
                                timings: progress.timings,
                                retainedBytes: progress.retainedBytes,
                            });
                        if (progress.status === 'complete') {
                            const cached: PaneCache = {
                                windows: [window],
                                batch: progress.panes,
                                preview: false,
                                validated: { progress, bytes, limits: validationLimits },
                            };
                            if (
                                put('data', completeKey, cached, { ...cacheOptions(own), bytes: bytes + 1024 }) &&
                                !paneEntries.some((entry) => entry.key === completeKey && entry.partition === partition)
                            ) {
                                paneEntries.push({ key: completeKey, partition, windows: [window] });
                                if (paneEntries.length > 2048) paneEntries.shift();
                            }
                        }
                        return lease(progress, bytes, partition);
                    } finally {
                        resources.release(workingOwner);
                    }
                });
            });
        }).then((result) => ({
            ...result,
            timings: {
                ...result.timings,
                readerCpuMs: Math.max(0, currentReaderCpu() - wholeCpuStarted),
                readMs: performance.now() - wholeReadStarted,
            },
        }));
    }
    return {
        version,
        describe,
        readAxis,
        readDomains,
        locate,
        readWindow,
        dispose() {
            lifetime.abort();
            for (const owner of leases) resources.release(owner);
            leases.clear();
            for (const item of written.values()) resources.cacheRemove(item.layer, item.key, item.partition);
            written.clear();
            for (const request of axisPending.splice(0)) request.reject(abortError());
            for (const request of panePending.splice(0)) request.reject(abortError());
            axisEntries.length = 0;
            paneEntries.length = 0;
            axisFlights.length = 0;
            for (const flight of paneFlights) {
                flight.controller.abort();
                for (const consumer of flight.consumers) {
                    consumer.detach();
                    consumer.reject(abortError());
                }
                flight.consumers.clear();
                flight.latest = undefined;
            }
            paneFlights.clear();
            // A host may retain a disposed reader/controller. Do not keep its complete
            // provider index through these method closures. Physical in-flight promises
            // still belong to the shared scheduler until the actual provider settles.
            const unavailable = async (): Promise<never> => {
                throw abortError();
            };
            source = {
                version,
                describe: unavailable,
                readAxis: unavailable,
                readDomains: unavailable,
                readPaneData: unavailable,
                locate: unavailable,
            };
            plan = {
                bindings: [],
                rows: { facets: [], positions: [] },
                columns: { facets: [], positions: [] },
                mark: 'point',
                domainPlanKey: 'disposed',
            };
            prefix = 'disposed';
        },
    };
}
export type WindowReader = ReturnType<typeof createWindowReader>;
