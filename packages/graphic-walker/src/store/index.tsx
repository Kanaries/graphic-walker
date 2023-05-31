import React, { type FC, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import type { IKeepAliveMode } from '../interfaces';
import { CommonStore } from './commonStore'
import { VizSpecStore } from './visualSpecStore'

export interface IGlobalStore {
    commonStore: CommonStore;
    vizStore: VizSpecStore;
}

const KeepAliveSingleInstanceFlag: unique symbol = Symbol('KeepAliveSingleInstanceFlag');
interface IStoreKeepAliveMeta {
    value: IGlobalStore;
    reset(): void;
    refCount: number;
}
const keepAliveStoreMap = new Map<string | typeof KeepAliveSingleInstanceFlag, IStoreKeepAliveMeta>();

export const clearStoreCache = () => {
    for (const [key, meta] of keepAliveStoreMap.entries()) {
        if (meta.refCount === 0) {
            meta.reset();
            keepAliveStoreMap.delete(key);
        }
    }
    keepAliveStoreMap.clear();
};

const StoreContext = React.createContext<IGlobalStore>(null!);

interface StoreWrapperProps {
    keepAlive: IKeepAliveMode;
    storeRef?: React.MutableRefObject<IGlobalStore | null>;
    id?: string | undefined;
}

const createGWStores = (): IGlobalStore => {
    const cs = new CommonStore();
    const vs = new VizSpecStore(cs);
    return {
        commonStore: cs,
        vizStore: vs,
    };
};

export const StoreWrapper: FC<StoreWrapperProps> = ({ children, storeRef, keepAlive, id }) => {
    // init stores with keep-alive policy
    const storeMeta = useMemo<IStoreKeepAliveMeta | null>(() => {
        const key = keepAlive === 'single-instance' ? KeepAliveSingleInstanceFlag : id;
        if (keepAlive !== 'never' && key) {
            let meta = keepAliveStoreMap.get(key);
            if (!meta) {
                const value = createGWStores();
                meta = {
                    value,
                    reset() {
                        value.commonStore.destroy();
                        value.vizStore.destroy();
                    },
                    refCount: 0,
                };
                keepAliveStoreMap.set(key, meta);
            }
            return meta!;
        }
        return null;
    }, [keepAlive, id]);
    const initStores = useCallback((): IGlobalStore => {
        return storeMeta?.value ?? createGWStores();
    }, [storeMeta]);
    const [stores, setStores] = useState(initStores);
    useEffect(() => {
        setStores(initStores());
    }, [initStores]);

    // ref count
    useEffect(() => {
        if (!storeMeta) {
            return;
        }
        storeMeta.refCount += 1;
        return () => {
            storeMeta.refCount -= 1;
        };
    }, [storeMeta]);

    // post ref
    useEffect(() => {
        if (storeRef) {
            storeRef.current = stores;
            return () => {
                storeRef.current = storeMeta?.value ?? null;
            };
        }
    }, [storeMeta, storeRef, stores]);

    return (
        <StoreContext.Provider value={stores}>
            {children}
        </StoreContext.Provider>
    );
};

export function useGlobalStore() {
    return useContext(StoreContext);
}
