import test from 'node:test';
import assert from 'node:assert/strict';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { createWorksheet } from '../src/runtime/worksheet';
import { createPreparedDataSource } from '../src/core/prepared';
import type { RenderDataSource } from '../src/core/types';
import type { HitRegion } from '../src/scene/types';
import type { WorksheetEvents } from '../src/runtime/types';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';

/** State/lifecycle test doubles only. Browser layout, pixels and input delivery need browser tests. */
function installDom() {
    type Listener = (event: Record<string, unknown>) => void;
    class Element {
        children: Element[] = [];
        parent?: Element;
        style: Record<string, string> = {};
        attrs = new Map<string, string>();
        listeners = new Map<string, Set<Listener>>();
        clientWidth = 1000;
        clientHeight = 700;
        scrollLeft = 0;
        scrollTop = 0;
        hidden = false;
        textContent = '';
        tabIndex = -1;
        constructor(readonly tagName = 'div') {}
        get firstChild(): Element | null {
            return this.children[0] ?? null;
        }
        get nextSibling(): Element | null {
            return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
        }
        getAttribute(name: string) {
            return this.attrs.get(name) ?? null;
        }
        removeAttribute(name: string) {
            this.attrs.delete(name);
        }
        insertBefore(child: Element, before: Element) {
            child.remove();
            this.children.splice(this.children.indexOf(before), 0, child);
            child.parent = this;
            return child;
        }
        appendChild(child: Element) {
            child.remove();
            this.children.push(child);
            child.parent = this;
            return child;
        }
        append(...children: Element[]) {
            children.forEach((child) => this.appendChild(child));
        }
        prepend(child: Element) {
            child.remove();
            this.children.unshift(child);
            child.parent = this;
        }
        remove() {
            if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
            this.parent = undefined;
        }
        replaceChildren(...children: Element[]) {
            for (const child of this.children) child.parent = undefined;
            this.children = [];
            this.append(...children);
        }
        setAttribute(name: string, value: string) {
            this.attrs.set(name, value);
        }
        addEventListener(name: string, listener: Listener) {
            const listeners = this.listeners.get(name) ?? new Set<Listener>();
            listeners.add(listener);
            this.listeners.set(name, listeners);
        }
        removeEventListener(name: string, listener: Listener) {
            this.listeners.get(name)?.delete(listener);
            if (!this.listeners.get(name)?.size) this.listeners.delete(name);
        }
        dispatch(name: string, event: Record<string, unknown>) {
            this.listeners.get(name)?.forEach((listener) => listener(event));
        }
        getBoundingClientRect() {
            return {
                left: 0,
                top: 0,
                width: this.clientWidth,
                height: this.clientHeight,
            };
        }
        querySelectorAll(tagName: string): Element[] {
            return this.children.flatMap((child) => [...(child.tagName === tagName ? [child] : []), ...child.querySelectorAll(tagName)]);
        }
    }
    let exports = 0;
    class Canvas extends Element {
        width = 0;
        height = 0;
        constructor() {
            super('canvas');
        }
        getContext() {
            return new Proxy({}, { get: () => () => {} });
        }
        toDataURL() {
            exports++;
            return 'data:image/png;base64,mock';
        }
    }
    const observers: Array<{ disconnected: boolean }> = [];
    class Observer {
        disconnected = false;
        constructor() {
            observers.push(this);
        }
        observe() {}
        disconnect() {
            this.disconnected = true;
        }
    }
    let frameId = 0;
    const scheduled = new Map<number, () => void>();
    const values: Record<string, unknown> = {
        HTMLCanvasElement: Canvas,
        window: { devicePixelRatio: 1 },
        document: {
            createElement: (tagName: string) => (tagName === 'canvas' ? new Canvas() : new Element(tagName)),
            createElementNS: (_namespace: string, tagName: string) => new Element(tagName),
            createDocumentFragment: () => new Element('#fragment'),
        },
        ResizeObserver: Observer,
        requestAnimationFrame: (callback: () => void) => {
            const id = ++frameId;
            scheduled.set(id, callback);
            return id;
        },
        cancelAnimationFrame: (id: number) => {
            scheduled.delete(id);
        },
    };
    const descriptors = new Map(Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(values))
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value,
        });
    return {
        host: new Element(),
        observers,
        scheduled,
        Canvas,
        exportCount: () => exports,
        restore() {
            for (const [key, descriptor] of descriptors) {
                if (descriptor) Object.defineProperty(globalThis, key, descriptor);
                else Reflect.deleteProperty(globalThis, key);
            }
        },
    };
}

