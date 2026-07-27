import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphicRenderer, GraphicWalker } from '../../src/root';
import { DataSourceSegmentComponent } from '../../src/dataSource';
import { ShadowDom } from '../../src/shadow-dom';
import { portalContainerContext } from '../../src/store/theme';
import { Dialog, DialogNormalContent, DialogTitle, DialogTrigger } from '../../src/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../src/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../src/components/ui/select';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../../src/components/ui/context-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../src/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../src/components/ui/tooltip';
import type { IDataSourceProvider, IMutField, IRow } from '../../src/interfaces';
import type { VizSpecStore } from '../../src/store/visualSpecStore';

declare global {
    interface Window {
        __issue501OpenVisualConfig?: () => boolean;
    }
}

const fields: IMutField[] = [
    {
        fid: 'category',
        name: 'Category',
        analyticType: 'dimension',
        semanticType: 'nominal',
    },
    {
        fid: 'order',
        name: 'Order',
        analyticType: 'dimension',
        semanticType: 'ordinal',
    },
    {
        fid: 'amount',
        name: 'Amount',
        analyticType: 'measure',
        semanticType: 'quantitative',
    },
];

const data: IRow[] = Array.from({ length: 120 }, (_, index) => ({
    category: ['Alpha', 'Beta', 'Gamma'][index % 3],
    order: index % 12,
    amount: (index + 1) * 7,
}));

const params = new URLSearchParams(window.location.search);
const scale = Number(params.get('scale') ?? '1');
const mode = params.get('mode') ?? 'app';
const fullscreen = params.get('fullscreen') === '1';
const disableContainment = params.get('contain') === 'none';
const hostWidth = Number(params.get('hostWidth'));
const hostHeight = Number(params.get('hostHeight'));
const hostShell = document.getElementById('host-shell')!;
const hostScroll = document.getElementById('host-scroll')!;
const rootElement = document.getElementById('root')!;
const storeRef = React.createRef<VizSpecStore>();

if (Number.isFinite(scale) && scale !== 1) {
    hostShell.style.transform = `scale(${scale})`;
    hostShell.dataset.scale = String(scale);
}

if (Number.isFinite(hostWidth) && hostWidth > 0) {
    hostShell.style.width = `${hostWidth}px`;
    rootElement.style.width = `${hostWidth}px`;
    rootElement.style.minWidth = `${hostWidth}px`;
}

if (Number.isFinite(hostHeight) && hostHeight > 0) {
    hostShell.style.height = `${hostHeight}px`;
    rootElement.style.height = `${hostHeight}px`;
    rootElement.style.minHeight = `${hostHeight}px`;
}

if (fullscreen) {
    Object.assign(hostShell.style, {
        position: 'fixed',
        inset: '0',
        width: '100vw',
        height: '100vh',
    });
    Object.assign(hostScroll.style, {
        width: '100vw',
        height: '100vh',
        border: '0',
        borderRadius: '0',
    });
    Object.assign(rootElement.style, {
        width: '100vw',
        height: '100vh',
        minWidth: '0',
        minHeight: '0',
    });
}

const dataSourceProvider: IDataSourceProvider = {
    addDataSource: async () => 'dataset',
    getDataSourceList: async () => [],
    getMeta: async () => [],
    setMeta: async () => undefined,
    getSpecs: async () => '[]',
    saveSpecs: async () => undefined,
    queryData: async () => [],
    registerCallback: () => () => undefined,
};

function DataSourceChildren() {
    return null;
}

function PrimitiveHarness() {
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    return (
        <ShadowDom style={{ width: '100%', height: '100%' }}>
            <portalContainerContext.Provider value={portal}>
                <TooltipProvider delayDuration={0}>
                    <div className="App flex flex-wrap items-start gap-6 bg-background p-12 text-foreground">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button data-testid="normal-dialog-trigger">Normal dialog</button>
                            </DialogTrigger>
                            <DialogNormalContent data-testid="normal-dialog-content" aria-label="Normal dialog">
                                <DialogTitle>Normal dialog surface</DialogTitle>
                            </DialogNormalContent>
                        </Dialog>

                        <Popover>
                            <PopoverTrigger asChild>
                                <button data-testid="popover-trigger">Popover</button>
                            </PopoverTrigger>
                            <PopoverContent data-testid="popover-content">Popover surface</PopoverContent>
                        </Popover>

                        <Select defaultValue="one">
                            <SelectTrigger data-testid="select-trigger" className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent data-testid="select-content">
                                <SelectItem value="one">Select one</SelectItem>
                                <SelectItem value="two">Select two</SelectItem>
                            </SelectContent>
                        </Select>

                        <ContextMenu>
                            <ContextMenuTrigger asChild>
                                <button data-testid="context-trigger">Context menu</button>
                            </ContextMenuTrigger>
                            <ContextMenuContent data-testid="context-content">
                                <ContextMenuItem>Context action</ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>

                        <HoverCard openDelay={0} closeDelay={0}>
                            <HoverCardTrigger asChild>
                                <button data-testid="hover-trigger">Hover card</button>
                            </HoverCardTrigger>
                            <HoverCardContent data-testid="hover-content">Hover surface</HoverCardContent>
                        </HoverCard>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button data-testid="tooltip-trigger">Tooltip</button>
                            </TooltipTrigger>
                            <TooltipContent data-testid="tooltip-content">Tooltip surface</TooltipContent>
                        </Tooltip>
                    </div>
                    <div ref={setPortal} />
                </TooltipProvider>
            </portalContainerContext.Provider>
        </ShadowDom>
    );
}

if (mode === 'data-source') {
    Object.assign(rootElement.style, {
        display: 'block',
        width: '640px',
        height: 'auto',
        minWidth: '0',
        minHeight: '0',
    });
    createRoot(rootElement).render(
        <DataSourceSegmentComponent provider={dataSourceProvider}>
            {DataSourceChildren}
        </DataSourceSegmentComponent>
    );
} else if (mode === 'primitives') {
    createRoot(rootElement).render(<PrimitiveHarness />);
} else if (mode === 'renderer') {
    createRoot(rootElement).render(
        <GraphicRenderer
            className="issue-501-renderer-host"
            fields={fields}
            data={data}
            style={{
                width: '100%',
                height: '100%',
                ...(disableContainment ? { contain: 'none' } : {}),
            }}
        />
    );
} else {
    window.__issue501OpenVisualConfig = () => {
        if (!storeRef.current) {
            return false;
        }
        storeRef.current.setShowVisualConfigPanel(true);
        return true;
    };
    createRoot(rootElement).render(
        <GraphicWalker
            fields={fields}
            data={data}
            storeRef={storeRef}
            style={{
                width: '100%',
                height: '100%',
                ...(disableContainment ? { contain: 'none' } : {}),
            }}
        />
    );
}

function markFixtureReady() {
    const host = rootElement.firstElementChild as HTMLElement | null;
    if (!host?.shadowRoot?.querySelector('.App, button, [role="tab"]')) {
        requestAnimationFrame(markFixtureReady);
        return;
    }
    if (!fullscreen) {
        window.scrollTo(240, 320);
        hostScroll.scrollTo(48, 72);
    }
    document.body.dataset.reproReady = 'true';
}

requestAnimationFrame(markFixtureReady);
