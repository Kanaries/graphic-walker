import * as parser from 'pgsql-ast-parser';
import { IMutField, IRow, ISemanticType } from '../interfaces';
import { sum, mean, median, stdev, variance, max, min, countTruly, distinctCount } from './op/stat';
import { dataframe2Dataset } from './execExp';

const aggregatorMap = {
    sum,
    mean,
    median,
    stdev,
    variance,
    max,
    min,
    count: countTruly,
    distinctCount,
};

export function parseSQLExpr(sql: string): parser.Expr {
    const ast = parser.parse(sql, 'expr');
    return ast;
}

export const reservedKeywords = new Set([
    'ALL',
    'ANALYSE',
    'ANALYZE',
    'AND',
    'ANY',
    'ARRAY',
    'AS',
    'ASC',
    'ASYMMETRIC',
    'BINARY',
    'BOTH',
    'CASE',
    'CAST',
    'CHECK',
    'COLLATE',
    'COLUMN',
    'CONCURRENTLY',
    'CONSTRAINT',
    'CREATE',
    'CROSS',
    'CURRENT_DATE',
    'CURRENT_ROLE',
    'CURRENT_TIME',
    'CURRENT_TIMESTAMP',
    'CURRENT_USER',
    'DEFAULT',
    'DEFERRABLE',
    'DESC',
    'DISTINCT',
    'DO',
    'ELSE',
    'END',
    'EXCEPT',
    'FALSE',
    'FETCH',
    'FOR',
    'FOREIGN',
    'FREEZE',
    'FROM',
    'FULL',
    'GRANT',
    'GROUP',
    'HAVING',
    'ILIKE',
    'IN',
    'INITIALLY',
    'INNER',
    'INTERSECT',
    'INTO',
    'IS',
    'ISNULL',
    'JOIN',
    'LATERAL',
    'LEADING',
    'LEFT',
    'LIKE',
    'LIMIT',
    'LOCALTIME',
    'LOCALTIMESTAMP',
    'NATURAL',
    'NOT',
    'NOTNULL',
    'NULL',
    'OFFSET',
    'ON',
    'ONLY',
    'OR',
    'ORDER',
    'OUTER',
    'OVERLAPS',
    'PLACING',
    'PRIMARY',
    'REFERENCES',
    'RETURNING',
    'RIGHT',
    'SELECT',
    'SESSION_USER',
    'SIMILAR',
    'SOME',
    'SYMMETRIC',
    'TABLE',
    'THEN',
    'TO',
    'TRAILING',
    'TRUE',
    'UNION',
    'UNIQUE',
    'USER',
    'USING',
    'VARIADIC',
    'VERBOSE',
    'WHEN',
    'WHERE',
    'WINDOW',
    'WITH',
]);

