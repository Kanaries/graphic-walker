import React, { useContext, useMemo, useEffect, createContext, useRef } from 'react';
import { VizSpecStore } from './visualSpecStore';
import { IComputationFunction, IDefaultConfig, IMutField, IRow } from '../interfaces';

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

const getVizStore = createKeepAliveContext(
    (
        meta: IMutField[],
        opts?: {
            empty?: boolean;
            onMetaChange?: (fid: string, diffMeta: Partial<IMutField>) => void;
            defaultConfig?: IDefaultConfig;
        }
    ) => new VizSpecStore(meta, opts)
);

export const VisContext = React.createContext<VizSpecStore>(null!);

const noop = () => {};

interface VizStoreWrapperProps {
    keepAlive?: boolean | string;
    storeRef?: React.MutableRefObject<VizSpecStore | null>;
    children?: React.ReactNode;
    meta: IMutField[];
    onMetaChange?: (fid: string, meta: Partial<IMutField>) => void;
    defaultConfig?: IDefaultConfig;
}

export const VizStoreWrapper = (props: VizStoreWrapperProps) => {
    const storeKey = props.keepAlive ? `${props.keepAlive}` : '';
    const store = useMemo(() => getVizStore(storeKey, props.meta, { onMetaChange: props.onMetaChange, defaultConfig: props.defaultConfig }), [storeKey]);
    const lastMeta = useRef(props.meta);
    useEffect(() => {
        if (lastMeta.current !== props.meta) {
            store.setMeta(props.meta);
            lastMeta.current = props.meta;
        }
    }, [props.meta, store]);
    const lastOnMetaChange = useRef(props.onMetaChange);
    useEffect(() => {
        if (lastOnMetaChange.current !== props.onMetaChange) {
            store.setOnMetaChange(props.onMetaChange);
            lastOnMetaChange.current = props.onMetaChange;
        }
    }, [props.meta, store]);

    const lastDefaultConfig = useRef(props.defaultConfig);
    useEffect(() => {
        if (lastDefaultConfig.current !== props.defaultConfig) {
            store.setDefaultConfig(props.defaultConfig);
            lastDefaultConfig.current = props.defaultConfig;
        }
    }, [props.defaultConfig, store]);

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
