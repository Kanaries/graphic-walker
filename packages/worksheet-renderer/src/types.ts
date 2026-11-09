export type Value = string | number | boolean | null | undefined;
export type Row = Record<string, any>;
export type Aggregate = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'distinctCount';
export interface FieldInstance {
    id: string;
    field: string;
    label: string;
    display: 'discrete' | 'continuous';
    aggregate?: Aggregate;
}
export type AxisExpr =
    | { kind: 'empty' }
    | { kind: 'field'; instanceId: string }
    | { kind: 'nest' | 'cross'; items: AxisExpr[] }
    | { kind: 'concat'; items: AxisExpr[] };
/**
 * shared: one range per measure for the whole sheet.
 * prefix: one range per measure inside each outermost header on the same axis.
 * independent: one range per row or column of panes.
 * A range never varies inside one row or column, so its axis can sit on the table edge.
 */
export type ScaleScope = 'shared' | 'independent' | 'prefix';
export interface WorksheetSpec {
    kind: 'worksheet';
    specVersion: 2;
    instances: Record<string, FieldInstance>;
    rows: AxisExpr;
    columns: AxisExpr;
    mark: 'bar' | 'point' | 'line' | 'rect' | 'text';
    color?: string;
    detail?: string[];
    /** Bars stack unless this is false. Unstacked bars overlap from the zero line. */
    stack?: boolean;
    scaleScope?: ScaleScope;
    sort?: 'ascending' | 'descending';
    filters?: { field: string; values: Value[] }[];
    /** Extent of one continuous axis slot. */
    pane?: { width?: number; height?: number };
    /** Step of one discrete member. Every member on an axis gets the same step. */
    band?: { width?: number; height?: number };
    /** Scale the steps so the sheet fills the available width, height or both. */
    fit?: 'width' | 'height' | 'both';
}
// A structural subset of Graphic Walker's IComputationFunction protocol.
// Keep the renderer independent of the host's React/store/query implementation.
export interface QueryPayload {
    workflow: (
        | { type: 'filter'; filters: { fid: string; rule: { type: 'one of'; value: any[] } }[] }
        | { type: 'view'; query: { op: 'aggregate'; groupBy: string[]; measures: { field: string; agg: Aggregate; asFieldKey: string }[] }[] }
    )[];
}
export type Computation = (payload: QueryPayload) => Promise<Row[]>;
export interface AxisBranch {
    id: string;
    facets: FieldInstance[];
    position?: FieldInstance;
    order: number;
}
export interface QueryTask {
    id: string;
    groupBy: string[];
    measures: FieldInstance[];
    payload: QueryPayload;
}
export interface Binding {
    row: AxisBranch;
    column: AxisBranch;
    taskId: string;
}
export interface Plan {
    spec: WorksheetSpec;
    rows: AxisBranch[];
    columns: AxisBranch[];
    tasks: QueryTask[];
    bindings: Binding[];
}
export interface PathPart { instanceId: string; value: Value }
export interface AxisScale { domain: [number, number]; ticks: number[] }
/**
 * One layout position along an axis. A discrete terminal field contributes one leaf per
 * member, a continuous terminal field one leaf per axis slot.
 */
export interface AxisLeaf {
    id: string;
    index: number;
    branch: AxisBranch;
    /** Header path: the facets, then the member when the terminal field is discrete. */
    path: PathPart[];
    kind: 'band' | 'continuous' | 'single';
    /** Index of the pane group this leaf belongs to. */
    group: number;
    offset: number;
    size: number;
    scale?: AxisScale;
}
/** The extent of a pane along one axis: a contiguous run of leaves below one facet path. */
export interface AxisGroup {
    id: string;
    index: number;
    branch: AxisBranch;
    path: PathPart[];
    /** Half-open leaf range. */
    start: number;
    end: number;
    offset: number;
    size: number;
}
export interface HeaderSpan {
    key: string;
    part: PathPart;
    /** Half-open leaf range. */
    start: number;
    end: number;
}
export interface AxisLayout {
    axis: 'row' | 'column';
    leaves: AxisLeaf[];
    groups: AxisGroup[];
    /** Header spans per level, ordered by leaf position. */
    levels: HeaderSpan[][];
    /** Field labels per header level. */
    captions: string[];
    size: number;
}
export interface Selection {
    /** Identity of the mark: its branch pair and dimension values. Survives scrolling and re-sorting. */
    id: string;
    paneId: string;
    rowPath: PathPart[];
    columnPath: PathPart[];
    predicates: { field: string; value: Value }[];
    values: Row;
}
export interface PaneMark {
    record: Row;
    /** Leaf indices on each axis. */
    row: number;
    column: number;
    /** Value interval on the continuous axis. NaN when the record has no value. */
    start: number;
    end: number;
}
export interface Pane {
    id: string;
    row: AxisGroup;
    column: AxisGroup;
    records: Row[];
    marks: PaneMark[];
    xDomain: [number, number];
    yDomain: [number, number];
}
/** Fixed chrome around the scrolling body, in CSS px. */
export interface Frame {
    left: number;
    top: number;
    bottom: number;
    rowHeaderWidths: number[];
    columnHeaderHeights: number[];
    /** The innermost column header level is drawn vertically. */
    rotateColumnLabels: boolean;
    columnCaptionHeight: number;
    yAxisWidth: number;
}
export interface WorksheetModel {
    plan: Plan;
    rows: AxisLayout;
    columns: AxisLayout;
    panes: Pane[];
    paneIndex: Map<string, Pane>;
    frame: Frame;
    width: number;
    height: number;
    colors: Value[];
}
export const field = (instanceId: string): AxisExpr => ({ kind: 'field', instanceId });
export const nest = (...items: AxisExpr[]): AxisExpr => ({ kind: 'nest', items });
export const concat = (...items: AxisExpr[]): AxisExpr => ({ kind: 'concat', items });
export const resultKey = (instance: FieldInstance) => instance.aggregate ? `__ws_${instance.id}` : instance.field;
