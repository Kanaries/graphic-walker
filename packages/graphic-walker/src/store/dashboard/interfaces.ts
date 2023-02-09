import type { FC } from "react";
import type { VisualizationSpec } from 'vega-embed';
import type { Config as VegaLiteConfig } from 'vega-lite';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Static<T> = T extends Record<keyof any, any> ? {
    readonly [key in keyof T]: Static<T[key]>;
} : Readonly<T>;

export interface IRow {
    [key: string]: string | number | unknown;
}

export type DashboardEvent<NE extends Event = Event> = {
    nativeEvent: NE;
};

export type DashboardEventHandler = (ev: DashboardEvent) => void;

// eslint-disable-next-line @typescript-eslint/ban-types
export type IDashboardBlock<Name extends string, Data extends Record<string, unknown> = {}> = {
    id: string;
    type: Name;
} & Data;

export type DashboardLayoutBlock = IDashboardBlock<'layout', {
    direction: 'horizontal' | 'vertical';
    children: DashboardBlock[];
}>;

export type DashboardDataBlock = IDashboardBlock<'data', {
    /** vega-lite schema */
    specification: Omit<VisualizationSpec, 'data'>;
    config?: VegaLiteConfig;
}>;

export type DashboardBlocks = {
    layout: DashboardLayoutBlock,
    data: DashboardDataBlock,
};

export type DashboardBlockType = keyof DashboardBlocks;

export type DashboardBlockMap = {
    [key in keyof DashboardBlocks]: DashboardBlocks[key] & {
        type: key;
    };
};

export type DashboardBlock = DashboardBlockMap[keyof DashboardBlockMap];

export type DashboardSpecification = {
    version: number;
    datasetId: string;
    title: string;
    size: {
        width: number;
        height: number;
        padding: number;
        spacing: number;
    };
    items: DashboardLayoutBlock;
};

export type DashboardInfo = {
    title: string;
};

export type WorkspaceBlockConfig<Type extends DashboardBlockType, T extends DashboardBlock = DashboardBlockMap[Type]> = {
    type: Type;
    name: string;
    getIcon?: (data: T) => JSX.Element;
    getTileDisplayName?: (data: T) => JSX.Element;
    onRender: FC<{ data: T }>;
    onInspect: FC<{ data: T; onChange: (next: T) => void }>;
};
