import { useContext } from 'react';
import { themeContext } from '../context';
import { DataSourceSegmentComponent, GraphicWalker } from '@kanaries/graphic-walker';
import { getMemoryProvider } from '@kanaries/duckdb-computation';
import { promiseWrapper } from '../util';

const getProvider = promiseWrapper(getMemoryProvider());

export default function DataSourceSegment() {
    const { theme } = useContext(themeContext);
    const provider = getProvider();
    return (
        <DataSourceSegmentComponent dark={theme} provider={provider}>
            {(p) => {
                return (
                    <GraphicWalker
                        storeRef={p.storeRef}
                        computation={p.computation}
                        fields={p.meta}
                        onMetaChange={p.onMetaChange}
                        appearance={theme}
                        experimentalFeatures={{ computedField: true }}
                    />
                );
            }}
        </DataSourceSegmentComponent>
    );
}
