import type { IVegaChartRef } from '../interfaces';
import { combineCanvases, combineSVGs, getCompositeGridLayout } from './vegaApiExport';

const chartRef = (x: number, y: number, w: number, h: number): IVegaChartRef => ({
    x,
    y,
    w,
    h,
    innerWidth: w,
    innerHeight: h,
    view: null,
    canvas: null,
});

describe('Vega export composition', () => {
    test('lays out unequal grid cells using the largest item in each row and column', () => {
        const layout = getCompositeGridLayout([
            { x: 0, y: 0, width: 100, height: 40 },
            { x: 1, y: 0, width: 120, height: 50 },
            { x: 0, y: 1, width: 90, height: 60 },
            { x: 1, y: 1, width: 110, height: 55 },
        ]);

        expect(layout).toEqual({
            width: 220,
            height: 110,
            items: [
                { x: 0, y: 0, width: 100, height: 40, offsetX: 0, offsetY: 0 },
                { x: 1, y: 0, width: 120, height: 50, offsetX: 100, offsetY: 0 },
                { x: 0, y: 1, width: 90, height: 60, offsetX: 0, offsetY: 50 },
                { x: 1, y: 1, width: 110, height: 55, offsetX: 100, offsetY: 50 },
            ],
        });
    });

    test('draws canvases into one image using their grid offsets', () => {
        const drawImage = jest.fn();
        const combinedCanvas = {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage }),
        };
        const previousDocument = globalThis.document;
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: {
                createElement: (name: string) => {
                    expect(name).toBe('canvas');
                    return combinedCanvas;
                },
            },
        });

        try {
            const first = { width: 100, height: 40 } as HTMLCanvasElement;
            const second = { width: 120, height: 50 } as HTMLCanvasElement;
            const result = combineCanvases([first, second], [chartRef(0, 0, 100, 40), chartRef(1, 0, 120, 50)]);

            expect(result).toBe(combinedCanvas);
            expect(combinedCanvas.width).toBe(220);
            expect(combinedCanvas.height).toBe(50);
            expect(drawImage).toHaveBeenNthCalledWith(1, first, 0, 0);
            expect(drawImage).toHaveBeenNthCalledWith(2, second, 100, 0);
        } finally {
            Object.defineProperty(globalThis, 'document', {
                configurable: true,
                value: previousDocument,
            });
        }
    });

    test('combines repeated SVG views and namespaces their definitions', () => {
        const first = '<svg width="100" height="40"><defs><clipPath id="clip"><path /></clipPath></defs><g clip-path="url(#clip)" /></svg>';
        const second =
            '<svg width="120" height="50"><defs><clipPath id="clip"><path /></clipPath></defs><g aria-labelledby="title"><title id="title">B</title><g clip-path="url(#clip)" /></g></svg>';

        const combined = combineSVGs([first, second], [chartRef(0, 0, 100, 40), chartRef(1, 0, 120, 50)]);

        expect(combined).toContain('width="220" height="50" viewBox="0 0 220 50"');
        expect(combined).toContain('<svg x="0" y="0" width="100" height="40">');
        expect(combined).toContain('<svg x="100" y="0" width="120" height="50">');
        expect(combined).toContain('id="gw-export-0-clip"');
        expect(combined).toContain('url(#gw-export-0-clip)');
        expect(combined).toContain('id="gw-export-1-clip"');
        expect(combined).toContain('url(#gw-export-1-clip)');
        expect(combined).toContain('aria-labelledby="gw-export-1-title"');
        expect(combined).toContain('id="gw-export-1-title"');
    });

    test('keeps a single SVG unchanged', () => {
        const svg = '<svg width="100" height="40"><g /></svg>';
        expect(combineSVGs([svg], [chartRef(0, 0, 100, 40)])).toBe(svg);
    });
});