function fixtureInput() {
    const fixture = createNestedChartFixture();
    const result = adaptChartToRenderPlan(fixture.chart, {
        columns: fixture.columns,
    });
    assert.ok(result.plan);
    const plan = result.plan;
    const makeSource = (sourceId = 'runtime', snapshotId = '1', records = fixture.records) =>
        createPreparedDataSource({
            version: { sourceId, snapshotId, presentationId: snapshotId },
            plan,
            records,
            getDatumKey: fixture.getDatumKey,
        });
    return { ...fixture, plan, makeSource, source: makeSource() };
}

function clickVisibleHit(dom: ReturnType<typeof installDom>, hits: readonly HitRegion[]): HitRegion {
    const hit = hits.find(
        ({ box, clip }) =>
            Math.min(box.x + box.width, clip.x + clip.width) > Math.max(box.x, clip.x) &&
            Math.min(box.y + box.height, clip.y + clip.height) > Math.max(box.y, clip.y),
    );
    assert.ok(hit, 'The committed fixture must have a visible selectable mark');
    const x = (Math.max(hit.box.x, hit.clip.x) + Math.min(hit.box.x + hit.box.width, hit.clip.x + hit.clip.width)) / 2;
    const y = (Math.max(hit.box.y, hit.clip.y) + Math.min(hit.box.y + hit.box.height, hit.clip.y + hit.clip.height)) / 2;
    const scroller = dom.host.querySelectorAll('div').find((element) => element.attrs.get('role') === 'region');
    assert.ok(scroller);
    scroller.dispatch('click', {
        clientX: x,
        clientY: y,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
    });
    return hit;
}

