import { IGeoUrl } from '../interfaces';
import { useCallback, useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { fetchGeoJson, toFeatureCollection } from '../lib/geo/parse';

const loaded = new Map<string, FeatureCollection>();
const loading = new Map<string, Promise<FeatureCollection>>();

const geoUrlKey = (url: IGeoUrl) => `${url.type}(${url.url})${url.objectKey ? `#${url.objectKey}` : ''}`;

/**
 * Downloads the geometry behind a URL once and keeps it for the page's lifetime. Concurrent
 * callers share one request. A failed request is forgotten, so the next call tries again.
 */
export function loadGeoUrl(url: IGeoUrl): Promise<FeatureCollection> {
    const key = geoUrlKey(url);
    const ready = loaded.get(key);
    if (ready) return Promise.resolve(ready);
    let request = loading.get(key);
    if (!request) {
        request = fetchGeoJson(url.url)
            .then((json) => {
                const collection = toFeatureCollection(json, url.objectKey);
                loaded.set(key, collection);
                return collection;
            })
            .finally(() => loading.delete(key));
        loading.set(key, request);
    }
    return request;
}

export interface IGeoDataState {
    data?: FeatureCollection;
    /** Set when the URL could not be loaded. Read it with `geoDataErrorOf`. */
    error?: unknown;
    loading: boolean;
    retry: () => void;
}

/** The geometry to draw: the one given, or the one behind `url`, with its loading and error state. */
export function useGeoData(geojson?: FeatureCollection, url?: IGeoUrl): IGeoDataState {
    const key = !geojson && url ? geoUrlKey(url) : '';
    const [attempt, setAttempt] = useState(0);
    const [settled, setSettled] = useState<{ key: string; attempt: number; data?: FeatureCollection; error?: unknown }>({ key: '', attempt: 0 });
    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    useEffect(() => {
        if (!key || !url || loaded.has(key)) return;
        let live = true;
        loadGeoUrl(url).then(
            (data) => live && setSettled({ key, attempt, data }),
            (error) => live && setSettled({ key, attempt, error })
        );
        return () => {
            live = false;
        };
    }, [key, attempt]);

    if (geojson) return { data: geojson, loading: false, retry };
    if (!key) return { loading: false, retry };
    const ready = loaded.get(key);
    if (ready) return { data: ready, loading: false, retry };
    if (settled.key === key && settled.attempt === attempt) return { data: settled.data, error: settled.error, loading: false, retry };
    return { loading: true, retry };
}

export function useGeoJSON(geojson?: FeatureCollection, url?: IGeoUrl) {
    return useGeoData(geojson, url).data;
}
