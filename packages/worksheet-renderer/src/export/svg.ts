import { svgPrimitive } from '../backends/svg';
import type { SceneFrame } from '../scene/types';
import { ExportError } from './shared';

/** UTF-8 output size without allocating a second complete encoded buffer. */
export function utf8Bytes(value: string): number {
    let bytes = 0;
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x80) bytes++;
        else if (code < 0x800) bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) {
            bytes += 4;
            i++;
        } else bytes += 3;
    }
    return bytes;
}
function xml(value: string, attribute = false): string {
    let result = '';
    for (const char of value) {
        const code = char.codePointAt(0)!;
        if ((code < 32 && ![9, 10, 13].includes(code)) || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff) result += '�';
        else if (char === '&') result += '&amp;';
        else if (char === '<') result += '&lt;';
        else if (char === '>') result += '&gt;';
        else if (attribute && char === '"') result += '&quot;';
        else if (attribute && char === '\n') result += '&#10;';
        else if (attribute && char === '\r') result += '&#13;';
        else if (attribute && char === '\t') result += '&#9;';
        else result += char;
    }
    return result;
}
function attributes(values: Record<string, string | number>): string {
    return Object.entries(values)
        .map(([name, value]) => {
            if (typeof value === 'number' && !Number.isFinite(value)) throw new ExportError('source-contract-violation', 'Non-finite SVG geometry');
            if ((name === 'fill' || name === 'stroke') && /url\s*\(|expression\s*\(/i.test(String(value)))
                throw new ExportError('unsupported-encoding', 'Export paints must not reference external resources or expressions');
            return ` ${name}="${xml(String(value), true)}"`;
        })
        .join('');
}
let nextExportId = 0;
export interface SerializedSvg {
    content: string;
    bytes: number;
    elements: number;
}
/** Pure serialization shares geometry and style attributes with the interactive SVG backend. */
export function serializeSceneToSvg(frame: SceneFrame, options: { metadata?: unknown; maxElements: number; maxBytes: number }): SerializedSvg {
    const commands = frame.commands.filter((command) => command.clip.width > 0 && command.clip.height > 0);
    const clips = new Map<string, { id: string; clip: (typeof commands)[number]['clip'] }>();
    const prefix = `worksheet-export-${++nextExportId}`;
    for (const command of commands) {
        const c = command.clip,
            key = `${c.x},${c.y},${c.width},${c.height}`;
        if (!clips.has(key)) clips.set(key, { id: `${prefix}-${clips.size}`, clip: c });
    }
    const elements = commands.length + clips.size * 2 + 2 + (options.metadata === undefined ? 0 : 1);
    if (elements > options.maxElements) throw new ExportError('resource-limit', `SVG page needs ${elements} elements; limit is ${options.maxElements}`);
    const parts: string[] = [];
    let bytes = 0;
    const write = (value: string) => {
        bytes += utf8Bytes(value);
        if (bytes > options.maxBytes) throw new ExportError('resource-limit', 'SVG page byte limit exceeded');
        parts.push(value);
    };
    write(`<svg xmlns="http://www.w3.org/2000/svg"${attributes({ width: frame.width, height: frame.height, viewBox: `0 0 ${frame.width} ${frame.height}` })}>`);
    if (options.metadata !== undefined) write(`<metadata>${xml(JSON.stringify(options.metadata))}</metadata>`);
    write('<defs>');
    for (const { id, clip } of clips.values()) write(`<clipPath${attributes({ id })}><rect${attributes({ ...clip })}/></clipPath>`);
    write('</defs>');
    for (const command of commands) {
        const c = command.clip,
            clip = clips.get(`${c.x},${c.y},${c.width},${c.height}`)!;
        const { tag, attrs, text } = svgPrimitive(command.primitive);
        attrs['data-command'] = command.id;
        attrs['clip-path'] = `url(#${clip.id})`;
        write(text === undefined ? `<${tag}${attributes(attrs)}/>` : `<${tag}${attributes(attrs)}>${xml(text)}</${tag}>`);
    }
    write('</svg>');
    return { content: parts.join(''), bytes, elements };
}
