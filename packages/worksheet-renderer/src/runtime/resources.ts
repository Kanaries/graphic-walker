import { PreparedDataError } from '../core/prepared';
import type { ReadVersion } from '../core/types';

export type ResourcePriority = 'metadata' | 'viewport' | 'continuation' | 'overscan' | 'export';
export type ResourcePartition = 'display' | 'export';
export type CacheLayer = 'metadata' | 'members' | 'domains' | 'data' | 'geometry';
export interface SharedResource {
    readonly value: object;
    readonly bytes: number;
}
export interface ReservationOptions {
    partition?: ResourcePartition;
    required?: boolean;
    shared?: readonly SharedResource[];
}
export interface ResourceOptions {
    maxConcurrent?: number;
    maxBytes?: number;
    maxEntries?: number;
    maxQueued?: number;
    requestTimeoutMs?: number;
}
export interface ResourceRequest<T> {
    key: string;
    version: ReadVersion;
    priority?: ResourcePriority;
    partition?: ResourcePartition;
    signal?: AbortSignal;
    run: (signal: AbortSignal) => Promise<T>;
}
export interface ResourceStats {
    active: number;
    queued: number;
    consumers: number;
    reads: number;
    deduplicated: number;
    cacheHits: number;
    evictions: number;
    bytes: number;
    reservedBytes: number;
    maxBytes: number;
    peakBytes: number;
    layers: Record<CacheLayer, { entries: number; bytes: number }>;
    partitions: Record<ResourcePartition, number>;
}
const priorities: Record<ResourcePriority, number> = { metadata: 0, viewport: 0, continuation: 1, overscan: 2, export: 3 };
export const versionKey = (version: ReadVersion) => JSON.stringify([version.sourceId, version.snapshotId, version.presentationId]);
export const abortError = () => new DOMException('The worksheet read was cancelled.', 'AbortError');
const limit = (message: string): never => {
    throw new PreparedDataError('resource-limit', message);
};

/** Retained-size estimate, not a heap measurement. Objects and immutable string
 * contents are counted once per traversal; every string reference still costs 8 bytes.
 * A structural copy may share its owner's immutable strings. Separate owners otherwise
 * count shared contents again, conservatively. */
export function estimateBytes(value: unknown, options: { sharedStrings?: boolean } = {}): number {
    const seen = new Set<object>(),
        strings = new Set<string>(),
        pending: unknown[] = [value];
    let bytes = 0;
    const string = (value: string) => {
        bytes += 8;
        if (!options.sharedStrings && !strings.has(value)) {
            strings.add(value);
            bytes += 16 + value.length * 2;
        }
    };
    while (pending.length) {
        const item = pending.pop();
        if (typeof item === 'string') string(item);
        else if (typeof item === 'number' || typeof item === 'bigint') bytes += 8;
        else if (typeof item === 'boolean') bytes += 4;
        else if (item && typeof item === 'object' && !seen.has(item)) {
            seen.add(item);
            bytes += 32;
            if (ArrayBuffer.isView(item)) bytes += item.byteLength;
            else if (item instanceof ArrayBuffer) bytes += item.byteLength;
            else if (item instanceof Map)
                for (const [key, value] of item) {
                    bytes += 24;
                    pending.push(key, value);
                }
            else if (item instanceof Set)
                for (const value of item) {
                    bytes += 16;
                    pending.push(value);
                }
            else
                for (const key of Object.keys(item)) {
                    bytes += 16;
                    string(key);
                    pending.push((item as Record<string, unknown>)[key]);
                }
            if (seen.size > 2_000_000) limit('One resource exceeds the bounded measurement traversal.');
        }
    }
    if (!Number.isSafeInteger(bytes)) limit('Resource byte estimate exceeds safe integer range.');
    return bytes;
}
interface Entry {
    layer: CacheLayer;
    key: string;
    partition: ResourcePartition;
    value: unknown;
    bytes: number;
    priority: ResourcePriority;
    touched: number;
}
interface Reservation {
    bytes: number;
    partition: ResourcePartition;
    shared: Map<object, number>;
}
interface SharedBase {
    bytes: number;
    display: number;
    export: number;
}
interface Consumer {
    partition: ResourcePartition;
    resolve(value: unknown): void;
    reject(error: unknown): void;
    detach(): void;
}
interface Job {
    id: string;
    version: string;
    priority: number;
    order: number;
    controller: AbortController;
    consumers: Set<Consumer>;
    started: boolean;
    ended: boolean;
    run(signal: AbortSignal): Promise<unknown>;
    timer?: ReturnType<typeof setTimeout>;
}

