import { isCurrentComputation, runOwnedComputation } from './computationOwnership';
import type { IDataQueryPayload } from '../interfaces';

const payload = (): IDataQueryPayload => ({ workflow: [] });

test('owned calls keep the exact host payload and release settled ownership', async () => {
    const request = Object.freeze(payload());
    let current = true;
    let finish!: () => void;
    const result = runOwnedComputation(
        async (received) => {
            expect(received).toBe(request);
            expect(Object.keys(received)).toEqual(['workflow']);
            await new Promise<void>((resolve) => {
                finish = resolve;
            });
            return [];
        },
        request,
        () => current,
    );
    expect(isCurrentComputation(request)).toBe(true);
    current = false;
    expect(isCurrentComputation(request)).toBe(false);
    finish();
    await result;
    expect(isCurrentComputation(request)).toBe(true);
});

test('concurrent stale and current rejections retain their error and reporting ownership', async () => {
    const stale = payload(),
        current = payload(),
        reports: Error[] = [];
    const error = new Error('query failed');
    const computation = async (request: IDataQueryPayload) => {
        try {
            await Promise.reject(error);
            return [];
        } catch (caught) {
            if (isCurrentComputation(request)) reports.push(caught as Error);
            throw caught;
        }
    };
    const results = await Promise.allSettled([
        runOwnedComputation(computation, stale, () => false),
        runOwnedComputation(computation, current, () => true),
        computation(payload()), // Existing callers without an owner still report.
    ]);
    expect(results).toEqual(Array.from({ length: 3 }, () => ({ status: 'rejected', reason: error })));
    expect(reports).toEqual([error, error]);
    expect(isCurrentComputation(stale)).toBe(true);
});

test('synchronous failures also release their ownership', () => {
    const request = payload(),
        error = new Error('sync query failure');
    expect(() =>
        runOwnedComputation(
            () => {
                throw error;
            },
            request,
            () => false,
        ),
    ).toThrow(error);
    expect(isCurrentComputation(request)).toBe(true);
});
