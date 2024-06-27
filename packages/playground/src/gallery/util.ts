import { IMutField, IRow } from '@kanaries/graphic-walker';

export interface IDataSource {
    dataSource: IRow[];
    fields: IMutField[];
}

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

export function toRouterPath(name: string): string {
    return name.replace(/[\s,]/g, '_');
}
