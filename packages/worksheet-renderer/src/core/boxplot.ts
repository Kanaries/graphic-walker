import { barIsHorizontal, bindingTypedValue } from './domains';
import { typedValueKey } from './keys';
import { PreparedDataError } from './errors';
import type { AxisLeaf, PaneData, RenderPlan, ResultBinding } from './types';

const roles = ['lower', 'q1', 'median', 'q3', 'upper'] as const;
/** Validate supplied statistics. This package never derives them from observations. */
export function validateBoxplotPane(plan: RenderPlan, pane: PaneData, row: AxisLeaf, column: AxisLeaf, bindings: ReadonlyMap<string, ResultBinding>): void {
    if (plan.mark !== 'boxplot') return;
    const metadata = plan.boxplot;
    const fail = (message: string): never => { throw new PreparedDataError('source-contract-violation', message); };
    if (!metadata) fail('Boxplot metadata columns are missing.');
    const horizontal = barIsHorizontal(plan, bindings.get(row.positionRef ?? ''));
    const valueBinding = bindings.get((horizontal ? column : row).positionRef ?? '');
    const categoryBinding = bindings.get((horizontal ? row : column).positionRef ?? '');
    const valueColumns = (horizontal ? plan.columns.positions : plan.rows.positions).map(ref => bindings.get(ref)!.columnKey);
    if (!valueBinding) fail('Boxplots require a numeric value position.');
    const groups = new Map<string, { category: string; series: string | undefined; stats: Map<string, number>; outliers: number[] }>();
    for (const record of pane.records) {
        const key = record.values[metadata!.groupKeyColumn], role = record.values[metadata!.roleColumn];
        if (typeof key !== 'string' || !key || typeof role !== 'string' || ![...roles, 'outlier', 'empty'].includes(role)) fail('Invalid prepared boxplot group or statistic role.');
        const value = record.values[valueBinding!.columnKey];
        if (role === 'empty') {
            if (valueColumns.some(column => record.values[column] !== null)) fail('Empty boxplot groups must have null measure values.');
            continue;
        }
        if (value === null) {
            // Null is only a projection into a different measure slot, never a missing statistic.
            if (!valueColumns.some(column => typeof record.values[column] === 'number' && Number.isFinite(record.values[column])))
                fail('A boxplot statistic or outlier must belong to a finite measure slot.');
            continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) fail('Boxplot statistics must be finite numbers or null.');
        const category = categoryBinding ? typedValueKey(bindingTypedValue(categoryBinding, record.values[categoryBinding.columnKey])) : '';
        let group = groups.get(key as string);
        if (!group) { group = { category, series: record.seriesKey, stats: new Map(), outliers: [] }; groups.set(key as string, group); }
        if (group.category !== category || group.series !== record.seriesKey) fail('One boxplot group cannot span categories or series.');
        if (role === 'outlier') group.outliers.push(value as number);
        else {
            if (group.stats.has(role as string)) fail('A boxplot group contains duplicate statistic roles.');
            group.stats.set(role as string, value as number);
        }
    }
    for (const group of groups.values()) {
        if (roles.some(role => !group.stats.has(role))) fail('A boxplot group must provide all five prepared statistics.');
        const values = roles.map(role => group.stats.get(role)!);
        if (values[0] > values[4] || values[1] > values[2] || values[2] > values[3]) fail('Boxplot statistics must be ordered Q1 <= median <= Q3 and lower <= upper.');
        if (group.outliers.some(value => value >= values[0] && value <= values[4])) fail('Prepared outliers must lie outside the supplied whisker endpoints.');
    }
}
