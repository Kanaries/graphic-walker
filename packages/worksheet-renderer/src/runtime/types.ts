import type { Axis, Diagnostic, MemberPath, ReadVersion, RenderDataSource, RenderPlan } from '../core/types';
import type { HitRegion } from '../scene/types';
import type { ResourceStats } from './resources';

export interface SelectionTarget {
    kind: 'datum' | 'segment';
    markId: string;
    paneKey: string;
    slotId: string;
    datumKeys: readonly string[];
    seriesKey?: string;
    /** Actual line hit in CSS pixels of the presented frame. */
    hitPoint?: Readonly<{ x: number; y: number }>;
    rowKey?: string;
    columnKey?: string;
    values: readonly {
        fieldRef: string;
        value: unknown;
        raw: unknown;
        datumKey?: string;
    }[];
}
export interface FocusTarget {
    markId?: string;
    headerKey?: string;
    rowKey?: string;
    columnKey?: string;
}
export interface ControlledViewState {
    selection?: readonly SelectionTarget[];
    focus?: FocusTarget;
    scroll?: { x?: number; y?: number };
}
export interface WorksheetInput {
    /** Optional for the complete-source shorthand. If supplied, all three IDs must match source.version. */
    version?: ReadVersion;
    plan: RenderPlan;
    source: RenderDataSource;
    backend?: 'canvas' | 'svg';
    viewState?: ControlledViewState;
    requestResults?: readonly {
        requestId: string;
        status: 'accepted' | 'rejected';
        reason?: string;
    }[];
}
export interface WorksheetOptions {
    autoResize?: boolean;
    width?: number;
    height?: number;
    dpr?: number;
    requestTimeoutMs?: number;
    accessibleName?: string;
    metrics?: boolean;
    /** Tighten the default 128 MiB runtime allowance. Source input/index and Canvas pixels are reported separately. */
    resourceBudgetBytes?: number;
    /** Prefetch at most one screen per direction, subject to the 100-pane working-set limit. */
    overscan?: boolean;
}
export interface UpdateReceipt {
    inputRevision: number;
    status: 'committed' | 'superseded' | 'rejected' | 'disposed';
    frameId?: number;
}
export interface EventVersion {
    inputRevision: number;
    version: ReadVersion;
    frameId: number;
}
export type LoadState = 'loading' | 'stale' | 'complete' | 'preview' | 'error' | 'disposed';
export interface HeaderRequestTarget {
    axis: Axis;
    key: string;
    path: MemberPath;
    fieldRef: string;
}
export interface ControlledRequest {
    requestId: string;
    basePresentationId: string;
    target: HeaderRequestTarget;
    kind: 'collapse' | 'sort';
    intent: { expanded: boolean } | { direction: 'ascending' | 'descending' };
}
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'superseded' | 'expired';
export interface WorksheetEvents {
    ready: EventVersion & { backend: 'canvas' | 'svg'; loadState: LoadState };
    selectionChange: EventVersion & {
        targets: readonly SelectionTarget[];
        operation: 'replace' | 'add' | 'toggle' | 'clear';
        source: 'pointer' | 'keyboard' | 'input';
    };
    collapseRequest: EventVersion & ControlledRequest;
    sortRequest: EventVersion & ControlledRequest;
    requestStateChange: EventVersion & {
        requestId: string;
        status: RequestStatus;
        reason?: string;
    };
    viewStateChange: EventVersion & {
        scrollX: number;
        scrollY: number;
        focus?: FocusTarget;
        source: string;
    };
    loadStateChange: EventVersion & {
        state: LoadState;
        requestedVersion: ReadVersion;
        message?: string;
    };
    diagnostic: Partial<EventVersion> & Diagnostic;
    metrics: EventVersion & {
        /** End-to-end render work, including asynchronous source waiting. */
        renderMs: number;
        readMs: number;
        sceneMs: number;
        submitMs: number;
        /** Synchronous validation/accounting/Scene/backend work. Does not claim to be browser presentation time. */
        cpuMs: number;
        marks: number;
        commands: number;
        cacheWindows: number;
        resources: ResourceStats;
    };
}

export function selectionTarget(hit: HitRegion, plan: RenderPlan): SelectionTarget {
    const records = hit.recordValues ?? [hit.values];
    const datumKeys = hit.datumKeys ?? [hit.datumKey];
    return {
        kind: hit.kind ?? 'datum',
        markId: hit.id,
        paneKey: hit.paneKey,
        slotId: hit.slotId ?? '',
        datumKeys: [...datumKeys],
        seriesKey: hit.seriesKey,
        hitPoint: hit.hitPoint ? { ...hit.hitPoint } : undefined,
        rowKey: hit.rowKey,
        columnKey: hit.columnKey,
        values: records.flatMap((record, index) =>
            plan.bindings
                .filter((binding) => Object.prototype.hasOwnProperty.call(record, binding.columnKey))
                .map((binding) => ({
                    fieldRef: binding.fieldRef,
                    value: record[binding.columnKey],
                    raw: record[binding.rawColumnKey ?? binding.columnKey],
                    datumKey: datumKeys[index],
                })),
        ),
    };
}
