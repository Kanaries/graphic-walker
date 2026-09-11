import { IComputationFunction, IDataQueryPayload } from '../interfaces';
import {
    profileNonmialField,
    profileNonmialFieldWithCache,
    profileQuantitativeField,
    profileQuantitativeFieldWithCache,
    wrapComputationWithTag,
} from './index';

jest.mock('lodash-es', () => ({
    range: (start: number, end: number) => Array.from({ length: end - start }, (_, index) => start + index),
}));
jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

function createProfilingService(options: { delayMs?: number; onStart?: () => void; onFinish?: () => void } = {}) {
    const calls: IDataQueryPayload[] = [];
    const service: IComputationFunction = jest.fn(async (payload: IDataQueryPayload) => {
        calls.push(payload);
        options.onStart?.();
        try {
            if (options.delayMs) {
                await new Promise((resolve) => setTimeout(resolve, options.delayMs));
            }
            const firstStep = payload.workflow[0];
            const viewStep = payload.workflow.find((step) => step.type === 'view') as any;
            const groupBy = viewStep?.query[0]?.groupBy ?? [];

            if (firstStep?.type === 'transform') {
                const field = String(groupBy[0]).replace(/^bin_/, '');
                return [
                    { [`bin_${field}`]: [0, 10], gw_count_fid_sum: 4 },
                    { [`bin_${field}`]: [10, 20], gw_count_fid_sum: 6 },
                ];
            }

            const field = String(groupBy[0]);
            if (payload.limit === 2) {
                return [
                    { [field]: 'A', [`count_${field}`]: 7 },
                    { [field]: 'B', [`count_${field}`]: 3 },
                ];
            }
            return [{ [`total_distinct_${field}`]: 2, count: 10 }];
        } finally {
            options.onFinish?.();
        }
    });
    return { service, calls };
}

const nominalFields = ['category_0', 'category_1', 'category_2', 'category_3'];
const quantitativeFields = ['value_0', 'value_1', 'value_2', 'value_3'];

function runProfilingWorkload(service: IComputationFunction) {
    const taggedService = wrapComputationWithTag(service, 'profiling');
    return Promise.all([
        ...nominalFields.map((field) => profileNonmialField(taggedService, field)),
        ...quantitativeFields.map((field) => profileQuantitativeField(taggedService, field)),
    ]);
}

function runCachedProfilingWorkload(service: IComputationFunction, cacheScope: object, scopeKey: string) {
    return Promise.all([
        ...nominalFields.map((field) => profileNonmialFieldWithCache(service, field, { cacheScope, scopeKey })),
        ...quantitativeFields.map((field) => profileQuantitativeFieldWithCache(service, field, { cacheScope, scopeKey })),
    ]);
}

describe('data table profiling cache', () => {
    test('deduplicates in-flight nominal profiles and reuses resolved values in one scope', async () => {
        const { service } = createProfilingService();
        const cacheScope = {};

        const [first, second] = await Promise.all([
            profileNonmialFieldWithCache(service, 'category', { cacheScope, scopeKey: '[]' }),
            profileNonmialFieldWithCache(service, 'category', { cacheScope, scopeKey: '[]' }),
        ]);

        expect(first).toEqual(second);
        expect(service).toHaveBeenCalledTimes(2);

        await profileNonmialFieldWithCache(service, 'category', { cacheScope, scopeKey: '[]' });

        expect(service).toHaveBeenCalledTimes(2);
    });

    test('keeps different filter scopes isolated', async () => {
        const { service } = createProfilingService();
        const cacheScope = {};

        await profileNonmialFieldWithCache(service, 'category', { cacheScope, scopeKey: '[{"fid":"region","rule":"west"}]' });
        await profileNonmialFieldWithCache(service, 'category', { cacheScope, scopeKey: '[{"fid":"region","rule":"east"}]' });
        await profileNonmialFieldWithCache(service, 'category', { cacheScope, scopeKey: '[{"fid":"region","rule":"west"}]' });

        expect(service).toHaveBeenCalledTimes(4);
    });

    test('keeps nominal and quantitative profile modes isolated for the same field', async () => {
        const { service } = createProfilingService();
        const cacheScope = {};

        await profileNonmialFieldWithCache(service, 'value', { cacheScope, scopeKey: '[]' });
        await profileQuantitativeFieldWithCache(service, 'value', { cacheScope, scopeKey: '[]' });
        await profileNonmialFieldWithCache(service, 'value', { cacheScope, scopeKey: '[]' });
        await profileQuantitativeFieldWithCache(service, 'value', { cacheScope, scopeKey: '[]' });

        expect(service).toHaveBeenCalledTimes(3);
    });

    test('reuses a complete profiling workload across duplicate mounts', async () => {
        const before = createProfilingService();

        await Promise.all([runProfilingWorkload(before.service), runProfilingWorkload(before.service)]);

        expect(before.service).toHaveBeenCalledTimes(24);

        const after = createProfilingService();
        const cacheScope = {};

        await Promise.all([runCachedProfilingWorkload(after.service, cacheScope, '[]'), runCachedProfilingWorkload(after.service, cacheScope, '[]')]);
        await runCachedProfilingWorkload(after.service, cacheScope, '[]');

        expect(after.service).toHaveBeenCalledTimes(12);
    });

    test('limits profiling computation concurrency for wide tables', async () => {
        let active = 0;
        let maxActive = 0;
        const { service } = createProfilingService({
            delayMs: 5,
            onStart: () => {
                active++;
                maxActive = Math.max(maxActive, active);
            },
            onFinish: () => {
                active--;
            },
        });
        const cacheScope = {};

        await Promise.all(
            Array.from({ length: 12 }, (_, index) => profileQuantitativeFieldWithCache(service, `wide_value_${index}`, { cacheScope, scopeKey: '[]' }))
        );

        expect(service).toHaveBeenCalledTimes(12);
        expect(maxActive).toBeLessThanOrEqual(4);
    });

    test('releases profiling queue slots after synchronous computation errors', async () => {
        const cacheScope = {};
        const error = new Error('sync failure');
        const throwingService: IComputationFunction = jest.fn(() => {
            throw error;
        });

        await expect(profileQuantitativeFieldWithCache(throwingService, 'broken', { cacheScope, scopeKey: '[]' })).rejects.toThrow('sync failure');

        const { service } = createProfilingService();
        await Promise.all(
            Array.from({ length: 6 }, (_, index) => profileQuantitativeFieldWithCache(service, `recovered_${index}`, { cacheScope, scopeKey: '[]' }))
        );

        expect(throwingService).toHaveBeenCalledTimes(1);
        expect(service).toHaveBeenCalledTimes(6);
    });
});
