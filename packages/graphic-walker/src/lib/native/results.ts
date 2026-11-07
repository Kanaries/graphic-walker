import type { IChart, IDataQueryWorkflowStep, IRow, IViewField } from '../../interfaces';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { getMeaAggKey } from '../../utils';
import type { Diagnostic, PreparedRecord, ReadVersion } from '@kanaries/worksheet-renderer';
import { typedValueKey } from '@kanaries/worksheet-renderer';
import { fold2WithMetadata, type FoldBranch, type FoldRecordMetadata } from '../op/fold';
import type { PreparedColumn } from './adapter';
import { declaredResultQuery, prepareResultIdentity, type NativeGetRowKey } from './identity';
import { prepareTemporalValue } from './temporal';
import { nativeEncodingKeys } from '../../models/visSpec';
import type { BoxplotComputationResult } from '../../computation/boxplot';
import type { RenderPlan } from '@kanaries/worksheet-renderer';

export interface NativeResultInput {
    /** The immutable chart snapshot used to execute workflow, not the current edited chart. */
    readonly chart: IChart;
    /** Completed dataQuery output, before legacy fold2. No query is executed here. */
    readonly queryRows: readonly IRow[];
    readonly workflow: readonly IDataQueryWorkflowStep[];
    /** Owned by the host transaction. Changing values or their interpretation requires new IDs. */
    readonly version: ReadVersion;
    readonly getRowKey?: NativeGetRowKey;
    /** Statistics already produced by the common computation stage. */
    readonly boxplot?: BoxplotComputationResult;
}

export interface NativeResultSnapshot {
    readonly chart: IChart;
    readonly records: readonly PreparedRecord[];
    readonly columns: readonly NativePreparedColumn[];
    /** Original configRef -> actual prepared display column. Never persisted in IChart. */
    readonly fieldColumns: ReadonlyMap<string, string>;
    /** Result record -> original query row and original fold column identity, if folded. */
    readonly foldMetadata: readonly FoldRecordMetadata[];
    readonly version: ReadVersion;
    readonly identityScope: 'stable' | 'snapshot';
    readonly getDatumKey: (record: PreparedRecord, inputIndex?: number) => string;
    readonly diagnostics: readonly Diagnostic[];
    readonly boxplot?: RenderPlan['boxplot'];
}

/** Display-only metadata. Keys use the renderer's canonical typed value encoding. */
export interface NativePreparedColumn extends PreparedColumn {
    readonly valueLabels?: Readonly<Record<string, string>>;
}

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);
const isInterval = (value: unknown) =>
    Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'number' && Number.isFinite(part)) && value[0] <= value[1];
const isScalar = (value: unknown) =>
    value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const foldBranchValue = (branch: FoldBranch) => JSON.stringify([branch.fid, branch.aggName ?? null, branch.columnKey]);

function declaredType(field: IViewField | undefined, measure = false): PreparedColumn['valueType'] {
    if (measure || field?.analyticType === 'measure') return 'number';
    if (field?.expression?.op === 'bin') return 'interval';
    if (field?.expression?.op === 'binCount') return 'number';
    return field?.semanticType === 'quantitative' ? 'number' : 'string';
}

/**
 * Adapt already-computed GW query results. Business values remain unchanged; only
 * existing fold presentation and explicit temporal display coordinates are prepared.
 * Error diagnostics prohibit publishing the snapshot. Warnings describe identity limits.
 */
