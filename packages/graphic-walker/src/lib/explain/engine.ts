import type { IComputationFunction, IRow } from '../../interfaces';
import type { IExplainContext, IExplainOptions, IExplainer, IExplainerResult } from './types';
import { stableStringify } from './queries';

/**
 * Explain Data engine: executes explainers against a computation service.
 *
 * - every payload produced by `plan()` is deduplicated by structural hash,
 *   so explainers sharing a query (contributing-dimension / unique-mark)
 *   trigger a single execution;
 * - query execution is capped by a concurrency limiter;
 * - results stream out per explainer as soon as its queries settle, in
 *   completion order — the UI renders progressively.
 */

const DEFAULT_CONCURRENCY = 4;

type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

function createLimiter(max: number): Limiter {
    let active = 0;
    const waiters: (() => void)[] = [];
    return async function run<T>(fn: () => Promise<T>): Promise<T> {
        if (active >= max) {
            await new Promise<void>((resolve) => waiters.push(resolve));
        }
        active++;
        try {
            return await fn();
        } finally {
            active--;
            waiters.shift()?.();
        }
    };
}

export async function* explainMark(
    ctx: IExplainContext,
    computation: IComputationFunction,
    explainers: IExplainer[],
    options?: IExplainOptions
): AsyncGenerator<IExplainerResult> {
    const limiter = createLimiter(options?.concurrency ?? DEFAULT_CONCURRENCY);
    const queryCache = new Map<string, Promise<IRow[]>>();

    const runQuery = (payloadKey: string, payload: Parameters<IComputationFunction>[0]): Promise<IRow[]> => {
        const cached = queryCache.get(payloadKey);
        if (cached) return cached;
        const promise = limiter(async () => (await computation(payload)) as IRow[]);
        queryCache.set(payloadKey, promise);
        return promise;
    };

    const pending: Promise<IExplainerResult>[] = [];

    for (const explainer of explainers) {
        const applicability = explainer.isApplicable(ctx);
        if (!applicability.applicable) {
            pending.push(
                Promise.resolve({
                    explainer: explainer.type,
                    status: 'skipped',
                    reason: applicability.reason,
                    explanations: [],
                })
            );
            continue;
        }
        pending.push(
            (async (): Promise<IExplainerResult> => {
                try {
                    const payloads = explainer.plan(ctx);
                    const results = await Promise.all(payloads.map((p) => runQuery(stableStringify(p), p)));
                    const explanations = explainer.analyze(ctx, results);
                    return { explainer: explainer.type, status: 'ok', explanations };
                } catch (err) {
                    return {
                        explainer: explainer.type,
                        status: 'error',
                        reason: err instanceof Error ? err.message : String(err),
                        explanations: [],
                    };
                }
            })()
        );
    }

    // yield in completion order
    const tagged = pending.map((p, i) => p.then((result) => ({ i, result })));
    const remaining = new Map(tagged.map((p, i) => [i, p]));
    while (remaining.size > 0) {
        const { i, result } = await Promise.race(remaining.values());
        remaining.delete(i);
        yield result;
    }
}

/** convenience wrapper: run all explainers to completion and collect results */
export async function explainMarkAll(
    ctx: IExplainContext,
    computation: IComputationFunction,
    explainers: IExplainer[],
    options?: IExplainOptions
): Promise<IExplainerResult[]> {
    const results: IExplainerResult[] = [];
    for await (const result of explainMark(ctx, computation, explainers, options)) {
        results.push(result);
    }
    return results;
}
