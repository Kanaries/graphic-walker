/** Internal rendering contracts. These types are not a persisted authoring format. */
export type Axis = 'row' | 'column';
export type PositionType = 'band' | 'linear' | 'time';
export type MarkType = 'bar' | 'point' | 'line' | 'rect' | 'text';
export type PreparedRecord = Readonly<Record<string, unknown>>;

export interface ReadVersion {
    readonly sourceId: string;
    readonly snapshotId: string;
    readonly presentationId: string;
}

export interface ResultBinding {
    readonly bindingId: string;
    readonly fieldRef: string;
    readonly columnKey: string;
    readonly valueType: 'string' | 'number' | 'boolean' | 'time' | 'interval';
    readonly positionType?: PositionType;
    readonly analyticType?: 'dimension' | 'measure';
    readonly label: string;
    readonly unitKey?: string;
    readonly rawColumnKey?: string;
}

export type ScalarValue =
    | { readonly type: 'null' }
    | { readonly type: 'string'; readonly value: string }
    | { readonly type: 'number'; readonly value: number }
    | { readonly type: 'boolean'; readonly value: boolean }
    | { readonly type: 'time'; readonly value: number };
export type TypedValue = ScalarValue | { readonly type: 'interval'; readonly start: ScalarValue; readonly end: ScalarValue };
export interface Member {
    readonly fieldRef: string;
    readonly value: TypedValue;
}
export type MemberPath = readonly Member[];

export interface AxisPlan {
    /** Actual joint member paths form nested headers, never a same-axis Cartesian product. */
    readonly facets: readonly string[];
    /** Empty means one default position; multiple entries are parallel measure slots. */
    readonly positions: readonly string[];
}

export type FieldChannel = { readonly fieldRef: string } | { readonly value: string | number | boolean | null };
export interface ScaleOptions {
    readonly type?: PositionType;
    readonly domain?: readonly unknown[];
    readonly domainMin?: number;
    readonly domainMax?: number;
    readonly zero?: boolean;
    readonly nice?: boolean;
    readonly reverse?: boolean;
    readonly range?: readonly (string | number)[];
    readonly scope?: { readonly mode: 'shared' } | { readonly mode: 'pane' } | { readonly mode: 'prefix'; readonly rowDepth: number; readonly columnDepth: number };
}
export interface AxisOptions {
    readonly title?: string | null;
    readonly format?: string;
    readonly grid?: boolean;
    readonly tickCount?: number;
    readonly hidden?: boolean;
}
export interface RenderStyle {
    readonly color?: string;
    readonly background?: string;
    readonly palette?: readonly string[];
    readonly opacity?: number;
    readonly pointSize?: number;
    readonly lineWidth?: number;
    readonly barWidth?: number;
    readonly fontFamily?: string;
    readonly fontSize?: number;
}
export interface RenderPlan {
    readonly bindings: readonly ResultBinding[];
    readonly rows: AxisPlan;
    readonly columns: AxisPlan;
    readonly mark: MarkType;
    /** Identifies the effective mark, stack, and series interpretation. */
    readonly domainPlanKey: string;
    readonly channels?: {
        readonly color?: FieldChannel;
        readonly size?: FieldChannel;
        readonly opacity?: FieldChannel;
        readonly shape?: FieldChannel;
        readonly text?: FieldChannel;
        readonly details?: readonly string[];
    };
    readonly stack?: 'none' | 'zero';
    readonly barLayout?: 'overlap' | 'grouped';
    readonly barOrientation?: 'horizontal' | 'vertical';
    readonly lineProgression?: 'x' | 'y';
    readonly scales?: Readonly<Record<string, ScaleOptions>>;
    readonly axes?: Readonly<Record<string, AxisOptions>>;
    readonly style?: RenderStyle;
}