export function prepareNativeResults(input: NativeResultInput): NativeResultSnapshot {
    const { chart, queryRows, workflow } = input;
    const version = Object.freeze({ ...input.version });
    const diagnostics: Diagnostic[] = [];
    const reject = (code: string, configRef: string, message: string) => diagnostics.push({ code, configRef, message, severity: 'error', recoverable: true });
    const isBoxplot = chart.config.geoms[0] === 'boxplot';
    const defaultAggregated = isBoxplot ? false : chart.config.defaultAggregated;
    if (isBoxplot && !input.boxplot) reject('missing-boxplot-statistics', 'prepared.boxplot', 'Boxplots require statistics from the completed computation stage.');
    if (!['sourceId', 'snapshotId', 'presentationId'].every((key) => typeof version[key] === 'string' && version[key].length > 0)) {
        reject('invalid-version', 'prepared.version', 'All three host result version IDs must be nonempty strings.');
    }
    const occurrences = nativeEncodingKeys(chart.config.geoms[0]).flatMap((channel) => chart.encodings[channel].map((field, index) => ({ field, configRef: `encodings.${channel}[${index}]` })));
    const viewFields = occurrences.map(({ field }) => field);
    const allFields = [...chart.encodings.dimensions, ...chart.encodings.measures];
    const byFid = new Map([...allFields, ...viewFields].map((field) => [field.fid, field]));
    const folded = fold2WithMetadata(
        queryRows,
        defaultAggregated,
        allFields,
        viewFields.filter((field) => field.analyticType === 'measure'),
        viewFields.filter((field) => field.analyticType === 'dimension'),
        chart.config.folds,
    );
    const identity = prepareResultIdentity({ queryRows, workflow, version, metadata: folded.metadata, getRowKey: input.getRowKey });
    diagnostics.push(...identity.diagnostics);
    const columns = new Map<string, NativePreparedColumn>();
    const declaredKeys = new Set<string>();
    const query = declaredResultQuery(workflow);
    const addOriginal = (columnKey: string, field?: IViewField, measure = false) => {
        declaredKeys.add(columnKey);
        columns.set(columnKey, { columnKey, valueType: declaredType(field, measure) });
    };
    if (query?.op === 'raw') for (const key of query.fields) addOriginal(key, byFid.get(key));
    if (query?.op === 'aggregate') {
        for (const key of query.groupBy) addOriginal(key, byFid.get(key));
        for (const measure of query.measures) addOriginal(measure.asFieldKey, byFid.get(measure.field), true);
    }
    if (folded.active) {
        for (const [index, fid] of (chart.config.folds ?? []).entries()) {
            const field = allFields.find((candidate) => candidate.fid === fid);
            if (!field) reject('missing-binding', `config.folds[${index}]`, `Fold field ${JSON.stringify(fid)} is not declared in the chart fields.`);
            else if (!defaultAggregated && field.aggName === 'expr')
                reject(
                    'missing-binding',
                    `config.folds[${index}]`,
                    'The selected aggregate expression has no raw result column. Legacy fold omits it; native requires an explicit prepared binding.',
                );
        }
        addOriginal(MEA_KEY_ID);
        const meaVal = viewFields.find((field) => field.fid === MEA_VAL_ID)!;
        addOriginal(defaultAggregated ? getMeaAggKey(MEA_VAL_ID, meaVal.aggName) : MEA_VAL_ID, meaVal, true);
        for (const branch of folded.branches) {
            if (!declaredKeys.has(branch.columnKey))
                reject('missing-binding', 'config.folds', `Fold result column ${JSON.stringify(branch.columnKey)} is not declared by the completed workflow.`);
            const missing = queryRows.findIndex((record) => !has(record, branch.columnKey) || record[branch.columnKey] === undefined);
            if (missing >= 0)
                reject('missing-binding', 'config.folds', `Query row ${missing} is missing fold result column ${JSON.stringify(branch.columnKey)}.`);
        }
    }

    // Keep query values, including fold source columns, available for raw callbacks.
    // Legacy fold2 still returns its original projection to the other renderers.
    const records: IRow[] = folded.records.map((record, index) => {
        const result = { ...queryRows[folded.metadata[index].inputIndex], ...record };
        for (const key of Object.keys(result)) if (Array.isArray(result[key])) result[key] = Object.freeze([...result[key]]);
        return result;
    });
    const reservedKeys = new Set(declaredKeys);
    for (const record of records) for (const key of Object.keys(record)) reservedKeys.add(key);
    const allocateColumn = (preferred: string) => {
        let key = preferred;
        for (let suffix = 1; reservedKeys.has(key); suffix++) key = `${preferred}_${suffix}`;
        reservedKeys.add(key);
        return key;
    };
    let foldColumn: string | undefined;
    if (folded.active) {
        foldColumn = allocateColumn('__gw_native_fold_branch');
        const valueLabels = Object.freeze(
            Object.fromEntries(folded.branches.map((branch) => [typedValueKey({ type: 'string', value: foldBranchValue(branch) }), branch.label])),
        );
        columns.set(foldColumn, { columnKey: foldColumn, valueType: 'string', rawColumnKey: MEA_KEY_ID, valueLabels });
        records.forEach((record, index) => {
            record[foldColumn!] = foldBranchValue(folded.metadata[index].branch!);
        });
    }
    const fieldColumns = new Map<string, string>();
    const converted = new Map<string, string>();
    const validated = new Set<string>();
    const localOffset = new Date().getTimezoneOffset();
    for (const { field, configRef } of occurrences) {
        const resultKey = defaultAggregated && field.analyticType === 'measure' ? getMeaAggKey(field.fid, field.aggName) : field.fid;
        if (!declaredKeys.has(resultKey)) {
            reject('missing-binding', configRef, `Result column ${JSON.stringify(resultKey)} is not declared by the completed workflow.`);
            continue;
        }
        fieldColumns.set(configRef, resultKey);
        const type = declaredType(field);
        const temporal = field.semanticType === 'temporal' && field.analyticType !== 'measure';
        if (temporal && field.timeUnit && field.expression?.op !== 'dateTimeDrill') {
            reject(
                'unsupported-encoding',
                configRef,
                'timeUnit requires an existing dateTimeDrill result; result preparation does not execute temporal expressions.',
            );
            continue;
        }
        if (temporal) {
            try {
                prepareTemporalValue(null, { fieldOffset: field.offset, displayOffset: chart.config.timezoneDisplayOffset, localOffset });
            } catch (error) {
                reject('invalid-binding-type', configRef, error instanceof Error ? error.message : String(error));
                continue;
            }
        }
        const validationKey = JSON.stringify([resultKey, type, temporal]);
        if (!validated.has(validationKey)) {
            validated.add(validationKey);
            const invalid = records.findIndex((record) => {
                if (!has(record, resultKey) || record[resultKey] === undefined) return true;
                const value = record[resultKey];
                return (
                    value !== null &&
                    !(temporal
                        ? typeof value === 'string' || typeof value === 'number'
                        : type === 'interval'
                          ? isInterval(value)
                          : type === 'number'
                            ? typeof value === 'number' && Number.isFinite(value)
                            : isScalar(value))
                );
            });
            if (invalid >= 0) {
                const missing = !has(records[invalid], resultKey) || records[invalid][resultKey] === undefined;
                reject(
                    missing ? 'missing-binding' : 'invalid-binding-type',
                    configRef,
                    `Prepared row ${invalid} ${missing ? 'is missing' : 'has an invalid value for'} result column ${JSON.stringify(resultKey)}.`,
                );
            }
        }
        if (foldColumn && field.fid === MEA_KEY_ID) {
            fieldColumns.set(configRef, foldColumn);
            continue;
        }
        if (!temporal) {
            columns.set(resultKey, { columnKey: resultKey, valueType: type });
            continue;
        }
        // Raw columns are ordinary result values; only the new coordinate column is time.
        const sample = records.find((record) => record[resultKey] !== null && record[resultKey] !== undefined)?.[resultKey];
        columns.set(resultKey, { columnKey: resultKey, valueType: typeof sample === 'number' ? 'number' : 'string' });
        const signature = JSON.stringify([resultKey, field.offset ?? localOffset, chart.config.timezoneDisplayOffset ?? localOffset]);
        let displayKey = converted.get(signature);
        if (!displayKey) {
            displayKey = allocateColumn(`__gw_native_time_${signature}`);
            converted.set(signature, displayKey);
            let invalidReported = false;
            for (let index = 0; index < records.length; index++) {
                try {
                    records[index][displayKey] = prepareTemporalValue(records[index][resultKey], {
                        fieldOffset: field.offset,
                        displayOffset: chart.config.timezoneDisplayOffset,
                        localOffset,
                    });
                } catch (error) {
                    // Failed snapshots cannot be submitted; no invalid value is silently
                    // turned into a missing mark in a successful result.
                    if (!invalidReported)
                        reject('invalid-binding-type', configRef, `Prepared row ${index}: ${error instanceof Error ? error.message : String(error)}`);
                    invalidReported = true;
                }
            }
            columns.set(displayKey, { columnKey: displayKey, valueType: 'time', rawColumnKey: resultKey });
        }
        fieldColumns.set(configRef, displayKey);
    }
    let displayRecords = records;
    let displayMetadata: FoldRecordMetadata[] = [...folded.metadata];
    let datumKeys = identity.keys;
    let boxplot: RenderPlan['boxplot'];
    if (isBoxplot && input.boxplot) {
        const groupKeyColumn = allocateColumn('__gw_boxplot_group');
        const roleColumn = allocateColumn('__gw_boxplot_role');
        boxplot = { groupKeyColumn, roleColumn };
        columns.set(groupKeyColumn, { columnKey: groupKeyColumn, valueType: 'string' });
        columns.set(roleColumn, { columnKey: roleColumn, valueType: 'string' });
        const measureColumns = new Set([...chart.encodings.rows, ...chart.encodings.columns].filter((field) => field.analyticType === 'measure').map((field) => field.fid));
        // A measure reused as a color/detail must retain its original visual group value.
        const originals = new Map<string, string>();
        for (const { field, configRef } of occurrences) if (!/^encodings\.(rows|columns)\[/.test(configRef) && measureColumns.has(field.fid)) {
            let key = originals.get(field.fid);
            if (!key) {
                key = allocateColumn(`__gw_boxplot_original_${field.fid}`);
                originals.set(field.fid, key);
                // The alias itself holds the original value. The measure column below becomes a statistic or null.
                columns.set(key, { columnKey: key, valueType: 'number' });
                for (const record of records) record[key] = record[field.fid];
            }
            fieldColumns.set(configRef, key);
        }
        displayRecords = [];
        displayMetadata = [];
        datumKeys = [];
        const seen = new Set<string>();
        const append = (groupKey: string, measureColumn: string, role: string, value: number, inputIndex: number, key: string) => {
            displayRecords.push({ ...records[inputIndex], ...Object.fromEntries([...measureColumns].map((column) => [column, null])), [measureColumn]: value, [groupKeyColumn]: groupKey, [roleColumn]: role });
            displayMetadata.push({ inputIndex });
            datumKeys.push(key);
        };
        for (const group of input.boxplot.groups) {
            const groupKey = JSON.stringify([group.groupKey, group.measureColumn]);
            const values = [group.lowerWhisker, group.q1, group.median, group.q3, group.upperWhisker];
            if (!measureColumns.has(group.measureColumn) || !Number.isInteger(group.representativeIndex) || !records[group.representativeIndex]
                || values.some((value) => !Number.isFinite(value)) || group.q1 > group.median || group.median > group.q3 || group.lowerWhisker > group.upperWhisker || seen.has(groupKey)) {
                reject('invalid-boxplot-statistics', 'prepared.boxplot', 'Each boxplot group needs a unique measure, an original row and ordered finite statistics.');
                continue;
            }
            seen.add(groupKey);
            for (const [index, role] of ['lower', 'q1', 'median', 'q3', 'upper'].entries())
                append(groupKey, group.measureColumn, role, values[index], group.representativeIndex, JSON.stringify(['gw-boxplot-summary', version.sourceId, group.groupKey, group.measureColumn, role]));
            for (const outlier of group.outliers) {
                if (!Number.isInteger(outlier.inputIndex) || !records[outlier.inputIndex] || !Number.isFinite(outlier.value) || records[outlier.inputIndex][group.measureColumn] !== outlier.value) {
                    reject('invalid-boxplot-statistics', 'prepared.boxplot', 'An outlier must reference its unchanged original numeric sample.');
                    continue;
                }
                append(groupKey, group.measureColumn, 'outlier', outlier.value, outlier.inputIndex, JSON.stringify(['gw-boxplot-outlier', identity.keys[outlier.inputIndex], group.measureColumn]));
            }
        }
        // The computation stage supplies one representative per all-null group.
        const emptyKeys = new Set<string>();
        for (const empty of input.boxplot.emptyGroups ?? []) {
            const inputIndex = empty.representativeIndex, record = records[inputIndex];
            if (!Number.isInteger(inputIndex) || !record || !measureColumns.size || [...measureColumns].some((column) => record[column] !== null) || emptyKeys.has(empty.groupKey)) {
                reject('invalid-boxplot-statistics', 'prepared.boxplot', 'An empty boxplot group needs one original all-null representative.');
                continue;
            }
            emptyKeys.add(empty.groupKey);
            const key = JSON.stringify(['gw-boxplot-empty', version.sourceId, empty.groupKey]);
            displayRecords.push({ ...record, [groupKeyColumn]: key, [roleColumn]: 'empty' });
            displayMetadata.push({ inputIndex });
            datumKeys.push(key);
        }
    }
    const immutableRecords = Object.freeze(displayRecords.map((record) => Object.freeze(record)));
    const keyByRecord = new WeakMap<PreparedRecord, string>();
    immutableRecords.forEach((record, index) => keyByRecord.set(record, datumKeys[index]));
    const invalidIdentity = identity.diagnostics.some((item) => item.severity === 'error');
    const invalidResult = diagnostics.some((item) => item.severity === 'error');
    return {
        chart,
        records: immutableRecords,
        columns: Object.freeze([...columns.values()].map((column) => Object.freeze(column))),
        fieldColumns,
        foldMetadata: Object.freeze(
            displayMetadata.map((item) => Object.freeze({ ...item, ...(item.branch ? { branch: Object.freeze({ ...item.branch }) } : {}) })),
        ),
        ...(boxplot ? { boxplot } : {}),
        version,
        identityScope: identity.identityScope,
        diagnostics: Object.freeze(diagnostics),
        getDatumKey(record) {
            if (invalidIdentity) throw new Error('Cannot use datum keys from a result with identity errors.');
            if (invalidResult) throw new Error('Cannot use datum keys from a result with preparation errors.');
            const key = keyByRecord.get(record);
            if (key === undefined) throw new Error('The record does not belong to this prepared result snapshot.');
            return key;
        },
    };
}
