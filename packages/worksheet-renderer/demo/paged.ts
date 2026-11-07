import { createPreparedDataSource } from '../src/core/prepared';
import type { PreparedDataSourceOptions, RenderDataSource } from '../src/core/types';

/** A host fixture: a partial pane is deliberately held until the user releases its continuation. */
export function createPagedDemo(options: PreparedDataSourceOptions) {
    const source = createPreparedDataSource(options);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requested = 0;
    const paged: RenderDataSource = {
        ...source,
        async readPaneData(request, signal) {
            requested++;
            const batch = await source.readPaneData({ ...request, cursor: undefined }, signal);
            const first = batch.panes[0];
            if (!first) return batch;
            const split = Math.max(1, Math.floor(first.records.length / 2));
            if (!request.cursor)
                return {
                    version: batch.version,
                    panes: [
                        {
                            ...first,
                            records: first.records.slice(0, split),
                            complete: false,
                        },
                    ],
                    coveredWindows: [],
                    nextCursor: 'rest',
                };
            await new Promise<void>((resolve, reject) => {
                const abort = () => {
                    signal.removeEventListener('abort', abort);
                    reject(signal.reason);
                };
                signal.addEventListener('abort', abort, { once: true });
                gate.then(() => {
                    signal.removeEventListener('abort', abort);
                    signal.aborted ? reject(signal.reason) : resolve();
                });
                if (signal.aborted) abort();
            });
            return {
                ...batch,
                panes: [{ ...first, records: first.records.slice(split) }, ...batch.panes.slice(1)],
            };
        },
    };
    return {
        source: paged,
        release: () => release(),
        getRequests: () => requested,
    };
}
