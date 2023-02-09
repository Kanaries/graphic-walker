import React, { createContext, createElement, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo } from 'react';
import { makeAutoObservable, observable } from 'mobx';
import { PresentationChartLineIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import LayoutBlock from '../../components/feature/dashboard/block/layout-block/block';
import DataBlock from '../../components/feature/dashboard/block/data-block/block';
import type { WorkspaceBlockConfig, DashboardBlocks, DashboardBlockMap, DashboardBlockType } from './interfaces';


const subscribeBlock = <Type extends DashboardBlockType, T extends DashboardBlockMap[Type] = DashboardBlockMap[Type]>(
    type: T['type'],
    component: WorkspaceBlockConfig<Type>['onRender'],
    config: Omit<WorkspaceBlockConfig<Type>, 'type' | 'name' | 'onRender'>,
): WorkspaceBlockConfig<Type> => {
    return {
        ...config,
        type,
        name: type,
        onRender: component,
    };
};

export class WorkspaceStore {

    protected blockConfig: {
        readonly [key in keyof DashboardBlocks]: WorkspaceBlockConfig<key> | undefined;
    };

    public get block() {
        return this.blockConfig;
    }

    public constructor() {
        this.blockConfig = {
            layout: subscribeBlock('layout', LayoutBlock, {
                getIcon: ({ direction }) => (
                    <ViewColumnsIcon style={{ transform: direction === 'horizontal' ? '' : 'rotate(90deg)' }} />
                ),
                getTileDisplayName: data => (
                    <>{`${data.direction} layout`}</>
                ),
                onInspect: () => <></>,
            }),
            data: subscribeBlock('data', DataBlock, {
                getIcon: () => <PresentationChartLineIcon />,
                onInspect: () => <></>,
            }),
        };
        makeAutoObservable(this, {
            // @ts-expect-error nonpublic fields
            blockConfig: observable.ref,
        });
    }

    public destroy(): void {
        // do sth
    }

}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const WorkspaceContext = createContext<WorkspaceStore>(null!);

export const useWorkspaceContextProvider = (): FC<PropsWithChildren<unknown>> => {
    const definedContext = useWorkspaceContext();
    const context = useMemo(() => definedContext || new WorkspaceStore(), [definedContext]);

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
        return createElement(WorkspaceContext.Provider, { value: context }, children);
    }, [context]);
};

export const useWorkspaceContext = () => useContext(WorkspaceContext);

export const useBlockConfigs = (): WorkspaceStore['block'] => {
    const ctx = useWorkspaceContext();
    return ctx.block;
};
