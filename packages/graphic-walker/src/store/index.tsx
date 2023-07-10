import React, { useContext } from 'react';
import { CommonStore } from './commonStore'
import { VizSpecStore } from './visualSpecStore'

export interface IGlobalStore {
    commonStore: CommonStore;
    vizStore: VizSpecStore;
}

const commonStore = new CommonStore();
const vizStore = new VizSpecStore(commonStore);

const initStore: IGlobalStore = {
    commonStore,
    vizStore
};

const StoreContext = React.createContext<IGlobalStore>(null!);

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
    storeRef?: React.MutableRefObject<IGlobalStore | null>;
}
export class StoreWrapper extends React.Component<StoreWrapperProps> {
    constructor(props: StoreWrapperProps) {
        super(props)
        if (props.storeRef) {
            props.storeRef.current = initStore;
        }
        if (props.keepAlive) {
            rebootGWStore();
        }
    }
    componentWillUnmount() {
        if (!this.props.keepAlive) {
            if (this.props.storeRef) {
                this.props.storeRef.current = null;
            }
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