function waitForAbort<T>(signal: AbortSignal, aborted: () => void): Promise<T> {
    return new Promise((_resolve, reject) => {
        const onAbort = () => {
            aborted();
            const error = new Error('Read aborted');
            error.name = 'AbortError';
            reject(error);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
    });
}

test('rejected source candidates preserve the committed display and selection without emitting a clear', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        await view.ready;
        clickVisibleHit(dom, view.getViewState().frame!.hits as readonly HitRegion[]);
        const before = view.getViewState();
        const changes: WorksheetEvents['selectionChange'][] = [];
        view.on('selectionChange', (event) => changes.push(event));
        const bad: RenderDataSource = {
            ...fixture.source,
            version: { sourceId: 'bad-source', snapshotId: '2', presentationId: '2' },
            async describe() {
                throw new Error('Rejected metadata');
            },
        };
        assert.equal((await view.update({ plan: fixture.plan, source: bad })).status, 'rejected');
        const after = view.getViewState();
        assert.equal(after.frame, undefined);
        assert.equal(after.displayedFrame?.frameId, before.frame?.frameId);
        assert.deepEqual(after.selected, before.selected);
        assert.equal(changes.length, 0);
        assert.equal(after.committedVersion?.sourceId, 'runtime');
        assert.equal(after.requestedVersion.sourceId, 'bad-source');
        assert.equal(after.loadState, 'error');
        await assert.rejects(view.export({ format: 'png' }));
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('a later candidate can acknowledge a request from the committed presentation while an earlier candidate is pending', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        await view.ready;
        const header = view.getViewState().frame!.headers.find((target) => target.canCollapse)!;
        const requestId = view.requestCollapse(
            {
                axis: header.axis,
                key: header.key,
                path: header.path,
                fieldRef: header.fieldRef!,
            },
            false,
        )!;
        const a = fixture.makeSource('runtime', '2');
        let finish: ((manifest: Awaited<ReturnType<RenderDataSource['describe']>>) => void) | undefined;
        const waiting: RenderDataSource = {
            ...a,
            describe: () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        };
        const first = view.update({ plan: fixture.plan, source: waiting });
        assert.equal(view.getViewState().loadState, 'loading');
        const b = fixture.makeSource('runtime', '3');
        const second = await view.update({
            plan: fixture.plan,
            source: b,
            requestResults: [{ requestId, status: 'accepted' }],
        });
        assert.equal(second.status, 'committed');
        assert.equal((await first).status, 'superseded', 'Cancellation must settle even if a provider ignores AbortSignal');
        assert.equal(view.getViewState().committedVersion?.presentationId, '3');
        assert.equal(view.getViewState().requests.length, 0);
        finish?.(await a.describe(new AbortController().signal));
        await Promise.resolve();
        assert.equal(view.getViewState().committedVersion?.presentationId, '3');
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('public snapshots cannot mutate live geometry or selection and remain tied to their original frame', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        await view.ready;
        const original = view.getViewState(),
            id = original.frame!.hits[0].id;
        assert.throws(() => {
            (original.frame!.hits[0] as any).id = 'corrupted';
        }, TypeError);
        assert.throws(() => {
            (original.frame!.hits as any).splice(0);
        }, TypeError);
        clickVisibleHit(dom, original.frame!.hits as readonly HitRegion[]);
        const selected = view.getViewState();
        assert.throws(() => {
            (selected.selectedTargets[0].box as any).x = -999;
        }, TypeError);
        assert.equal(original.frame!.hits[0].id, id);
        assert.notEqual(original.frame!.frameId, selected.frame!.frameId);
        assert.ok(view.getViewState().frame!.hits.some((hit) => hit.id === id));
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('complete fixed scales render without calling unavailable statistical-domain reads', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const scales = { ...fixture.plan.scales };
    for (const ref of fixture.plan.rows.positions) scales[ref] = { domain: ['Standard', 'Premium'] };
    for (const ref of fixture.plan.columns.positions) scales[ref] = { domain: [-250, 250] };
    const plan = { ...fixture.plan, scales };
    const prepared = createPreparedDataSource({
        version: { sourceId: 'fixed', snapshotId: '1', presentationId: '1' },
        plan,
        records: fixture.records,
        getDatumKey: fixture.getDatumKey,
    });
    let domainReads = 0;
    const source: RenderDataSource = {
        ...prepared,
        readDomains() {
            domainReads++;
            return new Promise(() => {});
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        plan,
        source,
    });
    try {
        assert.equal((await view.ready).status, 'committed');
        assert.equal(domainReads, 0);
        assert.ok(view.getViewState().frame!.hits.length > 0);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('diagnostics preserve structured contract codes and field references', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const source: RenderDataSource = {
        ...fixture.source,
        async readPaneData(request, signal) {
            const batch = await fixture.source.readPaneData(request, signal);
            return {
                ...batch,
                panes: batch.panes.map((pane) => ({
                    ...pane,
                    records: pane.records.map((record) => {
                        const values = { ...record.values };
                        delete values.Sales_sum;
                        return { ...record, values };
                    }),
                })),
            };
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        plan: fixture.plan,
        source,
    });
    const errors: WorksheetEvents['diagnostic'][] = [];
    view.on('diagnostic', (error) => errors.push(error));
    try {
        assert.equal((await view.ready).status, 'rejected');
        assert.equal(errors.at(-1)?.code, 'missing-binding');
        assert.equal(errors.at(-1)?.fieldRef, fixture.plan.columns.positions[0]);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('locate must return the requested member before scrolling can commit', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const signal = new AbortController().signal;
    const rows = await fixture.source.readAxis(
        {
            version: fixture.source.version,
            axis: 'row',
            range: { start: 0, end: 2 },
        },
        signal,
    );
    const source: RenderDataSource = {
        ...fixture.source,
        async locate(request) {
            return {
                version: request.version,
                status: 'found',
                rank: 1,
                leaf: rows.leaves[1],
            };
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        plan: fixture.plan,
        source,
    });
    try {
        await view.ready;
        await assert.rejects(view.scrollTo({ rowKey: rows.leaves[0].key }), /requested|identity|key/i);
        assert.equal(view.getViewState().scrollY, 0);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('changing source clears a previous focus ring even when mark keys happen to match', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        await view.ready;
        const hit = view.getViewState().frame!.hits[0];
        assert.equal((await view.focus({ markId: hit.id })).status, 'found');
        assert.ok(view.getViewState().frame!.commands.some((command) => command.id.includes('focus')));
        assert.equal(
            (
                await view.update({
                    plan: fixture.plan,
                    source: fixture.makeSource('another-source'),
                })
            ).status,
            'committed',
        );
        assert.equal(view.getViewState().focus, undefined);
        assert.equal(
            view.getViewState().frame!.commands.some((command) => command.id.includes('focus')),
            false,
        );
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('new snapshots clear stale values for selections that were already pending', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        await view.ready;
        view.setSelection([
            {
                kind: 'datum',
                markId: 'not-in-window',
                paneKey: 'pane',
                slotId: 'slot',
                datumKeys: ['pending'],
                values: [
                    {
                        fieldRef: fixture.plan.columns.positions[0],
                        value: 111,
                        raw: 'old value',
                    },
                ],
            },
        ]);
        assert.equal(view.getViewState().selection[0].values[0].raw, 'old value');
        await view.update({
            plan: fixture.plan,
            source: fixture.makeSource('runtime', '2'),
        });
        assert.deepEqual(view.getViewState().pendingSelection, ['not-in-window']);
        assert.deepEqual(view.getViewState().selection[0].values, []);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('host callbacks can start another update only after the previous request was committed', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        await view.ready;
        const header = view.getViewState().frame!.headers.find((target) => target.canCollapse)!;
        const id = view.requestCollapse(
            {
                axis: header.axis,
                key: header.key,
                path: header.path,
                fieldRef: header.fieldRef!,
            },
            false,
        )!;
        const acknowledgements: string[] = [];
        view.on('requestStateChange', (event) => {
            if (event.status === 'accepted') acknowledgements.push(event.requestId);
        });
        let following: ReturnType<typeof view.update> | undefined;
        view.on('viewStateChange', (event) => {
            if (event.version.presentationId === '2')
                following = view.update({
                    plan: fixture.plan,
                    source: fixture.makeSource('runtime', '3'),
                });
        });
        const receipt = await view.update({
            plan: fixture.plan,
            source: fixture.makeSource('runtime', '2'),
            requestResults: [{ requestId: id, status: 'accepted' }],
        });
        assert.equal(receipt.status, 'committed');
        assert.ok(following);
        assert.equal((await following).status, 'committed');
        assert.deepEqual(acknowledgements, [id]);
        assert.equal(view.getViewState().committedVersion?.presentationId, '3');
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('subscriptions added after creation receive synchronous input-validation diagnostics', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        ...fixture,
        plan: { ...fixture.plan, mark: 'unsupported' as any },
    });
    const errors: WorksheetEvents['diagnostic'][] = [];
    view.on('diagnostic', (error) => errors.push(error));
    try {
        assert.equal((await view.ready).status, 'rejected');
        assert.equal(errors[0].code, 'unsupported-encoding');
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('a rejected update cannot export the previous committed frame', async () => {
    const dom = installDom();
    const fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        assert.equal((await view.ready).status, 'committed');
        assert.ok(view.getViewState().frame);
        assert.equal(await view.export({ format: 'png' }), 'data:image/png;base64,mock');
        const exportsBeforeFailure = dom.exportCount();
        const bad: RenderDataSource = {
            ...fixture.source,
            version: { sourceId: 'rejected', snapshotId: '2', presentationId: '2' },
            async describe() {
                throw new Error('new source rejected');
            },
        };
        assert.equal((await view.update({ plan: fixture.plan, source: bad })).status, 'rejected');
        assert.equal(view.getViewState().frame, undefined);
        await assert.rejects(view.export({ format: 'png' }), /no complete committed viewport/);
        await assert.rejects(view.export({ format: 'svg' }), /no complete committed viewport/);
        assert.equal(dom.exportCount(), exportsBeforeFailure, 'Rejected exports must not serialize an earlier canvas');
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('partial pane coverage cannot commit or export a complete viewport', async () => {
    const dom = installDom();
    const fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        assert.equal((await view.ready).status, 'committed');
        let completeFrames = 0;
        view.on('viewStateChange', () => {
            completeFrames++;
        });
        let partialReads = 0;
        const partial: RenderDataSource = {
            ...fixture.source,
            async readPaneData() {
                partialReads++;
                return {
                    version: fixture.source.version,
                    panes: [],
                    coveredWindows: [],
                };
            },
        };
        assert.equal((await view.update({ plan: fixture.plan, source: partial })).status, 'rejected');
        assert.equal(completeFrames, 0);
        assert.equal(view.getViewState().frame, undefined);
        const readsAfterFailure = partialReads;
        assert.equal((await view.update({ plan: fixture.plan, source: partial })).status, 'rejected');
        assert.ok(partialReads > readsAfterFailure, 'An incomplete response must be read again; earlier valid source caches may remain');
        await assert.rejects(view.export({ format: 'png' }), /no complete committed viewport/);
        await assert.rejects(view.export({ format: 'svg' }), /no complete committed viewport/);
        assert.equal((await view.update(fixture)).status, 'committed', 'A valid complete source must recover after rejection');
        assert.equal(completeFrames, 1);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('paged input commits loading placeholders, waits for complete export and never draws an incomplete pane', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    let completePage!: () => void;
    const pageGate = new Promise<void>((resolve) => {
        completePage = resolve;
    });
    const source: RenderDataSource = {
        ...fixture.source,
        async readPaneData(request, signal) {
            const full = await fixture.source.readPaneData({ ...request, cursor: undefined }, signal);
            const first = full.panes[0],
                split = Math.max(1, Math.floor(first.records.length / 2));
            if (!request.cursor)
                return {
                    version: full.version,
                    coveredWindows: [],
                    panes: [
                        {
                            ...first,
                            records: first.records.slice(0, split),
                            complete: false,
                        },
                    ],
                    nextCursor: 'remaining',
                };
            await pageGate;
            signal.throwIfAborted();
            return {
                ...full,
                panes: [{ ...first, records: first.records.slice(split) }, ...full.panes.slice(1)],
            };
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, { plan: fixture.plan, source }, { overscan: false });
    try {
        assert.equal((await view.ready).status, 'committed');
        const partial = view.getViewState();
        assert.equal(partial.loadState, 'loading');
        assert.equal(partial.displayedFrame?.hits.length, 0);
        assert.equal(partial.frame, undefined);
        const preview = await view.exportViewport({
            format: 'svg',
            includePlaceholders: true,
        });
        assert.equal(preview.metadata.status, 'loading');
        assert.equal(preview.metadata.includesPlaceholders, true);
        assert.match(preview.content, /Loading/);
        let exported = false;
        const complete = view.exportViewport({ format: 'png' }).then((page) => {
            exported = true;
            return page;
        });
        await Promise.resolve();
        assert.equal(exported, false);
        completePage();
        const page = await complete;
        assert.equal(page.metadata.status, 'complete');
        assert.equal(page.metadata.includesPlaceholders, false);
        assert.ok(view.getViewState().frame!.hits.length > 0);
        assert.ok(view.getViewState().resources.peakBytes <= 128 * 1024 * 1024);
    } finally {
        completePage();
        view.dispose();
        dom.restore();
    }
});

test('waiting viewport exports are cancelled by caller or changed target and disposal releases accounting', async () => {
    const dom = installDom(),
        fixture = fixtureInput();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const source: RenderDataSource = {
        ...fixture.source,
        async describe(signal) {
            await gate;
            signal.throwIfAborted();
            return fixture.source.describe(signal);
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, { plan: fixture.plan, source }, { overscan: false });
    try {
        await Promise.resolve();
        const cancel = new AbortController();
        const cancelled = view.exportViewport({ format: 'svg' }, cancel.signal);
        cancel.abort();
        await assert.rejects(cancelled, { name: 'AbortError' });
        const stale = view.exportViewport({ format: 'svg' });
        const updated = view.update(fixture);
        await assert.rejects(stale, /target viewport changed/);
        assert.equal((await updated).status, 'committed');
        view.dispose();
        assert.equal(view.getViewState().resources.bytes, 0);
        assert.equal(view.getViewState().resources.consumers, 0);
    } finally {
        release();
        view.dispose();
        dom.restore();
    }
});

test('a failed manifest read aborts its pending parallel domain read', async () => {
    const dom = installDom();
    const fixture = fixtureInput();
    let domainStarted = false;
    let domainAborted = false;
    const source: RenderDataSource = {
        ...fixture.source,
        async describe() {
            throw new Error('Manifest unavailable');
        },
        readDomains(_request, signal) {
            domainStarted = true;
            return waitForAbort(signal, () => {
                domainAborted = true;
            });
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        plan: fixture.plan,
        source,
    });
    try {
        assert.equal((await view.ready).status, 'rejected');
        assert.equal(domainStarted, true);
        assert.equal(domainAborted, true, 'Manifest failure must cancel the parallel read without waiting for disposal');
        assert.equal(view.getViewState().frame, undefined);
        await assert.rejects(view.export({ format: 'png' }), /no complete committed viewport/);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('a failed axis read cancels every started sibling without requiring dependent pane reads to start', async () => {
    const dom = installDom();
    const fixture = fixtureInput();
    const started = new Set<string>();
    const aborted = new Set<string>();
    const source: RenderDataSource = {
        ...fixture.source,
        readAxis(request, signal) {
            started.add(request.axis);
            if (request.axis === 'row') return Promise.reject(new Error('Row window unavailable'));
            return waitForAbort(signal, () => {
                aborted.add(request.axis);
            });
        },
        readPaneData(_request, signal) {
            started.add('panes');
            return waitForAbort(signal, () => {
                aborted.add('panes');
            });
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        plan: fixture.plan,
        source,
    });
    try {
        assert.equal((await view.ready).status, 'rejected');
        assert.ok(started.has('row') && started.has('column'));
        assert.deepEqual(
            aborted,
            new Set([...started].filter((name) => name !== 'row')),
            'Axis failure must cancel every pending sibling before disposal',
        );
        assert.equal(view.getViewState().frame, undefined);
        assert.equal(view.getViewState().cacheWindows, 0);
        await assert.rejects(view.export({ format: 'png' }), /no complete committed viewport/);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('dispose clears exposed data, DOM, bitmap, listeners and pending work', async () => {
    const dom = installDom();
    const fixture = fixtureInput();
    const signals: AbortSignal[] = [];
    let reads = 0;
    const source: RenderDataSource = {
        ...fixture.source,
        readPaneData(request, signal) {
            signals.push(signal);
            reads++;
            return fixture.source.readPaneData(request, signal);
        },
    };
    const view = createWorksheet(dom.host as unknown as HTMLElement, {
        plan: fixture.plan,
        source,
    });
    try {
        assert.equal((await view.ready).status, 'committed');
        const committed = view.getViewState();
        assert.ok(committed.frame);
        assert.ok(committed.manifest);
        assert.ok(committed.cacheWindows > 0);
        clickVisibleHit(dom, committed.frame.hits);
        assert.equal(view.getViewState().selectedTargets.length, 1);
        view.scrollToPosition({ y: 10 });
        assert.ok(dom.scheduled.size > 0);
        const canvas = dom.host.querySelectorAll('canvas')[0];
        assert.ok(canvas instanceof dom.Canvas);
        assert.ok(canvas.width > 0 && canvas.height > 0);
        const scroller = dom.host.querySelectorAll('div').find((element) => element.attrs.get('role') === 'region')!;
        assert.ok(scroller.listeners.has('click') && scroller.listeners.has('pointermove') && scroller.listeners.has('scroll'));
        view.dispose();
        view.dispose();
        const disposed = view.getViewState();
        assert.equal(disposed.frame, undefined);
        assert.equal(disposed.manifest, undefined);
        assert.equal(disposed.cacheWindows, 0);
        assert.deepEqual(disposed.selected, []);
        assert.deepEqual(disposed.selectedTargets, []);
        assert.deepEqual(disposed.pendingSelection, []);
        assert.equal(disposed.canvasCount, 0);
        assert.equal(canvas.width, 0);
        assert.equal(canvas.height, 0);
        assert.equal(dom.host.children.length, 0);
        assert.equal(scroller.listeners.size, 0);
        assert.equal(dom.scheduled.size, 0);
        assert.ok(dom.observers.every((observer) => observer.disconnected));
        assert.ok(signals.length > 0 && signals.every((signal) => signal.aborted));
        assert.equal((await view.update({ plan: fixture.plan, source })).status, 'disposed');
        assert.equal(reads, 1, 'Updates after disposal must not read the retained source');
        await assert.rejects(view.export({ format: 'png' }), /no complete committed viewport/);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('selection refreshes values for a new snapshot and clears for a different source', async () => {
    const dom = installDom();
    const fixture = fixtureInput();
    const view = createWorksheet(dom.host as unknown as HTMLElement, fixture);
    try {
        assert.equal((await view.ready).status, 'committed');
        const target = clickVisibleHit(dom, view.getViewState().frame!.hits);
        assert.deepEqual(view.getViewState().selected, [target.id]);
        const records = fixture.records.map((record) => ({
            ...record,
            Sales_sum: Number(record.Sales_sum) + 500,
        }));
        assert.equal(
            (
                await view.update({
                    plan: fixture.plan,
                    source: fixture.makeSource('runtime', '2', records),
                })
            ).status,
            'committed',
        );
        const refreshed = view.getViewState();
        assert.deepEqual(refreshed.selected, [target.id]);
        assert.equal(refreshed.selectedTargets.length, 1);
        assert.equal(refreshed.selectedTargets[0].values.Sales_sum, Number(target.values.Sales_sum) + 500);
        assert.deepEqual(refreshed.pendingSelection, []);
        const changes: Array<readonly HitRegion[]> = [];
        view.on('selectionChange', ({ targets }) => changes.push(targets));
        assert.equal(
            (
                await view.update({
                    plan: fixture.plan,
                    source: fixture.makeSource('different-source', '2', records),
                })
            ).status,
            'committed',
        );
        assert.deepEqual(view.getViewState().selected, []);
        assert.deepEqual(view.getViewState().selectedTargets, []);
        assert.deepEqual(changes, [[]], 'A different source must clear selection even when its datum keys happen to match');
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('a 100-pane viewport supports pixel scrolling across partial boundary rows and columns', async () => {
    const dom = installDom();
    const plan: import('../src/core/types').RenderPlan = {
        bindings: ['r', 'c', 'v'].map((fieldRef) => ({
            fieldRef,
            bindingId: fieldRef,
            columnKey: fieldRef,
            label: fieldRef,
            valueType: fieldRef === 'v' ? 'number' : 'string',
            positionType: fieldRef === 'v' ? 'linear' : 'band',
        })),
        rows: { facets: ['r'], positions: ['v'] },
        columns: { facets: ['c'], positions: [] },
        mark: 'point',
        domainPlanKey: '100-panes',
        layout: { rowHeight: 70, columnWidth: 110, rowHeaderWidth: 340, columnHeaderHeight: 200 },
    };
    const records = Array.from({ length: 121 }, (_, index) => ({ r: String(Math.floor(index / 11)), c: String(index % 11), v: 1 }));
    const source = createPreparedDataSource({ plan, records, version: { sourceId: '100-panes', snapshotId: '1', presentationId: '1' } });
    const view = createWorksheet(
        dom.host as unknown as HTMLElement,
        { plan, source },
        { autoResize: false, width: 1440, height: 900, overscan: false },
    );
    try {
        assert.equal((await view.ready).status, 'committed');
        assert.equal(view.getViewState().frame?.hits.length, 100);
        for (const offset of [1, 1.25, 17.5, 31, 55, 0]) {
            const before = view.getViewState().frameId;
            view.scrollToPosition({ x: offset, y: offset });
            for (const callback of [...dom.scheduled.values()]) callback();
            dom.scheduled.clear();
            for (let i = 0; i < 300 && view.getViewState().loadState !== 'complete'; i++) await Promise.resolve();
            const state = view.getViewState();
            assert.equal(state.loadState, 'complete', `partial boundary panes must remain scrollable at ${offset}px`);
            assert.ok(state.frameId > before);
            assert.ok(state.frame!.hits.length > 0);
            assert.ok(state.resources.layers.geometry.entries > 0);
            assert.ok(state.resources.bytes <= 128 * 1024 * 1024);
        }
        assert.equal(view.getViewState().frame?.hits.length, 100);
    } finally {
        view.dispose();
        dom.restore();
    }
});

test('a host-retained disposed controller releases its complete source and SVG mark nodes', async () => {
    const dom = installDom();
    // Node's isolated test children may omit --expose-gc from execArgv.
    setFlagsFromString('--expose_gc');
    const gc: () => void = runInNewContext('gc');
    async function make(backend: 'canvas' | 'svg') {
        const plan: import('../src/core/types').RenderPlan = {
            bindings: [{ fieldRef: 'v', bindingId: 'v', columnKey: 'v', label: 'Value', valueType: 'number', positionType: 'linear' }],
            rows: { facets: [], positions: ['v'] },
            columns: { facets: [], positions: [] },
            mark: 'point',
            domainPlanKey: 'retention',
        };
        const source = createPreparedDataSource({
            plan,
            version: { sourceId: 'retention', snapshotId: backend, presentationId: '1' },
            records: [{ v: 1, payload: 'x'.repeat(1_000_000) }],
        });
        const weak = new WeakRef(source),
            view = createWorksheet(
                dom.host as unknown as HTMLElement,
                { plan, source, backend },
                { autoResize: false, width: 640, height: 480, overscan: false },
            );
        assert.equal((await view.ready).status, 'committed');
        const node = dom.host.querySelectorAll('circle')[0],
            weakNode = node ? new WeakRef(node) : undefined;
        if (backend === 'svg') assert.ok(weakNode);
        view.dispose();
        return { view, weak, weakNode };
    }
    try {
        const retained = [await make('canvas'), await make('svg')];
        // WeakRef targets are kept through the current JS job, so collect across tasks.
        for (let index = 0; index < 12; index++) {
            await new Promise((resolve) => setTimeout(resolve, 0));
            gc();
        }
        for (const held of retained) {
            assert.equal(held.weak.deref(), undefined);
            assert.equal(held.weakNode?.deref(), undefined);
            assert.equal(held.view.getViewState().resources.bytes, 0);
        }
    } finally {
        dom.restore();
    }
});
