'use strict';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
const NUMBER_LITERAL = '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';

function correctOpenRangeSQL(sql, payload) {
    // gw-dsl-parser <= 0.1.51 emits strict comparisons for one-sided range
    // filters. Keep this correction scoped to generated WHERE/AND predicates;
    // remove it once the parser itself implements inclusive boundaries.
    let result = sql;
    for (const step of payload.workflow ?? []) {
        if (step.type !== 'filter') continue;
        for (const filter of step.filters ?? []) {
            if (filter.rule?.type !== 'range') continue;
            const [lower, upper] = filter.rule.value;
            if ((lower === null || lower === undefined) === (upper === null || upper === undefined)) continue;

            const boundary = lower ?? upper;
            const operator = lower === null || lower === undefined ? '<' : '>';
            const identifier = escapeRegExp(quoteIdentifier(filter.fid));
            const condition = new RegExp(`(\\b(?:WHERE|AND)\\s+)(\\(*\\s*)(${identifier}\\s*)${operator}(?!=)\\s*(${NUMBER_LITERAL})`, 'g');
            result = result.replace(condition, (match, prefix, parentheses, field, literal) => {
                return Number(literal) === boundary ? `${prefix}${parentheses}${field}${operator}= ${literal}` : match;
            });
        }
    }
    return result;
}

function compileWorkflowToSQL(parser, tableName, payload) {
    return correctOpenRangeSQL(parser(tableName, JSON.stringify(payload)), payload);
}

exports.correctOpenRangeSQL = correctOpenRangeSQL;
exports.compileWorkflowToSQL = compileWorkflowToSQL;
