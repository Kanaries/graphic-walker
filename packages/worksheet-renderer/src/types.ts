/** A pair of numbers is a bin: the range of values one member of a binned field covers. */
export type Value = string | number | boolean | Date | null | undefined | readonly number[];
export type Row = Record<string, any>;
export type Aggregate = 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count' | 'distinctCount' | 'variance' | 'stdev';
export interface FieldInstance {
    id: string;
    field: string;
    label: string;
    display: 'discrete' | 'continuous';
    /**
     * 'time' reads Dates, ISO strings or epoch milliseconds. A continuous field then draws a
     * calendar axis; a discrete one labels its members as dates instead of raw values.
     */
    scale?: 'linear' | 'time';
    /** For a discrete time field: the calendar unit its members were truncated to, which picks the label. A full date without it. */
    timeUnit?: TimeUnit;
    /**
     * Milliseconds added to every time of this field before it is placed or labelled. Labels are
     * written in UTC, so a host that wants another zone passes that zone's offset here.
     * Stored times come in three kinds that a host may need to shift differently: `epoch` for
     * numbers and Dates, `date` for text that names a day, month or year only, which is read
     * as UTC, and `dateTime` for any other text, which is read in the machine's own zone
     * unless it names one.
     */
    timeOffset?: number | { epoch: number; date: number; dateTime: number };
    /** Whether a linear axis for this field starts from zero. Defaults to true; a time axis never does. */
    zero?: boolean;
    aggregate?: Aggregate;
}
/**
 * Settings of the value axes on one shelf, or of one channel. What is left out follows the data.
 */
export interface ScaleOptions {
    type?: import('./warp').ScaleType;
    /** Fixed ends of the range. Marks outside a fixed axis range are cut off at the edge of their pane. */
    min?: number;
    max?: number;
    /**
     * Channels only: what the lowest and the highest value turn into. For opacity, two numbers
     * between 0 and 1. For size, px: the area of a point in square px, the thickness of a bar,
     * the length of a tick, the width of a line, the font size of text.
     */
    range?: [number, number];
    /** Channels with a continuous field only: every pane ranges over its own values, and the legend names no numbers. */
    independent?: boolean;
}
export type TimeUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'iso_year' | 'iso_week';
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
    /**
     * point is a hollow circle, circle a filled one, tick a short line across the value axis.
     * area fills from the start of each mark's interval to its end, joined along the other axis.
     * arc draws one pie per cell of the table; rows and columns then take dimensions only.
     * boxplot summarises the records of each member along the one continuous axis.
     */
    mark: 'bar' | 'point' | 'circle' | 'tick' | 'line' | 'area' | 'rect' | 'text' | 'arc' | 'boxplot';
    /** A discrete field gives one color per member. A continuous field, aggregated or not, gives a continuous scale. */
    color?: string;
    /**
     * Dimensions that split marks without coloring them. For a box plot they only set the
     * grain of the records a box summarises; boxes are split by color alone.
     */
    detail?: string[];
    /** The measure that sizes the slices of arc marks. Without it every slice gets the same share. */
    angle?: string;
    /**
     * The value written by text marks; without it a text mark shows the measure it is positioned
     * by. On any other mark it is a label written next to the mark, or inside it where it fits.
     * Labels that would run into each other are left out.
     */
    text?: string;
    /**
     * Sizes marks by a field: the area of points, the thickness of bars, the length of ticks, the
     * width of lines, the font size of text, the side of heat map cells. A measure sizes from
     * zero; a dimension gives each member its own step.
     */
    size?: string;
    /** Makes marks more or less opaque by a field. A dimension gives each member its own step. */
    opacity?: string;
    /** Gives each member of a dimension its own symbol. Only point and circle marks have one. */
    shape?: string;
    /** `rows` and `columns` apply to every value axis on that shelf, time axes excepted. */
    scales?: { rows?: ScaleOptions; columns?: ScaleOptions; color?: ScaleOptions; size?: ScaleOptions; opacity?: ScaleOptions };
    /**
     * How bars and areas that share a position pile up. They stack end to end unless this is
     * false, in which case they overlap from the zero line. 'normalize' stacks their shares of
     * the pile, so every pile runs from 0 to 100%. 'center' stacks them end to end with the
     * pile centered on zero. Both of those pile magnitudes, whatever the sign.
     */
    stack?: boolean | 'normalize' | 'center';
    scaleScope?: ScaleScope;
    sort?: 'ascending' | 'descending';
    /**
     * Member order per field instance, overriding sort. A list gives the order outright;
     * members it omits follow in value order. A measure orders the members by its value.
     */
    order?: Record<string, 'ascending' | 'descending' | Value[] | MeasureOrder>;
    /**
     * Keeps only the first `rows` records of each result, as a query limit does. With `by`
     * the records are first ordered by that field, which makes it a top or bottom N.
     */
    limit?: { rows: number; by?: string; direction?: 'ascending' | 'descending' };
    /** Where the innermost column headers go. By default at the bottom when rows carry a value axis, as in Tableau. */
    innerColumnHeader?: 'top' | 'bottom';
    filters?: { field: string; values: Value[] }[];
    /** Extent of one continuous axis slot. */
    pane?: { width?: number; height?: number };
    /** Step of one discrete member. Every member on an axis gets the same step. */
    band?: { width?: number; height?: number };
    /** Scale the steps so the sheet fills the available width, height or both. */
    fit?: 'width' | 'height' | 'both';
    /**
     * Lets the continuous axis slots share the room the window leaves over, in width, height or
     * both. Member steps keep their size, so three bars stay three narrow bars in a wide window.
     * A sheet that does not fit with every slot at its least size scrolls. Pies grow as squares,
     * and only with 'both'. Where `fit` is set too, `fit` wins.
     */
    stretch?: 'width' | 'height' | 'both';
}
/**
 * Orders the members of a dimension by an aggregated measure. The measure is computed per
 * member inside its parent headers on the same axis, over everything else in the sheet, so
 * each parent group is ordered on its own, as Tableau's nested sort is. Members without a
 * value come last in either direction.
 */
