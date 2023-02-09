import { createContext, createElement, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo } from 'react';
import { IReactionDisposer, makeAutoObservable, observable, reaction } from 'mobx';
import type { DashboardSpecification, DashboardInfo, DashboardBlock, DashboardLayoutBlock } from './interfaces';
import { useGlobalStore } from '..';
import type { DataSet, IDataSet } from '../../interfaces';


export class DashboardStore {

    public dashboards: DashboardSpecification[];
    public dashboardIdx: number;

    public get dashboard(): DashboardSpecification | null {
        return this.dashboards[this.dashboardIdx] ?? null;
    }

    protected _selections: readonly DashboardBlock[];

    protected readonly reactions: IReactionDisposer[];

    public constructor() {
        this.dashboards = [];
        this.dashboardIdx = 0;
        this._selections = [];
        makeAutoObservable(this, {
            dashboards: observable.deep,
            // @ts-expect-error nonpublic fields
            _data: observable.ref,
            _selections: observable.ref,
        });
        this.reactions = [
            reaction(() => this.dashboard, () => {
                this._selections = [];
            }),
        ];
    }

    public destroy(): void {
        // do sth
        for (const dispose of this.reactions) {
            dispose();
        }
    }

    public setPageIdx(idx: number): void {
        this.dashboardIdx = idx;
    }

    public renamePage(idx: number, name: string): void {
        this.dashboards[idx].title = name;
    }

    public getBlockById(id: string): DashboardBlock | null {
        const page = this.dashboard;
        if (!page) {
            return null;
        }
        const search = (container: DashboardLayoutBlock): DashboardBlock | null => {
            if (container.id === id) {
                return container;
            }
            for (const child of container.children) {
                if (child.id === id) {
                    return child;
                } else if (child.type === 'layout') {
                    const which = search(child);
                    if (which) {
                        return which;
                    }
                }
            }
            return null;
        };
        return search(page.items);
    }

    public getBlockParent(id: string): DashboardLayoutBlock | null {
        const page = this.dashboard;
        if (!page) {
            return null;
        }
        const search = (container: DashboardLayoutBlock): DashboardLayoutBlock | null => {
            for (const child of container.children) {
                if (child.id === id) {
                    return container;
                } else if (child.type === 'layout') {
                    const which = search(child);
                    if (which) {
                        return child;
                    }
                }
            }
            return null;
        };
        return search(page.items) ?? page.items;
    }

    public get selections(): readonly DashboardBlock[] {
        return this._selections;
    }

    public toggleSelect(block: DashboardBlock, multiple = false): void {
        const selected = this._selections.findIndex(which => which === block);
        if (!multiple) {
            this._selections = selected ? [block] : [];
            return;
        }
        const next = this._selections.slice();
        if (selected === -1) {
            next.push(block);
        } else {
            next.splice(selected, 1);
        }
        this._selections = next;
    }

    public clearSelections(): void {
        this._selections = [];
    }

    public addPage(dataset: DataSet): void {
        let sameNameCount = 0;
        for (const dashboard of this.dashboards) {
            const pieces = dashboard.title.split(`${dataset.name} (`);
            if (pieces.length === 2) {
                const { idx } = /^(?<idx>\d+)\)$/.exec(pieces[1])?.groups ?? {};
                if (idx) {
                    sameNameCount = Math.max(sameNameCount, Number(idx));
                }
            }
        }
        this.dashboards.push({
            version: 1,
            datasetId: dataset.id,
            title: `${dataset.name} (${sameNameCount + 1})`,
            size: {
                width: 640,
                height: 480,
                padding: 16,
                spacing: 4,
            },
            items: {
                id: 'root',
                type: 'layout',
                direction: 'vertical',
                children: [],
            },
        });
    }

    public addBlock<T extends DashboardBlock>(target: string, block: T): void {
        const page = this.dashboard;
        if (!page) {
            return;
        }
        const destination = this.getBlockById(target);
        if (!destination) {
            page.items.children.push(block);
            this.toggleSelect(block);
            return;
        }
        if (destination.type === 'layout') {
            destination.children.push(block);
        } else {
            const parent = this.getBlockParent(target);
            if (!parent) {
                page.items.children.push(block);
                this.toggleSelect(block);
                return;
            }
            parent.children.push(block);
        }
        this.toggleSelect(block);
    }

    public removeBlock(id: string): void {
        const page = this.dashboard;
        if (!page) {
            return;
        }
        this._selections = this._selections.filter(d => d.id !== id);
        const walk = (container: DashboardLayoutBlock): void => {
            const next: DashboardBlock[] = [];
            for (const child of container.children) {
                if (child.id === id) {
                    continue;
                } else {
                    next.push(child);
                    if (child.type === 'layout') {
                        walk(child);
                    }
                }
            }
            container.children = next;
        };
        walk(page.items);
    }

    public moveBlocks(sources: DashboardBlock[], to: DashboardLayoutBlock, idx: number): void {
        for (const source of sources) {
            this.removeBlock(source.id);
        }
        to.children.splice(idx, 0, ...sources);
    }

    public updateBlock<T extends DashboardBlock, P extends Partial<T> = T>(id: string, updater: (prev: T) => P): void {
        const item = this.getBlockById(id) as null | T;
        if (item) {
            const next = updater(item) as unknown as T;
            for (const key of Object.keys(next) as (keyof T)[]) {
                if (item[key] !== next[key]) {
                    item[key] = next[key];
                }
            }
        }
    }

}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const DashboardContext = createContext<DashboardStore>(null!);

export const useDashboardContextProvider = (): FC<PropsWithChildren<unknown>> => {
    const definedContext = useDashboardContext();
    const context = useMemo(() => definedContext || new DashboardStore(), [definedContext]);

    useEffect(() => {
        if (!definedContext) {
            const ref = context;
            return () => {
                ref.destroy();
            };
        }
        return;
    }, [context, definedContext]);

    return useCallback(function DashboardContextProvider ({ children }) {
        return createElement(DashboardContext.Provider, { value: context }, children);
    }, [context]);
};

export const useDashboardContext = () => useContext(DashboardContext);

export const useDashboardInfo = (): DashboardInfo | null => {
    const { dashboard } = useContext(DashboardContext);
    if (dashboard) {
        return {
            title: dashboard.title,
        };
    }
    return null;
};

export const useDataSource = (): IDataSet | null => {
    const { commonStore } = useGlobalStore();
    const { dashboard } = useContext(DashboardContext);
    if (!dashboard) {
        return null;
    }
    return commonStore.datasets.find(ds => ds.id === dashboard.datasetId) ?? null;
};
