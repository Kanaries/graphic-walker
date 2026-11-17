import { feature } from 'topojson-client';
import type { Feature, FeatureCollection } from 'geojson';

/**
 * Why geographic data could not be used.
 * - `network`: the request did not complete.
 * - `http`: the server answered with an error status, kept in `detail`.
 * - `json`: the text is not JSON.
 * - `format`: valid JSON that is neither a GeoJSON FeatureCollection nor a TopoJSON topology.
 * - `object`: the topology has no object of the requested name. `detail` lists the ones it has.
 */
export type GeoDataErrorCode = 'network' | 'http' | 'json' | 'format' | 'object';

export class GeoDataError extends Error {
    readonly code: GeoDataErrorCode;
    readonly detail: string;
    constructor(code: GeoDataErrorCode, detail = '') {
        super(detail ? `${code}: ${detail}` : code);
        this.name = 'GeoDataError';
        this.code = code;
        this.detail = detail;
    }
}

/** Reads the code off any thrown value. Anything that is not a GeoDataError counts as a format problem. */
export function geoDataErrorOf(error: unknown): { code: GeoDataErrorCode; detail: string } {
    if (error && typeof error === 'object' && 'code' in error && 'detail' in error) {
        const { code, detail } = error as GeoDataError;
        return { code, detail };
    }
    return { code: 'format', detail: error instanceof Error ? error.message : '' };
}

const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function isTopology(json: unknown): boolean {
    return isRecord(json) && json.type === 'Topology' && isRecord(json.objects);
}

/** Names of the objects in a topology. Empty for anything else. */
export function topologyObjectKeys(json: unknown): string[] {
    return isTopology(json) ? Object.keys((json as { objects: object }).objects) : [];
}

/** Parses the text of a file or response. Throws a GeoDataError with code `json` when it is not JSON. */
export function parseGeoText(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new GeoDataError('json', error instanceof Error ? error.message : '');
    }
}

/**
 * Turns parsed GeoJSON or TopoJSON into a FeatureCollection. The format is read from the content,
 * so a topology is converted whatever format the caller believed it had. `objectKey` picks the
 * topology object and defaults to the first one.
 */
export function toFeatureCollection(json: unknown, objectKey?: string): FeatureCollection {
    if (!isRecord(json)) throw new GeoDataError('format');
    if (isTopology(json)) {
        const keys = topologyObjectKeys(json);
        const key = objectKey || keys[0];
        if (!key || !keys.includes(key)) throw new GeoDataError('object', keys.join(', '));
        const converted = feature(json as Parameters<typeof feature>[0], key) as unknown as Feature | FeatureCollection;
        return converted.type === 'FeatureCollection' ? converted : { type: 'FeatureCollection', features: [converted] };
    }
    if (Array.isArray(json.features)) {
        return json as unknown as FeatureCollection;
    }
    if (json.type === 'Feature' && 'geometry' in json) {
        return { type: 'FeatureCollection', features: [json as unknown as Feature] };
    }
    throw new GeoDataError('format', typeof json.type === 'string' ? json.type : '');
}

/** Downloads and parses a GeoJSON or TopoJSON file. Every failure is a GeoDataError. */
export async function fetchGeoJson(url: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(url, { signal });
    } catch (error) {
        throw new GeoDataError('network', error instanceof Error ? error.message : '');
    }
    if (!response.ok) throw new GeoDataError('http', String(response.status));
    let text: string;
    try {
        text = await response.text();
    } catch (error) {
        throw new GeoDataError('network', error instanceof Error ? error.message : '');
    }
    return parseGeoText(text);
}