export interface MeasureOrder { by: string; direction?: 'ascending' | 'descending' }
// A structural subset of Graphic Walker's IComputationFunction protocol.
// Keep the renderer independent of the host's React/store/query implementation.
export interface QueryPayload {
    workflow: (
        | { type: 'filter'; filters: { fid: string; rule: { type: 'one of'; value: any[] } }[] }
        | { type: 'view'; query: ViewQuery[] }
        | { type: 'sort'; by: string[]; sort: 'ascending' | 'descending' }
    )[];
    /** Number of result rows to return, counted after every step. */
    limit?: number;
}
/** 'raw' returns the listed fields of every source row, duplicates included. Only box plots of an unaggregated field ask for it. */
export type ViewQuery =
    | { op: 'aggregate'; groupBy: string[]; measures: { field: string; agg: Aggregate; asFieldKey: string }[] }
    | { op: 'raw'; fields: string[] };
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
    /** Every source row is wanted, not one row per group. */
    raw?: boolean;
    payload: QueryPayload;
}
export interface Binding {
    row: AxisBranch;
    column: AxisBranch;
    taskId: string;
}
/** Where the values that order the members of one field under one chain of parent fields come from. */
export interface Ranking {
    instanceId: string;
    /** The fields above it on its axis, outermost first. */
    parents: FieldInstance[];
    by: FieldInstance;
    direction: 'ascending' | 'descending';
    taskId: string;
}
export interface Plan {
    spec: WorksheetSpec;
    rows: AxisBranch[];
    columns: AxisBranch[];
    tasks: QueryTask[];
    bindings: Binding[];
    rankings: Ranking[];
}
export interface PathPart { instanceId: string; value: Value }
export interface AxisScale {
    domain: [number, number];
    ticks: number[];
    /** Tick labels when they are not plain numbers, as on a time axis. */
    labels?: string[];
    /** Smallest distance between two positions on this axis, in domain units. Sizes bars drawn at continuous positions. */
    step?: number;
    /** Names the range this axis shows. Every leaf that shares the range has the same key; a zoom is stored under it. */
    key?: string;
    /** The range the data and the axis settings ask for. It differs from `domain` while the axis is zoomed or panned. */
    full?: [number, number];
    /** How values are spread along the axis. Linear when absent. */
    type?: import('./warp').ScaleType;
    /** An end of the range was set by hand, so some marks may lie outside it. */
    fixed?: boolean;
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
    /**
     * Value interval on the continuous axis. NaN when the record has no value.
     * For an arc, the slice as shares of a full turn. For a box, the whisker ends.
     */
    start: number;
    end: number;
    /** Under a normalized stack: the mark's share of its pile, between 0 and 1. */
    share?: number;
    /** Set on the one mark that stands for a whole box. Its record holds the dimensions and the median. */
    box?: BoxSummary;
    /** A record outside the whiskers of its box, drawn on its own. */
    outlier?: boolean;
    /** Which share of the member step the mark takes when several series sit side by side: index and count. */
    slot?: [number, number];
}
/** Tukey box: quartiles, and whiskers at the furthest records within 1.5 times the box length. */
export interface BoxSummary { low: number; q1: number; median: number; q3: number; high: number; count: number }
export interface Pane {
    id: string;
    row: AxisGroup;
    column: AxisGroup;
    records: Row[];
    marks: PaneMark[];
    xDomain: [number, number];
    yDomain: [number, number];
    /** The pane's own range on a channel that is set to range independently. */
    domains?: { color?: [number, number]; size?: [number, number]; opacity?: [number, number] };
}
/** Fixed chrome around the scrolling body, in CSS px. */
export interface ColorScale { field: FieldInstance; domain: [number, number]; diverging: boolean; type?: import('./warp').ScaleType }
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
    /** How numbers, dates and the sheet's own words are written. */
    format: import('./formats').Format;
    /** The spans of the fields on size and opacity, and the members of the field on shape. */
    channels: { size?: import('./channels').ChannelScale; opacity?: import('./channels').ChannelScale; shape?: import('./channels').ChannelScale };
    /** What the legend strip shows, top to bottom. */
    legends: import('./channels').LegendBlock[];
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
