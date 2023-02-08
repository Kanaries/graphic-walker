import React, { useContext, useEffect } from 'react';
import { CommonStore } from './commonStore'
import { ViewStore } from './viewStore';
import { VizSpecStore } from './visualSpecStore'

interface GlobalStore {
    commonStore: CommonStore;
    vizStore: VizSpecStore;
    viewStore: ViewStore;
}

const commonStore = new CommonStore();
const vizStore = new VizSpecStore(commonStore);
const viewStore = new ViewStore();

const initStore: GlobalStore = {
    commonStore,
    vizStore,
    viewStore,
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

export class StoreWrapper extends React.Component<{ keepAlive?: boolean }> {
    constructor(props: { keepAlive?: boolean }) {
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
