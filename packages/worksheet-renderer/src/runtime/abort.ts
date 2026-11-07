/** A source must honour cancellation; the controller still settles if an external source is late. */
export function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = () => {
            const error = new Error('Read aborted');
            error.name = 'AbortError';
            reject(error);
        };
        if (signal.aborted) {
            promise.catch(() => {});
            abort();
            return;
        }
        signal.addEventListener('abort', abort, { once: true });
        promise.then(
            (value) => {
                signal.removeEventListener('abort', abort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', abort);
                reject(error);
            },
        );
    });
}
