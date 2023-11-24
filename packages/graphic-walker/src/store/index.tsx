import React, { useContext, useMemo, useEffect, createContext, useRef, useCallback } from 'react';
import { CommonStore } from './commonStore';
import { VizSpecStore } from './visualSpecStore';
import { IComputationFunction, IMutField, ISpecChange } from '../interfaces';

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
            onSpecChange?: (change: ISpecChange) => void;
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
    }, [props.storeRef, store]);
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
    onSpecChange?: (change: ISpecChange) => void;
}

function useRefSyncer<T>(item: T, sync: (item: T) => void, syncDeps: any[]) {
    const ref = useRef(item);
    const syncF = useCallback(sync, syncDeps);
    useEffect(() => {
        if (ref.current !== item) {
            syncF(item);
            ref.current = item;
        }
    }, [item, syncF]);
}

export const VizStoreWrapper = (props: VizStoreWrapperProps) => {
    const storeKey = props.keepAlive ? `${props.keepAlive}` : '';
    const store = useMemo(() => getVizStore(storeKey, props.meta, { onMetaChange: props.onMetaChange, onSpecChange: props.onSpecChange }), [storeKey]);
    useRefSyncer(props.meta, (x) => store.setMeta(x), [store]);
    useRefSyncer(props.onMetaChange, (x) => store.setOnMetaChange(x), [store]);
    useRefSyncer(props.onSpecChange, (x) => store.setOnSpecChange(x), [store]);

    useEffect(() => {
        if (props.storeRef) {
            const ref = props.storeRef;
            ref.current = store;
            return () => {
                ref.current = null;
            };
        }
        return noop;
    }, [props.storeRef, store]);
    return <VisContext.Provider value={store}>{props.children}</VisContext.Provider>;
};

export function useVizStore() {
    return useContext(VisContext);
}

export const ComputationContext = createContext<IComputationFunction>(async () => []);

export function useCompututaion() {
    return useContext(ComputationContext);
}

export function withTimeout<T extends any[], U>(f: (...args: T) => Promise<U>, timeout: number) {
    return (...args: T) =>
        Promise.race([
            f(...args),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), timeout);
            }),
        ]);
}

export function withErrorReport<T extends any[], U>(f: (...args: T) => Promise<U>, onError: (err: string | Error) => void) {
    return (...args: T) =>
        f(...args).catch((err) => {
            onError(err);
            throw err;
        });
}
