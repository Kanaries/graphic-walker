import { pathKey } from '../core/keys';
import type { ControlledRequest, HeaderRequestTarget, RequestStatus, WorksheetInput } from './types';
let registrySequence = 0;

/** Requests describe display intent. Only a host acknowledgement changes display state. */
export function createRequestRegistry(
    timeoutMs: number,
    changed: (request: ControlledRequest, status: RequestStatus, reason?: string) => void,
) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('invalid-option: requestTimeoutMs must be positive');
    let sequence = 0;
    const instance = ++registrySequence;
    const copy = (request: ControlledRequest) => structuredClone(request);
    const pending = new Map<string, { request: ControlledRequest; timer: ReturnType<typeof setTimeout> }>();
    const targetKey = (target: HeaderRequestTarget, kind: ControlledRequest['kind']) =>
        JSON.stringify([kind, target.axis, target.fieldRef, pathKey(target.path)]);
    const end = (id: string, status: Exclude<RequestStatus, 'pending'>, reason?: string) => {
        const entry = pending.get(id);
        if (!entry) return false;
        clearTimeout(entry.timer);
        pending.delete(id);
        changed(copy(entry.request), status, reason);
        return true;
    };
    return {
        create(
            basePresentationId: string,
            target: HeaderRequestTarget,
            kind: ControlledRequest['kind'],
            intent: ControlledRequest['intent'],
        ) {
            for (const [id, entry] of pending)
                if (targetKey(entry.request.target, entry.request.kind) === targetKey(target, kind))
                    end(id, 'superseded', 'A newer request replaced this intent');
            const request: ControlledRequest = copy({
                requestId: `request-${instance}-${++sequence}`,
                basePresentationId,
                target,
                kind,
                intent,
            });
            const timer = setTimeout(() => end(request.requestId, 'expired', 'The host did not acknowledge this request'), timeoutMs);
            pending.set(request.requestId, { request, timer });
            changed(copy(request), 'pending');
            return copy(request);
        },
        validate(results: WorksheetInput['requestResults'], basePresentationId: string) {
            const seen = new Set<string>();
            for (const result of results ?? []) {
                const entry = pending.get(result.requestId);
                if (!entry || seen.has(result.requestId) || entry.request.basePresentationId !== basePresentationId)
                    throw new Error('version-expired: request acknowledgement no longer matches a pending presentation');
                seen.add(result.requestId);
            }
        },
        commit(results: WorksheetInput['requestResults'], previousPresentation: string, nextPresentation: string) {
            for (const result of results ?? []) end(result.requestId, result.status, result.reason);
            if (previousPresentation !== nextPresentation)
                for (const [id, entry] of pending)
                    if (entry.request.basePresentationId !== nextPresentation)
                        end(id, 'superseded', 'A different presentation was committed');
        },
        reject: (id: string, reason: string) => end(id, 'rejected', reason),
        supersedeAll(reason: string) {
            for (const id of pending.keys()) end(id, 'superseded', reason);
        },
        snapshot: () => [...pending.values()].map(({ request }) => copy(request)),
        dispose() {
            for (const { timer } of pending.values()) clearTimeout(timer);
            pending.clear();
        },
    };
}
