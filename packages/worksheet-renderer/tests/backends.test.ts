import test from 'node:test';
import assert from 'node:assert/strict';
import { createSvgBackend } from '../src/backends/svg';
import { paintCanvas } from '../src/backends/canvas';
import type { SceneFrame } from '../src/scene/types';

class Element {
    children: Element[] = [];
    parent?: Element;
    textContent = '';
    attrs = new Map<string, string>();
    constructor(readonly tagName: string) {}
    setAttribute(name: string, value: string) {
        this.attrs.set(name, value);
    }
    removeAttribute(name: string) {
        this.attrs.delete(name);
    }
    appendChild(child: Element) {
        child.remove();
        this.children.push(child);
        child.parent = this;
        return child;
    }
    insertBefore(child: Element, before: Element) {
        child.remove();
        const index = this.children.indexOf(before);
        assert.ok(index >= 0);
        this.children.splice(index, 0, child);
        child.parent = this;
        return child;
    }
    remove() {
        if (this.parent) {
            this.parent.children = this.parent.children.filter((child) => child !== this);
            this.parent = undefined;
        }
    }
}
const frame = (id: number): SceneFrame => ({
    frameId: id,
    width: 400,
    height: 300,
    rowStart: 0,
    columnStart: 0,
    hits: [],
    headers: [],
    commands: [
        {
            id: 'shape',
            clip: { x: 10, y: 20, width: 100, height: 80 },
            primitive: {
                kind: 'path',
                points: [
                    { x: 20, y: 30 },
                    { x: 30, y: 50 },
                    { x: 40, y: 30 },
                ],
                closed: true,
                fill: '#2563eb',
                opacity: 0.5,
            },
        },
        {
            id: 'label',
            clip: { x: 10, y: 20, width: 100, height: 80 },
            primitive: { kind: 'text', x: 25, y: 35, text: '中文 <value>', fill: '#000', fontFamily: 'serif', size: 14, align: 'center' },
        },
    ],
});
test('SVG keyed updates retain matching nodes, reorder z-order and reclaim unused defs', () => {
    const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { createElementNS: (_ns: string, tag: string) => new Element(tag) },
    });
    try {
        const svg = new Element('svg'),
            paint = createSvgBackend(svg as unknown as SVGSVGElement),
            first = frame(1);
        paint(first);
        const shape = svg.children[1],
            label = svg.children[2],
            defs = svg.children[0];
        assert.equal(shape.attrs.get('d'), 'M20,30 L30,50 L40,30 Z');
        assert.equal(shape.attrs.get('opacity'), '.5'.replace(/^\./, '0.'));
        assert.equal(label.textContent, '中文 <value>');
        assert.equal(label.attrs.get('font-family'), 'serif');
        assert.equal(defs.children.length, 1);
        const second = frame(2);
        second.commands.reverse();
        second.commands[0] = { ...second.commands[0], primitive: { kind: 'text', x: 25, y: 35, text: 'changed', fill: '#f00' } };
        paint(second);
        assert.equal(svg.children[1], label);
        assert.equal(svg.children[2], shape);
        assert.equal(label.textContent, 'changed');
        assert.equal(label.attrs.get('font-family'), 'sans-serif');
        const third = frame(3);
        third.commands = third.commands.slice(0, 1).map((command) => ({ ...command, clip: { x: 0, y: 0, width: 50, height: 50 } }));
        paint(third);
        assert.equal(svg.children.length, 2);
        assert.equal(label.parent, undefined);
        assert.equal(defs.children.length, 1);
        assert.equal(svg.children[1], shape);
        const secondRoot = new Element('svg');
        createSvgBackend(secondRoot as unknown as SVGSVGElement)(frame(1));
        assert.notEqual(defs.children[0].attrs.get('id'), secondRoot.children[0].children[0].attrs.get('id'));
        assert.ok(shape.attrs.get('clip-path')?.includes(defs.children[0].attrs.get('id')!));
        const empty = { ...frame(4), commands: [] };
        paint(empty);
        assert.equal(svg.children.length, 1);
        assert.equal(defs.children.length, 0);
    } finally {
        if (old) Object.defineProperty(globalThis, 'document', old);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});
test('SVG resource budgets include clip definitions and reject before changing the prior root', () => {
    const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { createElementNS: (_ns: string, tag: string) => new Element(tag) },
    });
    try {
        const svg = new Element('svg'),
            paint = createSvgBackend(svg as unknown as SVGSVGElement);
        paint(frame(1));
        const initial = [...svg.children];
        const enormous = {
            ...frame(2),
            commands: Array.from({ length: 3400 }, (_, i) => ({
                id: String(i),
                clip: { x: i, y: 0, width: 1, height: 1 },
                primitive: { kind: 'rect' as const, box: { x: i, y: 0, width: 1, height: 1 }, fill: '#000' },
            })),
        };
        assert.throws(() => paint(enormous), /resource-limit/);
        assert.deepEqual(svg.children, initial);
    } finally {
        if (old) Object.defineProperty(globalThis, 'document', old);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});
test('Canvas consumes shared path coordinates, clips, opacity and font from the scene', () => {
    const calls: Array<[string, ...unknown[]]> = [],
        state: Record<string, unknown> = {};
    const ctx = new Proxy(state, {
        get(target, name) {
            return name in target ? target[String(name)] : (...args: unknown[]) => calls.push([String(name), ...args]);
        },
        set(target, name, value) {
            target[String(name)] = value;
            calls.push(['set', String(name), value]);
            return true;
        },
    });
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
    paintCanvas(canvas, frame(1), 2);
    assert.equal(canvas.width, 800);
    assert.equal(canvas.height, 600);
    assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['moveTo', 20, 30])));
    assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['lineTo', 40, 30])));
    assert.ok(calls.some((call) => call[0] === 'closePath'));
    assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['set', 'globalAlpha', 0.5])));
    assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['set', 'font', '14px serif'])));
    assert.equal(calls.filter((call) => call[0] === 'clip').length, 2);
});

test('Canvas and SVG explicitly paint round caps to match segment hit geometry', () => {
    const line = {
        ...frame(1),
        commands: [
            {
                id: 'line',
                clip: { x: 0, y: 0, width: 100, height: 100 },
                primitive: { kind: 'line' as const, x1: 10, y1: 10, x2: 20, y2: 10, stroke: '#000', width: 10 },
            },
        ],
    };
    const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { createElementNS: (_ns: string, tag: string) => new Element(tag) },
    });
    try {
        const svg = new Element('svg');
        createSvgBackend(svg as unknown as SVGSVGElement)(line);
        assert.equal(svg.children[1].attrs.get('stroke-linecap'), 'round');
        const state: Record<string, unknown> = {},
            ctx = new Proxy(state, {
                get(target, name) {
                    return target[String(name)] ?? (() => {});
                },
                set(target, name, value) {
                    target[String(name)] = value;
                    return true;
                },
            });
        const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
        paintCanvas(canvas, line, 1);
        assert.equal(state.lineCap, 'round');
    } finally {
        if (old) Object.defineProperty(globalThis, 'document', old);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});