export function createResourceManager(options: ResourceOptions = {}) {
    const maxConcurrent = options.maxConcurrent ?? 4,
        maxBytes = options.maxBytes ?? 128 * 1024 * 1024,
        maxEntries = options.maxEntries ?? 2048,
        maxQueued = options.maxQueued ?? 1024,
        requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    if (![maxConcurrent, maxBytes, maxEntries, maxQueued, requestTimeoutMs].every((value) => Number.isSafeInteger(value) && value > 0))
        throw new Error('invalid-option: resource limits must be positive safe integers');
    const cache = new Map<string, Entry>(),
        reservations = new Map<string, Reservation>(),
        sharedBases = new Map<object, SharedBase>(),
        jobs = new Map<string, Job>(),
        running = new Set<Job>();
    let sharedSizes = new WeakMap<object, number>();
    let bytes = 0,
        reservedBytes = 0,
        peakBytes = 0,
        active = 0,
        sequence = 0,
        tick = 0,
        disposed = false,
        pumping = false;
    let reads = 0,
        deduplicated = 0,
        cacheHits = 0,
        evictions = 0;
    const cacheId = (layer: CacheLayer, key: string, partition: ResourcePartition) => JSON.stringify([partition, layer, key]);
    const remove = (id: string) => {
        const entry = cache.get(id);
        if (entry) {
            bytes -= entry.bytes;
            cache.delete(id);
        }
    };
    const room = (additional: number, except?: string, entryLimit = maxEntries) => {
        if (additional > maxBytes) return false;
        if (bytes + additional <= maxBytes && cache.size <= entryLimit) return true;
        const candidates = [...cache.entries()]
            .filter(([id]) => id !== except)
            .sort(
                ([, a], [, b]) =>
                    (b.partition === 'export' ? 1 : 0) - (a.partition === 'export' ? 1 : 0) ||
                    priorities[b.priority] - priorities[a.priority] ||
                    a.touched - b.touched,
            );
        for (const [id] of candidates) {
            if (bytes + additional <= maxBytes && cache.size <= entryLimit) break;
            remove(id);
            evictions++;
        }
        return bytes + additional <= maxBytes;
    };
    const updatePeak = () => {
        peakBytes = Math.max(peakBytes, bytes);
    };
    function finish(job: Job, error?: unknown, value?: unknown) {
        if (job.ended) return;
        if (job.timer) clearTimeout(job.timer);
        job.ended = true;
        job.controller.abort();
        if (jobs.get(job.id) === job) jobs.delete(job.id);
        if (job.started) {
            active--;
            running.delete(job);
        }
        for (const consumer of job.consumers) {
            consumer.detach();
            error === undefined ? consumer.resolve(value) : consumer.reject(error);
        }
        job.consumers.clear();
        pump();
    }
    function pump() {
        if (pumping || disposed) return;
        pumping = true;
        queueMicrotask(() => {
            pumping = false;
            if (disposed) return;
            const queued = [...jobs.values()]
                .filter((job) => !job.started && !job.ended)
                .sort((a, b) => a.priority - b.priority || a.order - b.order);
            for (const job of queued) {
                if (active >= maxConcurrent) break;
                job.started = true;
                active++;
                reads++;
                running.add(job);
                Promise.resolve()
                    .then(() => {
                        if (job.controller.signal.aborted) throw abortError();
                        return job.run(job.controller.signal);
                    })
                    .then(
                        (value) => finish(job, undefined, value),
                        (error) => finish(job, error),
                    );
            }
        });
    }
    return {
        schedule<T>(request: ResourceRequest<T>): Promise<T> {
            if (disposed || request.signal?.aborted) return Promise.reject(abortError());
            const id = JSON.stringify([versionKey(request.version), request.key]);
            let job = jobs.get(id);
            if (job) {
                deduplicated++;
                job.priority = Math.min(job.priority, priorities[request.priority ?? 'viewport']);
            } else {
                if (jobs.size >= maxQueued + maxConcurrent)
                    return Promise.reject(new PreparedDataError('resource-limit', 'Too many pending worksheet reads.'));
                job = {
                    id,
                    version: versionKey(request.version),
                    priority: priorities[request.priority ?? 'viewport'],
                    order: ++sequence,
                    controller: new AbortController(),
                    consumers: new Set(),
                    started: false,
                    ended: false,
                    run: request.run,
                };
                jobs.set(id, job);
                const timed = job;
                job.timer = setTimeout(() => {
                    timed.controller.abort();
                    for (const consumer of timed.consumers) {
                        consumer.detach();
                        consumer.reject(
                            new PreparedDataError('read-timeout', 'The source did not settle a read within the configured deadline.'),
                        );
                    }
                    timed.consumers.clear();
                    if (timed.started) {
                        if (jobs.get(timed.id) === timed) jobs.delete(timed.id);
                    } else finish(timed, abortError());
                }, requestTimeoutMs);
            }
            const target = job;
            const promise = new Promise<T>((resolve, reject) => {
                const cancel = () => {
                    target.consumers.delete(consumer);
                    consumer.detach();
                    reject(abortError());
                    if (!target.consumers.size) {
                        target.controller.abort();
                        if (target.started) {
                            if (target.timer) clearTimeout(target.timer);
                            jobs.delete(target.id);
                        } else finish(target, abortError());
                    }
                };
                const consumer: Consumer = {
                    partition: request.partition ?? 'display',
                    resolve: (value) => resolve(value as T),
                    reject,
                    detach: () => request.signal?.removeEventListener('abort', cancel),
                };
                target.consumers.add(consumer);
                request.signal?.addEventListener('abort', cancel, { once: true });
            });
            pump();
            return promise;
        },
        cacheGet<T>(layer: CacheLayer, key: string, partition: ResourcePartition = 'display'): T | undefined {
            const entry = cache.get(cacheId(layer, key, partition));
            if (!entry) return undefined;
            entry.touched = ++tick;
            cacheHits++;
            return entry.value as T;
        },
        cachePut<T>(
            layer: CacheLayer,
            key: string,
            value: T,
            config: { partition?: ResourcePartition; priority?: ResourcePriority; bytes?: number } = {},
        ): boolean {
            if (disposed) return false;
            const partition = config.partition ?? 'display',
                id = cacheId(layer, key, partition),
                valueBytes = config.bytes ?? estimateBytes(value);
            if (!Number.isSafeInteger(valueBytes) || valueBytes < 0) throw new Error('invalid-option: cache bytes must be nonnegative');
            const cost = valueBytes + 128 + estimateBytes([id, key]);
            if (!Number.isSafeInteger(cost)) return false;
            const old = cache.get(id),
                change = cost - (old?.bytes ?? 0);
            if (!room(change, id, old ? maxEntries : maxEntries - 1)) return false;
            if (old) bytes -= old.bytes;
            cache.set(id, { layer, key, partition, value, bytes: cost, priority: config.priority ?? 'viewport', touched: ++tick });
            bytes += cost;
            updatePeak();
            return true;
        },
        cacheRemove(layer: CacheLayer, key: string, partition: ResourcePartition = 'display') {
            remove(cacheId(layer, key, partition));
        },
        /** Shared immutable bases are charged once across live reservation owners.
         * Cache entries remain independently charged. Display owns a shared base's
         * partition attribution while any display owner retains it. */
        reserve(owner: string, cost: number, config: ReservationOptions = {}): boolean {
            if (disposed) throw abortError();
            if (!Number.isSafeInteger(cost) || cost < 0) throw new Error('invalid-option: reservation bytes must be nonnegative');
            const old = reservations.get(owner),
                shared = new Map<object, number>();
            for (const item of config.shared ?? []) {
                if (!item?.value || typeof item.value !== 'object' || !Number.isSafeInteger(item.bytes) || item.bytes < 0)
                    throw new Error('invalid-option: shared reservations require an object and nonnegative safe byte count');
                const known = shared.get(item.value) ?? sharedSizes.get(item.value);
                if (known !== undefined && known !== item.bytes)
                    throw new Error('invalid-option: one shared resource must retain the same byte count');
                shared.set(item.value, item.bytes);
            }
            let change = cost - (old?.bytes ?? 0);
            // Calculate the unique-base delta after replacement without first
            // releasing the committed owner or modifying shared reference counts.
            for (const [value, amount] of old?.shared ?? []) {
                const base = sharedBases.get(value)!;
                if (!shared.has(value) && base.display + base.export === 1) change -= amount;
            }
            for (const [value, amount] of shared) if (!sharedBases.has(value)) change += amount;
            if (!Number.isSafeInteger(change) || reservedBytes + change > maxBytes || !room(change)) {
                if (config.required === false) return false;
                return limit(`The required worksheet working set exceeds ${maxBytes} bytes.`);
            }
            const partition = config.partition ?? old?.partition ?? 'display';
            for (const value of old?.shared.keys() ?? []) {
                const base = sharedBases.get(value)!;
                base[old!.partition]--;
                if (!base.display && !base.export) sharedBases.delete(value);
            }
            for (const [value, amount] of shared) {
                sharedSizes.set(value, amount);
                let base = sharedBases.get(value);
                if (!base) {
                    base = { bytes: amount, display: 0, export: 0 };
                    sharedBases.set(value, base);
                }
                base[partition]++;
            }
            bytes += change;
            reservedBytes += change;
            reservations.set(owner, { bytes: cost, partition, shared });
            updatePeak();
            return true;
        },
        release(owner: string) {
            const old = reservations.get(owner);
            if (!old) return;
            let removed = old.bytes;
            for (const [value, amount] of old.shared) {
                const base = sharedBases.get(value)!;
                base[old.partition]--;
                if (!base.display && !base.export) {
                    sharedBases.delete(value);
                    removed += amount;
                }
            }
            bytes -= removed;
            reservedBytes -= removed;
            reservations.delete(owner);
        },
        /** Drop display consumers only by default: an export can still own the old version. */
        cancelVersion(version: ReadVersion, partition: ResourcePartition = 'display') {
            for (const job of jobs.values())
                if (job.version === versionKey(version)) {
                    for (const consumer of job.consumers)
                        if (consumer.partition === partition) {
                            consumer.detach();
                            consumer.reject(abortError());
                            job.consumers.delete(consumer);
                        }
                    if (!job.consumers.size) {
                        job.controller.abort();
                        if (job.started) {
                            if (job.timer) clearTimeout(job.timer);
                            jobs.delete(job.id);
                        } else finish(job, abortError());
                    }
                }
        },
        stats(): ResourceStats {
            const layers: ResourceStats['layers'] = {
                metadata: { entries: 0, bytes: 0 },
                members: { entries: 0, bytes: 0 },
                domains: { entries: 0, bytes: 0 },
                data: { entries: 0, bytes: 0 },
                geometry: { entries: 0, bytes: 0 },
            };
            const partitions = { display: 0, export: 0 };
            for (const item of cache.values()) {
                layers[item.layer].entries++;
                layers[item.layer].bytes += item.bytes;
                partitions[item.partition] += item.bytes;
            }
            for (const item of reservations.values()) partitions[item.partition] += item.bytes;
            for (const base of sharedBases.values()) partitions[base.display ? 'display' : 'export'] += base.bytes;
            return {
                active,
                queued: [...jobs.values()].filter((job) => !job.started).length,
                consumers: [...jobs.values()].reduce((n, job) => n + job.consumers.size, 0),
                reads,
                deduplicated,
                cacheHits,
                evictions,
                bytes,
                reservedBytes,
                maxBytes,
                peakBytes,
                layers,
                partitions,
            };
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const job of new Set([...jobs.values(), ...running])) {
                job.controller.abort();
                if (job.timer) clearTimeout(job.timer);
                for (const consumer of job.consumers) {
                    consumer.detach();
                    consumer.reject(abortError());
                }
                job.consumers.clear();
                if (!job.started) finish(job, abortError());
            }
            jobs.clear();
            cache.clear();
            reservations.clear();
            sharedBases.clear();
            sharedSizes = new WeakMap();
            bytes = 0;
            reservedBytes = 0;
        },
    };
}
export type ResourceManager = ReturnType<typeof createResourceManager>;
