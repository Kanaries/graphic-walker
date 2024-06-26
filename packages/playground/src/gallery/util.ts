import { IMutField, IRow } from '@kanaries/graphic-walker';
export function promiseWrapper<T>(promise: Promise<T>): () => T {
    let status = 'pending';
    let result: T;

    const s = promise.then(
        (value) => {
            status = 'success';
            result = value;
        },
        (error) => {
            status = 'error';
            result = error;
        }
    );

    return () => {
        switch (status) {
            case 'pending':
                throw s;
            case 'success':
                return result;
            case 'error':
                throw result;
            default:
                throw new Error('Unknown status');
        }
    };
}

const cache: Map<string, () => unknown> = new Map();

export function useFetch<T>(url: string): T {
    if (!cache.has(url)) {
        cache.set(url, promiseWrapper(fetch(url).then((resp) => resp.json() as T)));
    }
    return cache.get(url)!() as T;
}

export interface IDataSource {
    dataSource: IRow[];
    fields: IMutField[];
}

export const extractRGB = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return {
        r: parseInt(result![1], 16),
        g: parseInt(result![2], 16),
        b: parseInt(result![3], 16),
    };
};

export const extractHSL = (hsl: string) => {
    const result = /^hsl\(([\d.]+)\s([\d.]+)%\s([\d.]+)%\)$/i.exec(hsl);
    return {
        h: parseInt(result![1]),
        s: parseInt(result![2]),
        l: parseInt(result![3]),
    };
};

export const toHex = (r: number, g: number, b: number) => {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