export const sqlFunctions = new Set([
    'abs',
    'atan2',
    'add',
    'currval',
    'octet_length',
    'array_length',
    'md5_number_lower',
    'upper',
    'make_timestamp',
    'array_resize',
    'ascii',
    'list_contains',
    'day',
    'get_bit',
    'substring',
    'subtract',
    'array_cat',
    'string_to_array',
    'error',
    'in_search_path',
    'list_concat',
    'lower',
    'base64',
    'editdist3',
    'regexp_matches',
    'nextval',
    'date_part',
    'typeof',
    'regexp_extract_all',
    'last_day',
    'millisecond',
    'month',
    'to_base64',
    'prefix',
    'divide',
    'ucase',
    'from_hex',
    'concat',
    'not_ilike_escape',
    'range',
    'substr',
    'unbin',
    'len',
    'split',
    'list_value',
    'list_position',
    'list_indexof',
    'enum_last',
    'not_like_escape',
    'even',
    'set_bit',
    'time_bucket',
    'regexp_replace',
    'struct_extract',
    'gcd',
    'constant_or_null',
    'apply',
    'vector_type',
    'list_filter',
    'chr',
    'array_contains',
    'ceiling',
    'radians',
    'nfc_normalize',
    'log10',
    'regexp_full_match',
    'alias',
    'length_grapheme',
    'suffix',
    'list_aggr',
    'ilike_escape',
    'multiply',
    'array_concat',
    'regexp_extract',
    'like_escape',
    'current_database',
    'hex',
    'isoyear',
    'transaction_timestamp',
    'array_indexof',
    'list_element',
    'jaccard',
    'yearweek',
    'to_months',
    'year',
    'xor',
    'weekofyear',
    'weekday',
    'lpad',
    'bit_length',
    'dayofyear',
    'union_tag',
    'uuid',
    'list_distance',
    'dayname',
    'unhex',
    'txid_current',
    'trunc',
    'encode',
    'to_minutes',
    'to_milliseconds',
    'to_binary',
    'to_base',
    'array_distinct',
    'timezone_hour',
    'tan',
    'struct_pack',
    'strptime',
    'strpos',
    'strlen',
    'atan',
    'str_split_regex',
    'str_split',
    'date_sub',
    'map_values',
    'least_common_multiple',
    'stats',
    'datediff',
    'starts_with',
    '!__postfix',
    'factorial',
    'sqrt',
    'element_at',
    'printf',
    'signbit',
    'sha256',
    'list_extract',
    'setseed',
    'enum_range',
    'second',
    'reverse',
    'replace',
    'damerau_levenshtein',
    'to_hours',
    'substring_grapheme',
    'repeat',
    'length',
    'to_microseconds',
    'century',
    'list_has',
    'current_date',
    'combine',
    'epoch_ns',
    'isinf',
    'rpad',
    'ceil',
    'format',
    'regexp_split_to_array',
    'today',
    'random',
    'quarter',
    'array_aggr',
    'position',
    'isnan',
    'age',
    'pi',
    'aggregate',
    'array_reverse_sort',
    'nextafter',
    'monthname',
    'array_position',
    'unicode',
    'concat_ws',
    'mismatches',
    'epoch',
    'minute',
    'mod',
    'millennium',
    'string_split_regex',
    'microsecond',
    'bit_position',
    'right_grapheme',
    'list_reverse_sort',
    'md5',
    'rtrim',
    'sign',
    'string_split',
    'list_resize',
    'map_keys',
    'map_entries',
    'exp',
    'map_concat',
    'map',
    'make_time',
    'week',
    'make_date',
    'power',
    '__internal_decompress_integral_usmallint',
    'ltrim',
    'log2',
    'pow',
    'log',
    'greatest',
    'list_cat',
    'list_unique',
    'contains',
    'list_transform',
    'timezone_minute',
    'list_sort',
    'list_pack',
    'list_dot_product',
    'list_apply',
    'array_slice',
    'lgamma',
    'map_extract',
    'left_grapheme',
    'least',
    'julian',
    'jaro_winkler_similarity',
    'isodow',
    'union_extract',
    'list_distinct',
    'isfinite',
    'to_years',
    'instr',
    'date_trunc',
    'sin',
    'translate',
    'array_filter',
    'strip_accents',
    'to_timestamp',
    'list_inner_product',
    'array_apply',
    'hash',
    'to_seconds',
    'decade',
    'hamming',
    'greatest_common_divisor',
    'ends_with',
    'get_current_timestamp',
    'try_strptime',
    'to_hex',
    'get_current_time',
    'timezone',
    'md5_number_upper',
    'generate_series',
    'strftime',
    'datepart',
    'levenshtein',
    '__internal_compress_integral_usmallint',
    'union_value',
    'gen_random_uuid',
    'array_extract',
    'from_binary',
    'list_slice',
    'from_base64',
    'row',
    'format_bytes',
    'flatten',
    'filter',
    'datetrunc',
    'cos',
    'era',
    'lcm',
    'decode',
    'hour',
    'finalize',
    'epoch_ms',
    'right',
    'enum_range_boundary',
    'degrees',
    'dayofweek',
    'array_sort',
    'datesub',
    'formatReadableDecimalSize',
    'date_diff',
    'array_has',
    'current_setting',
    'current_schemas',
    'map_from_entries',
    'array_transform',
    'current_query',
    'md5_number',
    'round',
    'list_cosine_similarity',
    'dayofmonth',
    'asin',
    'jaro_similarity',
    'enum_code',
    'cot',
    'list_aggregate',
    'ord',
    'cbrt',
    'array_unique',
    'struct_insert',
    'cardinality',
    'to_days',
    'acos',
    'version',
    'gamma',
    'trim',
    'floor',
    'left',
    'bit_count',
    'current_schema',
    'bin',
    'now',
    'bar',
    'epoch_us',
    'ln',
    'array_aggregate',
    'enum_first',
    'bitstring',
    'lcase',
]);

