import type { ExportLimits, ExportResources } from './types';
import { estimateBytes } from '../runtime/resources';

export const defaultExportLimits: Readonly<ExportLimits> = Object.freeze({
    maxPages: 128,
    maxReads: 2048,
    maxElapsedMs: 30_000,
    maxTotalBytes: 64 * 1024 * 1024,
    maxPageBytes: 4 * 1024 * 1024,
    maxPageElements: 10_000,
    maxPagePixels: 16_777_216,
    maxPageDimension: 32_768,
});
export class ExportError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(`${code}: ${message}`);
        this.name = 'WorksheetExportError';
    }
}
export function limitsFor(overrides: Partial<ExportLimits> = {}): ExportLimits {
    const result = { ...defaultExportLimits };
    for (const name of Object.keys(overrides)) {
        if (!(name in result)) throw new ExportError('unsupported-encoding', `Unknown export limit ${name}`);
        const key = name as keyof ExportLimits,
            value = overrides[key];
        if (value === undefined) continue;
        if (!Number.isSafeInteger(value) || value <= 0 || value > defaultExportLimits[key])
            throw new ExportError('resource-limit', `${key} must be a positive integer no greater than ${defaultExportLimits[key]}`);
        result[key] = value;
    }
    if (result.maxPageBytes > result.maxTotalBytes) result.maxPageBytes = result.maxTotalBytes;
    return result;
}
export function checkDimensions(width: number, height: number, limits: ExportLimits): void {
    if (![width, height].every((value) => Number.isFinite(value) && value > 0 && value <= limits.maxPageDimension) || width * height > limits.maxPagePixels)
        throw new ExportError('resource-limit', 'Export page dimensions exceed the bounded target size');
}
export function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException('Export cancelled', 'AbortError');
}
export function checkAbort(signal: AbortSignal): void {
    if (signal.aborted) throw abortReason(signal);
}
/** Every awaited host operation is abortable even when the host ignores its signal. */
export function withAbort<T>(operation: PromiseLike<T> | T, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            reject(abortReason(signal));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve(operation).then(
            (value) => {
                signal.removeEventListener('abort', onAbort);
                if (signal.aborted) reject(abortReason(signal));
                else resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            },
        );
        if (signal.aborted) onAbort();
    });
}
let nextTask = 0;
export function exportTask(resources: ExportResources, limits: ExportLimits, external?: AbortSignal) {
    const id = `export:${++nextTask}`,
        controller = new AbortController(),
        owners = new Set<string>(),
        started = performance.now();
    const abort = () => controller.abort(external?.reason ?? new DOMException('Export cancelled', 'AbortError'));
    if (external?.aborted) abort();
    else external?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new ExportError('resource-limit', 'Export elapsed-time limit exceeded')), limits.maxElapsedMs);
    return {
        id,
        signal: controller.signal,
        started,
        abort: (reason: unknown) => controller.abort(reason),
        check() {
            checkAbort(controller.signal);
            if (performance.now() - started > limits.maxElapsedMs) {
                controller.abort(new ExportError('resource-limit', 'Export elapsed-time limit exceeded'));
                checkAbort(controller.signal);
            }
        },
        reserve(kind: string, bytes: number) {
            const owner = `${id}:${kind}`;
            if (resources.reserve(owner, bytes, { partition: 'export', required: true }) === false)
                throw new ExportError('resource-limit', 'Export working set exceeds shared memory budget');
            owners.add(owner);
            return owner;
        },
        release(kind: string) {
            const owner = `${id}:${kind}`;
            resources.release(owner);
            owners.delete(owner);
        },
        dispose() {
            controller.abort(new DOMException('Export finished', 'AbortError'));
            clearTimeout(timer);
            external?.removeEventListener('abort', abort);
            for (const owner of owners) resources.release(owner);
            owners.clear();
        },
    };
}
/** Shared resource accounting plus headroom for export traversal and Scene index allocations. */
export function retainedBytes(value: unknown): number {
    return Math.ceil(estimateBytes(value) * 1.5);
}
