import type { IAggQuery, IDataQueryWorkflowStep, IRow } from '../../interfaces';
import type { Diagnostic, ReadVersion } from '@kanaries/worksheet-renderer';
import type { FoldRecordMetadata } from '../op/fold';

export type NativeRowKey = string | number;
export type NativeGetRowKey = (queryRow: Readonly<IRow>, queryIndex: number) => NativeRowKey;

/** Typed original result values, never labels or concatenated delimiters. */
export function resultValueIdentity(value: unknown): readonly unknown[] {
    if (value === null) return ['null'];
    if (typeof value === 'string') return ['string', value];
    if (typeof value === 'boolean') return ['boolean', value];
    if (typeof value === 'number' && Number.isFinite(value)) return ['number', Object.is(value, -0) ? 0 : value];
    if (Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'number' && Number.isFinite(part))) {
        return ['interval', resultValueIdentity(value[0]), resultValueIdentity(value[1])];
    }
    throw new TypeError('Result identity requires a present primitive value or a finite two-endpoint interval.');
}

export function declaredResultQuery(workflow: readonly IDataQueryWorkflowStep[]) {
    const queries = workflow.flatMap((step) => (step.type === 'view' ? step.query : []));
    // GW toWorkflow emits one aggregate/raw view. Other shapes need an explicit host
    // identity contract rather than inferred grain after an unknown transformation.
    return queries.length === 1 && (queries[0].op === 'aggregate' || queries[0].op === 'raw') ? queries[0] : undefined;
}

export function prepareResultIdentity(input: {
    readonly queryRows: readonly IRow[];
    readonly workflow: readonly IDataQueryWorkflowStep[];
    readonly version: ReadVersion;
    readonly metadata: readonly FoldRecordMetadata[];
    readonly getRowKey?: NativeGetRowKey;
}) {
    const diagnostics: Diagnostic[] = [];
    const reject = (message: string) =>
        diagnostics.push({ code: 'unstable-datum-identity', severity: 'error', recoverable: true, configRef: 'prepared.identity', message });
    const query = declaredResultQuery(input.workflow);
    const aggregate: IAggQuery | undefined = query?.op === 'aggregate' ? query : undefined;
    const stable = Boolean(aggregate || input.getRowKey);
    if (!stable)
        diagnostics.push({
            code: 'snapshot-datum-identity',
            severity: 'warning',
            recoverable: true,
            configRef: 'prepared.identity',
            message:
                'No stable host row key was supplied. Raw selection identity is limited to this result snapshot; duplicate rows cannot be tracked across queries.',
        });
    if (!query) reject('The completed workflow does not declare exactly one raw or aggregate result view.');
    const groupBy = [...new Set(aggregate?.groupBy ?? [])].sort();
    const bindingSignature = aggregate?.measures
        .map(({ asFieldKey, agg, field }) => [asFieldKey, agg, field])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const bases: string[] = [];
    const seenBase = new Set<string>();
    for (let index = 0; index < input.queryRows.length; index++) {
        const record = input.queryRows[index];
        let key: string;
        try {
            if (aggregate) {
                key = JSON.stringify([
                    'gw-result',
                    input.version.sourceId,
                    'aggregate',
                    bindingSignature,
                    groupBy.map((fid) => {
                        if (!Object.prototype.hasOwnProperty.call(record, fid)) throw new TypeError(`Missing group key ${JSON.stringify(fid)}.`);
                        return [fid, resultValueIdentity(record[fid])];
                    }),
                ]);
            } else if (input.getRowKey) {
                const supplied = input.getRowKey(record, index);
                if (!((typeof supplied === 'string' && supplied.length > 0) || (typeof supplied === 'number' && Number.isFinite(supplied))))
                    throw new TypeError('Host row keys must be nonempty strings or finite numbers.');
                key = JSON.stringify(['gw-result', input.version.sourceId, 'raw', resultValueIdentity(supplied)]);
            } else {
                key = JSON.stringify(['gw-result', input.version.sourceId, 'snapshot', input.version.snapshotId, index]);
            }
            if (seenBase.has(key)) throw new TypeError('Two query rows have the same declared result identity.');
            seenBase.add(key);
        } catch (error) {
            reject(`Query row ${index}: ${error instanceof Error ? error.message : String(error)}`);
            // This is only an invalid-result placeholder. Error diagnostics prohibit
            // using the result; it must never be advertised as a stable fallback.
            key = JSON.stringify(['invalid-result', input.version.sourceId, input.version.snapshotId, index]);
        }
        bases.push(key);
    }
    const keys = input.metadata.map(({ inputIndex, branch }) =>
        JSON.stringify([bases[inputIndex], branch ? [branch.fid, branch.aggName ?? null, branch.columnKey] : null]),
    );
    if (new Set(keys).size !== keys.length) reject('Fold configuration produced duplicate result identities.');
    return {
        keys,
        identityScope: (stable && !diagnostics.some((item) => item.severity === 'error') ? 'stable' : 'snapshot') as 'stable' | 'snapshot',
        diagnostics,
    };
}