export interface RankRange { readonly start: number; readonly end: number }
export interface PaneWindow { readonly rows: RankRange; readonly columns: RankRange }
export interface AxisLeaf {
    readonly key: string;
    readonly rank: number;
    readonly path: MemberPath;
    readonly slotId: string;
    readonly positionRef?: string;
    readonly bandDomainId?: string;
    readonly collapsed?: boolean;
}
export interface HeaderSpan {
    readonly key: string;
    readonly parentKey?: string;
    readonly path: MemberPath;
    readonly depth: number;
    readonly start: number;
    readonly end: number;
    readonly label: string;
    readonly kind?: 'member' | 'slot';
    readonly expanded?: boolean;
}
export interface AxisWindowRequest { readonly version: ReadVersion; readonly axis: Axis; readonly range: RankRange }
export interface AxisWindow {
    readonly version: ReadVersion;
    readonly axis: Axis;
    readonly range: RankRange;
    readonly leaves: readonly AxisLeaf[];
    readonly ancestors: readonly HeaderSpan[];
}
export interface LocateRequest {
    readonly version: ReadVersion;
    readonly axis: Axis;
    readonly key: string;
    readonly path?: MemberPath;
}
export type AxisLocation = { readonly version: ReadVersion } & (
    | { readonly status: 'found'; readonly rank: number; readonly leaf: AxisLeaf }
    | { readonly status: 'hidden'; readonly ancestor: HeaderSpan }
    | { readonly status: 'missing' }
);
export interface PaneRecord {
    readonly datumKey: string;
    readonly ordinal: number;
    readonly values: PreparedRecord;
    readonly sequenceOrder?: number;
    readonly seriesKey?: string;
    readonly seriesOrdinal?: number;
}
export interface PaneData {
    readonly key: string;
    readonly rowKey: string;
    readonly columnKey: string;
    readonly rowRank: number;
    readonly columnRank: number;
    readonly rowSlotId: string;
    readonly columnSlotId: string;
    readonly rowPath: MemberPath;
    readonly columnPath: MemberPath;
    readonly records: readonly PaneRecord[];
    readonly complete: boolean;
    readonly seriesCount?: number;
}
export interface PaneWindowRequest {
    readonly version: ReadVersion;
    readonly windows: readonly PaneWindow[];
    readonly cursor?: string;
}
export interface PaneBatch {
    readonly version: ReadVersion;
    /** Only omitted panes inside these rectangles are known to be empty. */
    readonly coveredWindows: readonly PaneWindow[];
    readonly panes: readonly PaneData[];
    readonly nextCursor?: string;
}
export interface DomainKey {
    readonly fieldRef: string;
    readonly channel: 'x' | 'y' | 'color' | 'size' | 'opacity' | 'shape';
    readonly familyId: string;
    readonly domainPlanKey: string;
    readonly scope: { readonly mode: 'shared' }
        | { readonly mode: 'prefix'; readonly rowPrefix: MemberPath; readonly columnPrefix: MemberPath }
        | { readonly mode: 'pane'; readonly paneKey: string };
}
export interface DisplayDomain {
    readonly fieldRef: string;
    readonly domainId: string;
    readonly type: PositionType;
    readonly values: readonly unknown[];
    readonly complete: boolean;
    readonly extentKind: 'value' | 'stacked';
    readonly empty: boolean;
    readonly source: 'prepared' | 'fixed' | 'unavailable';
    readonly key?: DomainKey;
}
export interface DomainRequest {
    readonly version: ReadVersion;
    readonly fieldRefs: readonly string[];
    /** Position scopes use canonical keys; fieldRefs request shared field domains. */
    readonly keys?: readonly DomainKey[];
}
export interface SeriesDomain {
    readonly domainId: string;
    /** Actual joint tuples, never the Cartesian product of color/details values. */
    readonly keys: readonly string[];
    readonly complete: boolean;
}
export interface DomainBatch {
    readonly version: ReadVersion;
    readonly domains: Readonly<Record<string, DisplayDomain>>;
    readonly series?: SeriesDomain;
}
export interface RenderDataManifest {
    readonly version: ReadVersion;
    readonly domainPlanKey: string;
    readonly rowLeafCount: number;
    readonly columnLeafCount: number;
    readonly recordCount: number;
    readonly nonEmptyPaneCount: number;
    readonly status: 'complete' | 'preview';
    readonly identityScope: 'stable' | 'snapshot';
    readonly capabilities: {
        readonly randomAxisAccess: boolean;
        readonly locateByKey: boolean;
        readonly maxAxisWindow: number;
        readonly maxPaneWindows: number;
        readonly domainPlanKeys: readonly string[];
    };
}
export interface RenderDataSource {
    readonly version: ReadVersion;
    describe(signal: AbortSignal): Promise<RenderDataManifest>;
    readAxis(request: AxisWindowRequest, signal: AbortSignal): Promise<AxisWindow>;
    locate(request: LocateRequest, signal: AbortSignal): Promise<AxisLocation>;
    readDomains(request: DomainRequest, signal: AbortSignal): Promise<DomainBatch>;
    readPaneData(request: PaneWindowRequest, signal: AbortSignal): Promise<PaneBatch>;
}
export interface MemberOrder {
    readonly axis: Axis;
    readonly parent: MemberPath;
    readonly fieldRef: string;
    readonly values: readonly TypedValue[];
}
export interface PreparedDataSourceOptions {
    readonly version: ReadVersion;
    readonly plan: RenderPlan;
    readonly records: readonly PreparedRecord[];
    readonly getDatumKey?: (record: PreparedRecord, ordinal: number) => string;
    readonly getOrdinal?: (record: PreparedRecord, inputIndex: number) => number;
    readonly getSequenceOrder?: (record: PreparedRecord, inputIndex: number) => number | undefined;
    /** Explicit visible member leaves, including supplied parent paths after collapse. */
    readonly axisMembers?: Partial<Readonly<Record<Axis, readonly { readonly path: MemberPath; readonly collapsed?: boolean }[]>>>;
    /** The host declares the actual prepared record grain. Hidden children never become parent records. */
    readonly getRecordPath?: (record: PreparedRecord, inputIndex: number, axis: Axis) => MemberPath;
    /** Optional order of complete joint series identities, generated with seriesIdentityFor. */
    readonly seriesOrder?: readonly string[];
    readonly memberOrder?: readonly MemberOrder[];
    readonly identityScope?: 'stable' | 'snapshot';
    /** A preview does not establish absent combinations as empty. */
    readonly complete?: boolean;
}
export interface Diagnostic {
    readonly code: string;
    readonly severity: 'info' | 'warning' | 'error';
    readonly recoverable: boolean;
    readonly fieldRef?: string;
    readonly configRef?: string;
    readonly message: string;
}
