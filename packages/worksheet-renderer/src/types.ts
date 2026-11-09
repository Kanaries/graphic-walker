export type Value = string | number | boolean | Date | null | undefined;
export type Row = Record<string, any>;
export type Aggregate = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'distinctCount';
export interface FieldInstance {
    id: string;
    field: string;
    label: string;
    display: 'discrete' | 'continuous';
    /** For a continuous field. 'time' reads Dates, ISO strings or epoch milliseconds and draws a calendar axis. */
    scale?: 'linear' | 'time';
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
    /** A discrete dimension gives one color per member. An aggregated measure gives a continuous scale. */
    color?: string;
    detail?: string[];
    /** The value written by text marks. Without it a text mark shows the measure it is positioned by. */
    text?: string;
    /** Bars stack unless this is false. Unstacked bars overlap from the zero line. */
    stack?: boolean;
    scaleScope?: ScaleScope;
    sort?: 'ascending' | 'descending';
    /**
     * Member order per field instance, overriding sort. A list gives the order outright,
     * as a host that has computed a ranking would; members it omits follow in value order.
     */
    order?: Record<string, 'ascending' | 'descending' | Value[]>;
    /** Where the innermost column headers go. By default at the bottom when rows carry a value axis, as in Tableau. */
    innerColumnHeader?: 'top' | 'bottom';
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
export interface AxisScale {
    domain: [number, number];
    ticks: number[];
    /** Tick labels when they are not plain numbers, as on a time axis. */
    labels?: string[];
    /** Smallest distance between two positions on this axis, in domain units. Sizes bars drawn at continuous positions. */
    step?: number;
}
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
export interface ColorScale { field: FieldInstance; domain: [number, number]; diverging: boolean }
export interface Frame {
    left: number;
    top: number;
    bottom: number;
    /** Width of the legend strip, 0 without a color field. */
    right: number;
    /** Height of the innermost column header level when it is drawn under the body, else 0. */
    bottomHeaderHeight: number;
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
    colorScale?: ColorScale;
}
export const field = (instanceId: string): AxisExpr => ({ kind: 'field', instanceId });
export const nest = (...items: AxisExpr[]): AxisExpr => ({ kind: 'nest', items });
export const concat = (...items: AxisExpr[]): AxisExpr => ({ kind: 'concat', items });
export const resultKey = (instance: FieldInstance) => instance.aggregate ? `__ws_${instance.id}` : instance.field;
