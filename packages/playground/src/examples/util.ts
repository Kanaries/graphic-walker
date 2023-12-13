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
        },
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
