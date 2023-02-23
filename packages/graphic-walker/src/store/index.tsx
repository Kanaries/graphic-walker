import React, { useContext, useEffect } from 'react';
import { CommonStore } from './commonStore'
import { VizSpecStore } from './visualSpecStore'

interface GlobalStore {
    commonStore: CommonStore;
    vizStore: VizSpecStore;
}

const commonStore = new CommonStore();
const vizStore = new VizSpecStore(commonStore);

const initStore: GlobalStore = {
    commonStore,
    vizStore
}

const StoreContext = React.createContext<GlobalStore>(null!);

export function destroyGWStore() {
    initStore.commonStore.destroy();
    initStore.vizStore.destroy();
}

export function rebootGWStore() {
    const cs = new CommonStore();
    const vs = new VizSpecStore(cs);
    initStore.commonStore = cs;
    initStore.vizStore = vs;
}

interface StoreWrapperProps {
    keepAlive?: boolean;
}
export class StoreWrapper extends React.Component<StoreWrapperProps> {
    constructor(props: StoreWrapperProps) {
        super(props)
        if (props.keepAlive) {
            rebootGWStore();
        }
    }
    componentWillUnmount() {
        if (!this.props.keepAlive) {
            destroyGWStore();
        }
    }
    render() {
        return <StoreContext.Provider value={initStore}>
            { this.props.children }
        </StoreContext.Provider>
    }
}

export function useGlobalStore() {
    return useContext(StoreContext);
}