export const aggFuncs = new Set([
    'any_value',
    'arg_max',
    'max_by',
    'arg_min',
    'argMin',
    'min_by',
    'avg',
    'mean',
    'bit_and',
    'bit_or',
    'bit_xor',
    'bitstring_agg',
    'bool_and',
    'bool_or',
    'count',
    'favg',
    'first',
    'arbitrary',
    'fsum',
    'kahan_sum',
    'geomean',
    'geometric_mean',
    'histogram',
    'last',
    'list',
    'array_agg',
    'max',
    'min',
    'product',
    'string_agg',
    'group_concat',
    'listagg',
    'sum',
    'approx_count_distinct',
    'approx_quantile',
    'reservoir_quantile',
    'corr',
    'covar_pop',
    'covar_samp',
    'entropy',
    'kurtosis',
    'mad',
    'median',
    'mode',
    'quantile_cont',
    'quantile_disc',
    'quantile',
    'regr_avgx',
    'regr_avgy',
    'regr_count',
    'regr_intercept',
    'regr_r2',
    'regr_slope',
    'regr_sxx',
    'regr_sxy',
    'regr_syy',
    'skewness',
    'stddev_pop',
    'stddev_samp',
    'stddev',
    'var_pop',
    'var_samp',
    'variance',
]);

export function getSQLItemAnalyticType(item: parser.Expr, fields: IMutField[]) {
    const map = new Map<string, IMutField>();
    fields.forEach((f) => {
        map.set(f.name ?? f.fid, f);
    });
    const walk = (i: parser.Expr): [ISemanticType, boolean] => {
        switch (i.type) {
            case 'integer':
            case 'numeric':
                return ['quantitative', false];
            case 'null':
            case 'string':
            case 'boolean':
                return ['nominal', false];
            case 'unary':
                const [_, agg] = walk(i.operand);
                switch (i.op) {
                    case '+':
                    case '-':
                        return ['quantitative', agg];
                    default:
                        return ['nominal', agg];
                }
            case 'ref': {
                const f = map.get(i.name);
                if (f) {
                    return [f.semanticType, false];
                }
                return ['nominal', false];
            }
            case 'case': {
                if (i.else) {
                    return walk(i.else);
                } else {
                    return walk(i.whens[0].value);
                }
            }
            case 'array':
            case 'list': {
                if (i.expressions.length) {
                    return walk(i.expressions[0]);
                }
                return ['nominal', false];
            }
            case 'binary': {
                return walk(i.left);
            }
            case 'call': {
                if (i.function.name === 'count') {
                    return ['quantitative', true];
                }
                const [t] = walk(i.args[0]);
                return [t, aggFuncs.has(i.function.name.toLowerCase())];
            }
            case 'cast': {
                const [_, agg] = walk(i.operand);
                if ('name' in i.to) {
                    switch (i.to.name.toLowerCase()) {
                        case 'date':
                        case 'timestamp':
                        case 'timestamp with time zone':
                        case 'time':
                        case 'time with time zone':
                        case 'interval':
                            return ['temporal', agg];
                        case 'smallint':
                        case 'integer':
                        case 'bigint':
                        case 'decimal':
                        case 'numeric':
                        case 'real':
                        case 'double precision':
                        case 'smallserial':
                        case 'serial':
                        case 'bigserial':
                            return ['quantitative', agg];
                    }
                }
                return ['nominal', agg];
            }
            default:
                return ['nominal', false];
        }
    };
    return walk(item);
}

export function walkFid(sql: string): string[] {
    const set = new Set<string>();
    const walk = (i: parser.Expr) => {
        if (i.type === 'ref') {
            set.add(i.name);
        } else {
            Object.values(i).forEach((x) => {
                if (x !== null && typeof x === 'object' && 'type' in x) {
                    walk(x);
                }
            });
        }
    };
    walk(parseSQLExpr(sql));
    return Array.from(set);
}

export function replaceFid(sql: string, fields: IMutField[]): string {
    const dict = new Map<string, IMutField>();
    fields.forEach((f) => {
        dict.set((f.name ?? f.fid).toLowerCase(), f);
    });
    const item = parseSQLExpr(sql);
    const mapper = parser.astMapper(() => ({
        ref: (r) => {
            return parser.assignChanged(r, { name: dict.get(r.name.toLowerCase())?.fid || r.name });
        },
    }));
    return parser.toSql.expr(mapper.expr(item)!);
}

function fmap<T>(x: T | T[], mapper: (i: T) => T) {
    if (x instanceof Array) {
        return x.map(mapper);
    }
    return mapper(x);
}

function performOp<T>(op: (x: T, y: T) => T, a: T | T[], b: T | T[]) {
    if (a instanceof Array) {
        if (b instanceof Array) {
            return a.map((x, i) => op(x, b[i]));
        }
        return a.map((x) => op(x, b));
    }
    if (b instanceof Array) {
        return b.map((y) => op(a, y));
    }
    return op(a, b);
}

