import { ChartBarIcon, PresentationChartBarIcon } from "@heroicons/react/24/outline";
import { makeAutoObservable } from "mobx";
import type { ComponentProps, FC } from 'react';


export enum PrimaryMenuKey {
    chart = 'chart',
    dashboard = 'dashboard',
}

export const PrimaryMenuItems: readonly Readonly<{
    key: PrimaryMenuKey;
    icon: FC<ComponentProps<'svg'>>;
}>[] = [
    {
        key: PrimaryMenuKey.chart,
        icon: ChartBarIcon,
    },
    {
        key: PrimaryMenuKey.dashboard,
        icon: PresentationChartBarIcon,
    },
];

export class ViewStore {
    
    public showPrimarySideBar: boolean;
    public primaryMenuKey: PrimaryMenuKey;

    constructor() {
        this.showPrimarySideBar = true;
        this.primaryMenuKey = PrimaryMenuKey.chart;
        makeAutoObservable(this, {});
    }

    public togglePrimarySideBar(show?: boolean): void {
        this.showPrimarySideBar = show ?? !this.showPrimarySideBar;
    }

    public setPrimaryMenuKey(key: PrimaryMenuKey): void {
        this.primaryMenuKey = key;
    }

}
