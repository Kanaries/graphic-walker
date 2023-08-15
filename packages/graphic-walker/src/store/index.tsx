import React, { useContext, useMemo, useEffect, createContext } from 'react';
import { CommonStore } from './commonStore';
import { VizSpecStore } from './visualSpecStore';
import { IComputationFunction, IMutField, IRow } from '../interfaces';

function createKeepAliveContext<T, U extends any[]>(create: (...args: U) => T) {
    const dict: Record<string, T> = {};
    return (key?: string, ...args: U): T => {
        if (key) {
            if (!dict[key]) dict[key] = create(...args);
            return dict[key];
        } else {
            return create(...args);
        }
    };
}

const getCommonStore = createKeepAliveContext(() => new CommonStore());
const getVizStore = createKeepAliveContext(
    (
        meta: IMutField[],
        opts?: {
            empty?: boolean;
            onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;
        }
    ) => new VizSpecStore(meta, opts)
);

const StoreContext = React.createContext<CommonStore>(null!);
export const VisContext = React.createContext<VizSpecStore>(null!);
interface StoreWrapperProps {
    keepAlive?: boolean | string;
    storeRef?: React.MutableRefObject<CommonStore | null>;
    children?: React.ReactNode;
}

const noop = () => {};

export const StoreWrapper = (props: StoreWrapperProps) => {
    const storeKey = props.keepAlive ? `${props.keepAlive}` : '';
    const store = useMemo(() => getCommonStore(storeKey), [storeKey]);
    useEffect(() => {
        if (props.storeRef) {
            const ref = props.storeRef;
            ref.current = store;
            return () => {
                ref.current = null;
            };
        }
        return noop;
    }, [props.storeRef]);
    return <StoreContext.Provider value={store}>{props.children}</StoreContext.Provider>;
};

export function useGlobalStore() {
    return useContext(StoreContext);
}
interface VizStoreWrapperProps {
    keepAlive?: boolean | string;
    storeRef?: React.MutableRefObject<VizSpecStore | null>;
    children?: React.ReactNode;
    meta: IMutField[];
    onMetaChange?: (fid: string, meta: Partial<IMutField>) => void;
}

export const VizStoreWrapper = (props: VizStoreWrapperProps) => {
    const storeKey = props.keepAlive ? `${props.keepAlive}` : '';
    const store = useMemo(() => getVizStore(storeKey, props.meta, { onMetaChange: props.onMetaChange }), [storeKey]);
    useEffect(() => {
        if (props.storeRef) {
            const ref = props.storeRef;
            ref.current = store;
            return () => {
                ref.current = null;
            };
        }
        return noop;
    }, [props.storeRef]);
    return <VisContext.Provider value={store}>{props.children}</VisContext.Provider>;
};

export function useVizStore() {
    return useContext(VisContext);
}

export const ComputationContext = createContext<IComputationFunction>(async () => []);