const isSingleTruly = (x: unknown | [unknown]) => {
    if (x instanceof Array) {
        return !!x[0];
    }
    return !!x;
};

function exprSQL(item: parser.Expr, datas: IRow[] | Record<string, any[]>): (string | number | boolean | null) | (string | number | boolean | null)[] {
    const exec = (i: parser.Expr) => {
        switch (i.type) {
            case 'ref': {
                if (datas instanceof Array) {
                    if (datas[0][i.name] === undefined && i.name !== '*') {
                        throw new Error(`there is no field named ${i.name}`);
                    }
                    if (i.name === '*') {
                        return datas.map((r) => r[Object.keys(r)[0]]);
                    }

                    return datas.map((r) => r[i.name]);
                } else {
                    if (!datas[i.name] && i.name !== '*') {
                        throw new Error(`there is no field named ${i.name}`);
                    }
                    if (i.name === '*') {
                        return datas[Object.keys(datas)[0]];
                    }
                    return datas[i.name];
                }
            }
            case 'integer':
            case 'numeric':
            case 'string':
            case 'boolean': {
                return i.value;
            }
            case 'binary': {
                let op: (x: any, y: any) => any;
                switch (i.op) {
                    case '!=':
                        op = (x, y) => x != y;
                        break;
                    case '%':
                        op = (x, y) => x % y;
                        break;
                    case '*':
                        op = (x, y) => x * y;
                        break;
                    case '/':
                        op = (x, y) => x / y;
                        break;
                    case '+':
                        op = (x, y) => x + y;
                        break;
                    case '-':
                        op = (x, y) => x - y;
                        break;
                    case '=':
                        op = (x, y) => x == y;
                        break;
                    case '>':
                        op = (x, y) => x > y;
                        break;
                    case '<':
                        op = (x, y) => x < y;
                        break;
                    case '>=':
                        op = (x, y) => x >= y;
                        break;
                    case '<=':
                        op = (x, y) => x <= y;
                        break;
                    case 'OR':
                        op = (x, y) => x || y;
                        break;
                    case 'AND':
                        op = (x, y) => x && y;
                        break;
                    case '~':
                        op = (x, y) => new RegExp(y).test(x);
                        break;
                    case '~*':
                        op = (x, y) => new RegExp(y, 'i').test(x);
                        break;
                    case '!~':
                        op = (x, y) => !new RegExp(y).test(x);
                        break;
                    case '!~*':
                        op = (x, y) => !new RegExp(y, 'i').test(x);
                        break;
                    default:
                        throw new Error(`unsupport op ${i.op}, calculating ${parser.toSql.expr(i)}`);
                }
                return performOp(op, exec(i.left), exec(i.right));
            }
            case 'unary': {
                switch (i.op) {
                    case '+': {
                        return fmap((a) => +a, exec(i.operand));
                    }
                    case '-': {
                        return fmap((a) => -a, exec(i.operand));
                    }
                    case 'NOT': {
                        return fmap((a) => !a, exec(i.operand));
                    }
                    default: {
                        throw new Error(`unsupport unary ${i.op}, calculating ${parser.toSql.expr(i)}`);
                    }
                }
            }
            case 'call': {
                if (i.function.name in aggregatorMap) {
                    return aggregatorMap[i.function.name](exec(i.args[0]));
                } else {
                    throw new Error(`unsupport function ${i.function.name}, calculating ${parser.toSql.expr(i)}`);
                }
            }
            case 'case': {
                if (datas instanceof Array) {
                    if (datas.length === 1) {
                        const sat: parser.ExprWhen | undefined = i.whens.find((x) => isSingleTruly(exec(x.when)));
                        if (sat) {
                            return exec(sat.value);
                        } else {
                            return i.else ? exec(i.else) : null;
                        }
                    } else {
                        return datas.flatMap((r) => exprSQL(i, [r]));
                    }
                } else {
                    return exprSQL(i, dataframe2Dataset(datas));
                }
            }
            default: {
                throw new Error(`unsupport type ${i.type}, calculating ${parser.toSql.expr(i)}`);
            }
        }
    };
    return exec(item) as (string | number | boolean | null) | (string | number | boolean | null)[];
}

export function expr(sql: string, datas: IRow[] | Record<string, any[]>) {
    return exprSQL(parseSQLExpr(sql), datas);
}
