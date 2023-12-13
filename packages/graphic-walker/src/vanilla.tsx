import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DataSourceSegmentComponent, GraphicWalker, IGWProps } from './index';
import createMemoryProvider from './dataSourceProvider/memory';

function FullGraphicWalker(props: IGWProps) {
    const provider = useMemo(() => createMemoryProvider(), []);
    return (
        <DataSourceSegmentComponent provider={provider}>
            {(p) => {
                return (
                    <GraphicWalker
                        {...props}
                        storeRef={p.storeRef}
                        computation={p.computation}
                        rawFields={p.meta}
                        onMetaChange={p.onMetaChange}
                    />
                );
            }}
        </DataSourceSegmentComponent>
    );
}

export function embedGraphicWalker(dom: HTMLElement | null, props: IGWProps | undefined = {}) {
    if (!dom) {
        throw 'DOM element not found.';
    }
    // Example: Detect if Concurrent Mode is available
    const isConcurrentModeAvailable = 'createRoot' in ReactDOM;

    // Use the new ReactDOM.createRoot API if available, otherwise fall back to the old ReactDOM.render API
    if (isConcurrentModeAvailable) {
        if (import.meta.env.DEV) {
            console.warn(
                'React 18+ detected, remove strict mode if you meet drag and drop issue. more info at https://docs.kanaries.net/graphic-walker/faq/graphic-walker-react-18'
            );
        }
        // @ts-ignore
        const root = ReactDOM.createRoot(dom as HTMLElement);
        root.render(<FullGraphicWalker themeKey="g2" {...props} />);
    } else {
        ReactDOM.render(
            <React.StrictMode>
                <FullGraphicWalker themeKey="g2" {...props} />
            </React.StrictMode>,
            dom as HTMLElement
        );
    }
}
