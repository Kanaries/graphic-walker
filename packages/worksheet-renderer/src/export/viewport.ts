import { paintCanvas, canvasDimensions } from '../backends/canvas';
import { sameVersion } from '../core/keys';
import type { ExportPage, ExportPageMetadata, ExportResources, ViewportExportOptions, ViewportExportSnapshot } from './types';
import { serializeSceneToSvg, utf8Bytes } from './svg';
import { checkDimensions, exportTask, ExportError, limitsFor, retainedBytes } from './shared';

/** The controller waits for its fixed target frame before calling this serialization boundary. */
export async function exportViewport(
    snapshot: ViewportExportSnapshot,
    options: ViewportExportOptions,
    resources: ExportResources,
    signal?: AbortSignal,
): Promise<ExportPage> {
    const limits = limitsFor(options.limits),
        task = exportTask(resources, limits, signal);
    let target: HTMLCanvasElement | undefined;
    try {
        task.check();
        if (!sameVersion(snapshot.version, snapshot.requestedVersion) || ['stale', 'error', 'disposed'].includes(snapshot.state))
            throw new ExportError('version-expired', 'The viewport does not represent the requested current input');
        if (snapshot.state !== 'complete' && !options.includePlaceholders)
            throw new ExportError('incomplete-export', 'The target viewport must be complete unless placeholders are explicitly included');
        if (!['svg', 'png'].includes(options.format)) throw new ExportError('unsupported-encoding', 'Viewport export supports PNG or SVG');
        const frame = snapshot.frame;
        checkDimensions(frame.width, frame.height, limits);
        task.reserve('frame', retainedBytes(frame));
        const metadata: ExportPageMetadata = {
            name: `worksheet-viewport.${options.format}`,
            format: options.format,
            version: { ...snapshot.version },
            domainPlanKey: snapshot.domainPlanKey,
            scope: 'viewport',
            status: snapshot.state as 'complete' | 'preview' | 'loading',
            includesPlaceholders: snapshot.state !== 'complete',
            bytes: 0,
            width: frame.width,
            height: frame.height,
            range: snapshot.range ? structuredClone(snapshot.range) : undefined,
            scroll: snapshot.scroll ? { ...snapshot.scroll } : undefined,
            frameId: frame.frameId,
            fontFamily: snapshot.fontFamily ?? 'sans-serif',
            fontSize: snapshot.fontSize ?? 11,
        };
        let content: string;
        // Parts plus the joined UTF-16 string coexist during SVG serialization; PNG carries a data URL.
        task.reserve('output', limits.maxPageBytes * 5 + limits.maxPageElements * 128);
        if (options.format === 'svg') {
            const svg = serializeSceneToSvg(frame, {
                metadata: { ...metadata, bytes: undefined },
                maxElements: limits.maxPageElements,
                maxBytes: limits.maxPageBytes,
            });
            content = svg.content;
            metadata.bytes = svg.bytes;
        } else {
            if (typeof document === 'undefined') throw new ExportError('unsupported-encoding', 'PNG export requires a browser Canvas');
            const requestedDpr = snapshot.dpr ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
            if (!Number.isFinite(requestedDpr) || requestedDpr <= 0) throw new ExportError('source-contract-violation', 'PNG DPR must be finite and positive');
            const { dpr, width: bitmapWidth, height: bitmapHeight } = canvasDimensions(frame.width, frame.height, requestedDpr);
            if (bitmapWidth * bitmapHeight > limits.maxPagePixels) throw new ExportError('resource-limit', 'PNG bitmap exceeds export pixel limit');
            task.reserve('bitmap', bitmapWidth * bitmapHeight * 4);
            target = document.createElement('canvas');
            paintCanvas(target, frame, dpr);
            task.check();
            content = target.toDataURL('image/png');
            if (!content.startsWith('data:image/png;base64,')) throw new ExportError('resource-limit', 'Canvas could not produce a bounded PNG');
            metadata.bytes =
                Math.ceil(((content.length - 'data:image/png;base64,'.length) * 3) / 4) - (content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0);
            // Account for the returned string as well as the encoded file; it is caller-owned after return.
            if (metadata.bytes > limits.maxPageBytes || utf8Bytes(content) > limits.maxPageBytes * 2)
                throw new ExportError('resource-limit', 'PNG page byte limit exceeded');
            metadata.dpr = dpr;
        }
        task.check();
        if (metadata.bytes > limits.maxTotalBytes) throw new ExportError('resource-limit', 'Export total byte limit exceeded');
        return { content, metadata: Object.freeze(metadata) };
    } finally {
        if (target) {
            target.width = 0;
            target.height = 0;
            target.remove();
        }
        task.dispose();
    }
}
