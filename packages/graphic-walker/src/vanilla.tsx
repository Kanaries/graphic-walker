import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
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

    if (hasData(props)) {
        createRoot(dom).render(<GraphicWalker themeKey="g2" {...props} />);
        return;
    }

    createRoot(dom).render(<FullGraphicWalker themeKey="g2" {...props} />);
}

export function embedGraphicRenderer(dom: HTMLElement | null, props: ILocalVizAppProps | undefined);
export function embedGraphicRenderer(dom: HTMLElement | null, props: IRemoteVizAppProps | undefined);
export function embedGraphicRenderer(dom, props = {}) {
    if (!dom) {
        throw 'DOM element not found.';
    }

    createRoot(dom).render(<GraphicRenderer themeKey="g2" {...props} />);
}

export function embedTableWalker(dom: HTMLElement | null, props: ILocalTableProps | undefined);
export function embedTableWalker(dom: HTMLElement | null, props: IRemoteTableProps | undefined);
export function embedTableWalker(dom, props = {}) {
    if (!dom) {
        throw 'DOM element not found.';
    }

    createRoot(dom).render(<TableWalker themeKey="g2" {...props} />);
}

export function embedPureRenderer(dom: HTMLElement | null, props: ILocalPureRendererProps);
export function embedPureRenderer(dom: HTMLElement | null, props: IRemotePureRendererProps);
export function embedPureRenderer(dom, props) {
    if (!dom) {
        throw 'DOM element not found.';
    }

    createRoot(dom).render(<PureRenderer themeKey="g2" {...props} />);
}
