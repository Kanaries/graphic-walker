import React, { type ForwardedRef, forwardRef, useState } from 'react';
import { DOMProvider } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { VizAppWithContext } from './App';
import { ShadowDom } from './shadow-dom';
import AppRoot from './components/appRoot';
import type {
    IGWHandler,
    IGWHandlerInsider,
    ITableProps,
    IVizAppProps,
    ILocalComputationProps,
    IRemoteComputationProps,
    IComputationProps,
    IVisualLayout,
} from './interfaces';

import './empty_sheet.css';
import { TableAppWithContext } from './Table';
import { RendererAppWithContext } from './Renderer';

export type ILocalVizAppProps = IVizAppProps &
    ILocalComputationProps &
    React.RefAttributes<IGWHandler> & {
        className?: string;
        style?: React.CSSProperties;
    };
export type IRemoteVizAppProps = IVizAppProps &
    IRemoteComputationProps &
    React.RefAttributes<IGWHandler> & {
        className?: string;
        style?: React.CSSProperties;
    };

export const GraphicWalker = observer(
    forwardRef<
        IGWHandler,
        IVizAppProps &
            (ILocalComputationProps | IRemoteComputationProps) & {
                className?: string;
                style?: React.CSSProperties;
            }
    >((props, ref) => {
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom
                    className={props.className}
                    style={props.style}
                    onMount={handleMount}
                    onUnmount={handleUnmount}
                    uiTheme={props.uiTheme ?? props.colorConfig}
                >
                    <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                        <VizAppWithContext {...props} />
                    </DOMProvider>
                </ShadowDom>
            </AppRoot>
        );
    })
) as {
    (p: ILocalVizAppProps): React.ReactNode;
    (p: IRemoteVizAppProps): React.ReactNode;
};

export type IRendererProps = {
    containerClassName?: string;
    containerStyle?: React.CSSProperties;
    overrideSize?: IVisualLayout['size'];
};

export const GraphicRenderer = observer(
    forwardRef<IGWHandler, IVizAppProps & IRendererProps & (ILocalComputationProps | IRemoteComputationProps)>((props, ref) => {
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom onMount={handleMount} onUnmount={handleUnmount} uiTheme={props.uiTheme ?? props.colorConfig}>
                    <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                        <RendererAppWithContext {...props} />
                    </DOMProvider>
                </ShadowDom>
            </AppRoot>
        );
    })
) as {
    (p: ILocalVizAppProps & IRendererProps): React.ReactNode;
    (p: IRemoteVizAppProps & IRendererProps): React.ReactNode;
};

export type ILocalTableProps = ITableProps &
    ILocalComputationProps &
    React.RefAttributes<IGWHandler> & {
        className?: string;
        style?: React.CSSProperties;
    };
export type IRemoteTableProps = ITableProps &
    IRemoteComputationProps &
    React.RefAttributes<IGWHandler> & {
        className?: string;
        style?: React.CSSProperties;
    };

export const TableWalker = observer(
    forwardRef<
        IGWHandler,
        ITableProps &
            IComputationProps & {
                className?: string;
                style?: React.CSSProperties;
            }
    >((props, ref) => {
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom
                    style={
                        props.style ?? {
                            width: '100%',
                            height: '100%',
                        }
                    }
                    className={props.className}
                    onMount={handleMount}
                    onUnmount={handleUnmount}
                    uiTheme={props.uiTheme ?? props.colorConfig}
                >
                    <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                        <TableAppWithContext {...props} />
                    </DOMProvider>
                </ShadowDom>
            </AppRoot>
        );
    })
) as {
    (p: ILocalTableProps): React.ReactNode;
    (p: IRemoteTableProps): React.ReactNode;
};
