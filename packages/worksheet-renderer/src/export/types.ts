import type { PaneWindow, ReadVersion, RenderDataSource, RenderPlan } from '../core/types';
import type { LayoutMetrics } from '../scene/build';
import type { SceneFrame } from '../scene/types';
import type { ResourceManager } from '../runtime/resources';

/** Export leases share the worksheet's total resident-memory allowance. */
export interface ExportResources {
    reserve(owner: string, bytes: number, options?: { partition?: 'display' | 'export'; required?: boolean }): unknown;
    release(owner: string): void;
}
export interface ExportViewport {
    width: number;
    height: number;
    dpr?: number;
}
export interface ExportLimits {
    maxPages: number;
    maxReads: number;
    maxElapsedMs: number;
    maxTotalBytes: number;
    maxPageBytes: number;
    maxPageElements: number;
    maxPagePixels: number;
    maxPageDimension: number;
}
export interface ExportEstimate {
    pages: number;
    reads: number;
    bytes: number;
    workMs: number;
}
export interface ExportPageMetadata {
    name: string;
    format: 'svg' | 'png';
    version: ReadVersion;
    domainPlanKey: string;
    scope: 'viewport' | 'range';
    status: 'complete' | 'preview' | 'loading';
    includesPlaceholders: boolean;
    bytes: number;
    width: number;
    height: number;
    dpr?: number;
    range?: PaneWindow;
    scroll?: { x: number; y: number };
    page?: number;
    frameId?: number;
    fontFamily: string;
    fontSize: number;
}
export interface ExportPage {
    content: string;
    metadata: Readonly<ExportPageMetadata>;
}
export interface RangeExportOptions {
    range: PaneWindow | 'all';
    mode?: 'single' | 'pages';
    /** Positive rank counts; omitted counts are derived from the frozen viewport. */
    page?: { rows: number; columns: number };
    /** Called once per page. Consume or write the page before resolving; retaining it is caller-owned memory. */
    sink(page: ExportPage, signal: AbortSignal): Promise<void | { name?: string }> | void | { name?: string };
    filePrefix?: string;
    /** Limits can be tightened, never raised beyond the library hard ceilings. */
    limits?: Partial<ExportLimits>;
}
export interface RangeExportContext {
    plan: RenderPlan;
    source: RenderDataSource;
    viewport: ExportViewport;
    resources: ResourceManager;
    /** Optional host font generation; a change aborts this task rather than mixing geometry. */
    fontRevision?: () => string | number;
}
export interface RangeExportManifest {
    format: 'svg';
    version: ReadVersion;
    domainPlanKey: string;
    range: PaneWindow;
    viewport: ExportViewport;
    metrics: LayoutMetrics;
    status: 'complete';
    files: readonly Readonly<ExportPageMetadata>[];
    estimate: ExportEstimate;
    totals: { pages: number; reads: number; bytes: number; elapsedMs: number };
}
export interface ViewportExportSnapshot {
    frame: SceneFrame;
    version: ReadVersion;
    requestedVersion: ReadVersion;
    domainPlanKey: string;
    state: 'complete' | 'preview' | 'loading' | 'stale' | 'error' | 'disposed';
    scroll?: { x: number; y: number };
    range?: PaneWindow;
    fontFamily?: string;
    fontSize?: number;
    dpr?: number;
}
export interface ViewportExportOptions {
    format: 'svg' | 'png';
    includePlaceholders?: boolean;
    limits?: Partial<ExportLimits>;
}
