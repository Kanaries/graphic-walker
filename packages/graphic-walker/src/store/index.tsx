import React, { useContext, useMemo, useEffect } from 'react';
import { CommonStore } from './commonStore';
import { VizSpecStore } from './visualSpecStore';

export interface IGlobalStore {
    commonStore: CommonStore;
    vizStore: VizSpecStore;
}

const StoreDict: Record<string, IGlobalStore> = {};
const createStore = () => {
    const commonStore = new CommonStore();
    const vizStore = new VizSpecStore(commonStore);
    return {
        commonStore,
        vizStore,
    };
};
const getStore = (key?: string): IGlobalStore => {
    if (key) {
        if (!StoreDict[key]) StoreDict[key] = createStore();
        return StoreDict[key];
    } else {
        return createStore();
    }
};

const StoreContext = React.createContext<IGlobalStore>(null!);
interface StoreWrapperProps {
    keepAlive?: boolean | string;
    storeRef?: React.MutableRefObject<IGlobalStore | null>;
    children?: React.ReactNode;
}

const noop = () => {};

export const StoreWrapper = (props: StoreWrapperProps) => {
    const storeKey = props.keepAlive ? `${props.keepAlive}` : '';
    const store = useMemo(() => getStore(storeKey), [storeKey]);
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
    useEffect(() => {
        if (!storeKey) {
            return () => {
                store.commonStore.destroy();
                store.vizStore.destroy();
            };
        }
        return noop;
    }, [storeKey]);
    return <StoreContext.Provider value={store}>{props.children}</StoreContext.Provider>;
};

export function useGlobalStore() {
    return useContext(StoreContext);
}
