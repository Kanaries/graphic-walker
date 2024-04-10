import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { createMemoryProvider } from './dataSourceProvider/memory';
import { IGWProps } from './interfaces';
import { DataSourceSegmentComponent } from './dataSource';
import { GraphicRenderer, GraphicWalker, ILocalTableProps, ILocalVizAppProps, IRemoteTableProps, IRemoteVizAppProps, TableWalker } from './root';
import PureRenderer, { ILocalPureRendererProps, IRemotePureRendererProps } from './renderer/pureRenderer';

function FullGraphicWalker(props: IGWProps) {
    const provider = useMemo(() => createMemoryProvider(), []);
    return (
        <DataSourceSegmentComponent
            provider={provider}
            dark={props.dark}
            appearance={props.appearance}
            themeConfig={props.themeConfig}
            themeKey={props.themeKey}
            vizThemeConfig={props.vizThemeConfig}
            colorConfig={props.colorConfig}
            uiTheme={props.uiTheme}
        >
            {(p) => {
                return <GraphicWalker {...props} storeRef={p.storeRef} computation={p.computation} rawFields={p.meta} onMetaChange={p.onMetaChange} />;
            }}
        </DataSourceSegmentComponent>
    );
}

const hasData = (props: ILocalVizAppProps | IRemoteVizAppProps | IGWProps): props is ILocalVizAppProps | IRemoteVizAppProps =>
    'dataSource' in props || 'data' in props || 'computation' in props || 'rawFields' in props || 'fields' in props;

export function embedGraphicWalker(dom: HTMLElement | null, props: ILocalVizAppProps | undefined);
export function embedGraphicWalker(dom: HTMLElement | null, props: IRemoteVizAppProps | undefined);
export function embedGraphicWalker(dom: HTMLElement | null, props: IGWProps | undefined);
export function embedGraphicWalker(dom, props: IGWProps | ILocalVizAppProps | IRemoteVizAppProps = {}) {
    if (!dom) {
        throw 'DOM element not found.';
    }
    // Example: Detect if Concurrent Mode is available
    const isConcurrentModeAvailable = 'createRoot' in ReactDOM;

    if (hasData(props)) {
        if (isConcurrentModeAvailable) {
            if (import.meta.env.DEV) {
                console.warn(
                    'React 18+ detected, remove strict mode if you meet drag and drop issue. more info at https://docs.kanaries.net/graphic-walker/faq/graphic-walker-react-18'
                );
            }
            // @ts-ignore
            const root = ReactDOM.createRoot(dom as HTMLElement);
            root.render(<GraphicWalker themeKey="g2" {...props} />);
        } else {
            ReactDOM.render(
                <React.StrictMode>
                    <GraphicWalker themeKey="g2" {...props} />
                </React.StrictMode>,
                dom as HTMLElement
            );
        }
        return;
    }

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

export function embedGraphicRenderer(dom: HTMLElement | null, props: ILocalVizAppProps | undefined);
export function embedGraphicRenderer(dom: HTMLElement | null, props: IRemoteVizAppProps | undefined);
export function embedGraphicRenderer(dom, props = {}) {
    if (!dom) {
        throw 'DOM element not found.';
    }
    // Example: Detect if Concurrent Mode is available
    const isConcurrentModeAvailable = 'createRoot' in ReactDOM;

    if (isConcurrentModeAvailable) {
        if (import.meta.env.DEV) {
            console.warn(
                'React 18+ detected, remove strict mode if you meet drag and drop issue. more info at https://docs.kanaries.net/graphic-walker/faq/graphic-walker-react-18'
            );
        }
        // @ts-ignore
        const root = ReactDOM.createRoot(dom as HTMLElement);
        root.render(<GraphicRenderer themeKey="g2" {...props} />);
    } else {
        ReactDOM.render(
            <React.StrictMode>
                <GraphicRenderer themeKey="g2" {...props} />
            </React.StrictMode>,
            dom as HTMLElement
        );
    }
}

export function embedTableWalker(dom: HTMLElement | null, props: ILocalTableProps | undefined);
export function embedTableWalker(dom: HTMLElement | null, props: IRemoteTableProps | undefined);
export function embedTableWalker(dom, props = {}) {
    if (!dom) {
        throw 'DOM element not found.';
    }
    // Example: Detect if Concurrent Mode is available
    const isConcurrentModeAvailable = 'createRoot' in ReactDOM;

    if (isConcurrentModeAvailable) {
        if (import.meta.env.DEV) {
            console.warn(
                'React 18+ detected, remove strict mode if you meet drag and drop issue. more info at https://docs.kanaries.net/graphic-walker/faq/graphic-walker-react-18'
            );
        }
        // @ts-ignore
        const root = ReactDOM.createRoot(dom as HTMLElement);
        root.render(<TableWalker themeKey="g2" {...props} />);
    } else {
        ReactDOM.render(
            <React.StrictMode>
                <TableWalker themeKey="g2" {...props} />
            </React.StrictMode>,
            dom as HTMLElement
        );
    }
}

export function embedPureRenderer(dom: HTMLElement | null, props: ILocalPureRendererProps);
export function embedPureRenderer(dom: HTMLElement | null, props: IRemotePureRendererProps);
export function embedPureRenderer(dom, props) {
    if (!dom) {
        throw 'DOM element not found.';
    }
    // Example: Detect if Concurrent Mode is available
    const isConcurrentModeAvailable = 'createRoot' in ReactDOM;

    if (isConcurrentModeAvailable) {
        if (import.meta.env.DEV) {
            console.warn(
                'React 18+ detected, remove strict mode if you meet drag and drop issue. more info at https://docs.kanaries.net/graphic-walker/faq/graphic-walker-react-18'
            );
        }
        // @ts-ignore
        const root = ReactDOM.createRoot(dom as HTMLElement);
        root.render(<PureRenderer themeKey="g2" {...props} />);
    } else {
        ReactDOM.render(
            <React.StrictMode>
                <PureRenderer themeKey="g2" {...props} />
            </React.StrictMode>,
            dom as HTMLElement
        );
    }
}
