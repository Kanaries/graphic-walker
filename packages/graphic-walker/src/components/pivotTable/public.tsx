import React, { useMemo } from 'react';
import type { IComputationFunction, IErrorHandlerProps, IFilterField, IRenderStatus, IRow, IThemeProps, IViewField } from '../../interfaces';
import { getComputation } from '../../computation/clientComputation';
import { ShadowDom } from '../../shadow-dom';
import { useCurrentMediaTheme } from '../../utils/media';
import type { IPivotTablePath } from './interface';
import { PivotTableCore } from './core';

interface PivotTableBaseProps extends IThemeProps, IErrorHandlerProps {
    /** Complete field catalog used to compile filters, expressions, and aggregations. */
    fields: readonly IViewField[];
    /** Controlled row shelf. Dimension and measure fields may both be supplied. */
    rows: readonly IViewField[];
    /** Controlled column shelf. Dimension and measure fields may both be supplied. */
    columns: readonly IViewField[];
    filters?: readonly IFilterField[];
    /**
     * Set false for raw leaf records. Every row/column dimension tuple must be unique;
     * add a row ID dimension when records would otherwise share a cell. Collapse and
     * table summaries are disabled because a raw subtotal is not well-defined. When
     * true (the default), every visible measure must define aggName.
     */
    defaultAggregated?: boolean;
    folds?: readonly string[];
    limit?: number;
    timezoneDisplayOffset?: number;
    /** Aggregated-mode subtotals. Ignored when defaultAggregated is false. */
    showTableSummary?: boolean;
    numberFormat?: string;
    disableCollapse?: boolean;
    collapsedPaths?: readonly IPivotTablePath[];
    defaultCollapsedPaths?: readonly IPivotTablePath[];
    /** Receives the complete next collapse state after a header interaction. */
    onCollapsedPathsChange?: (paths: IPivotTablePath[]) => void;
    onRenderStatusChange?: (status: IRenderStatus) => void;
    /** Per dispatched computation call; defaults to 60 seconds. Set to 0 to disable. */
    computationTimeout?: number;
    className?: string;
    style?: React.CSSProperties;
    emptyContent?: React.ReactNode;
}

export type ILocalPivotTableProps = PivotTableBaseProps & {
    data: readonly IRow[];
    computation?: never;
};

export type IRemotePivotTableProps = PivotTableBaseProps & {
    data?: never;
    computation: IComputationFunction;
};

export type PivotTableProps = ILocalPivotTableProps | IRemotePivotTableProps;

function withComputationTimeout(computation: IComputationFunction, timeout: number): IComputationFunction {
    if (!Number.isFinite(timeout) || timeout <= 0) {
        return computation;
    }
    return (payload) =>
        new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`PivotTable computation timed out after ${timeout}ms`)), timeout);
            Promise.resolve()
                .then(() => computation(payload))
                .then(resolve, reject)
                .finally(() => clearTimeout(timer));
        });
}

/**
 * Standalone PivotTable component.
 *
 * Pass `data` for the built-in browser computation, or pass `computation`
 * to execute Graphic Walker workflows in a remote or WASM-backed engine.
 */
export function PivotTable(props: PivotTableProps) {
    const {
        fields,
        rows,
        columns,
        filters,
        defaultAggregated,
        folds,
        limit,
        timezoneDisplayOffset,
        showTableSummary,
        numberFormat,
        disableCollapse,
        collapsedPaths,
        defaultCollapsedPaths,
        onCollapsedPathsChange,
        onRenderStatusChange,
        computationTimeout = 60_000,
        className,
        style,
        emptyContent,
        onError,
    } = props;
    const appearance = props.appearance ?? props.dark;
    const darkMode = useCurrentMediaTheme(appearance);
    const localData = 'data' in props ? props.data : undefined;
    const remoteComputation = 'computation' in props ? props.computation : undefined;
    const sourceComputation = useMemo<IComputationFunction>(
        () => (localData !== undefined ? getComputation([...localData]) : remoteComputation!),
        [localData, remoteComputation]
    );
    const computation = useMemo(
        () => withComputationTimeout(sourceComputation, computationTimeout),
        [sourceComputation, computationTimeout]
    );

    return (
        <ShadowDom containOverlays={false} className={className} style={style} uiTheme={props.uiTheme ?? props.colorConfig}>
            <div className={`App font-sans bg-background text-foreground w-full h-full ${darkMode === 'dark' ? 'dark' : ''}`}>
                <PivotTableCore
                    computation={computation}
                    fields={fields}
                    rows={rows}
                    columns={columns}
                    filters={filters}
                    defaultAggregated={defaultAggregated}
                    folds={folds}
                    limit={limit}
                    timezoneDisplayOffset={timezoneDisplayOffset}
                    showTableSummary={showTableSummary}
                    numberFormat={numberFormat}
                    disableCollapse={disableCollapse}
                    collapsedPaths={collapsedPaths}
                    defaultCollapsedPaths={defaultCollapsedPaths}
                    onCollapsedPathsChange={onCollapsedPathsChange}
                    onRenderStatusChange={onRenderStatusChange}
                    onError={onError}
                    emptyContent={emptyContent}
                />
            </div>
        </ShadowDom>
    );
}
