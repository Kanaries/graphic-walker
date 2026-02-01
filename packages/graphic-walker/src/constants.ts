export const COUNT_FIELD_ID = 'gw_count_fid';
export const DATE_TIME_DRILL_LEVELS = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'iso_year', 'iso_week'] as const;
export const DATE_TIME_FEATURE_LEVELS = [
    'year',
    'quarter',
    'month',
    'week',
    'weekday',
    'day',
    'hour',
    'minute',
    'second',
    'iso_year',
    'iso_week',
    'iso_weekday',
] as const;

export const MEA_KEY_ID = 'gw_mea_key_fid';
export const MEA_VAL_ID = 'gw_mea_val_fid';
export const PAINT_FIELD_ID = 'gw_paint_fid';

const PIVOT_TABLE_DEFAULT_LIMIT_ENV = Number(
    import.meta.env.VITE_PIVOT_TABLE_DEFAULT_LIMIT ?? import.meta.env.PIVOT_TABLE_DEFAULT_LIMIT
);
const PIVOT_TABLE_COLUMN_LIMIT_ENV = Number(
    import.meta.env.VITE_PIVOT_TABLE_COLUMN_LIMIT ?? import.meta.env.PIVOT_TABLE_COLUMN_LIMIT
);
const PIVOT_TABLE_ROW_LIMIT_ENV = Number(
    import.meta.env.VITE_PIVOT_TABLE_ROW_LIMIT ?? import.meta.env.PIVOT_TABLE_ROW_LIMIT
);

/** Default row limit for pivot table source data (-1 means unset) */
export const PIVOT_TABLE_DEFAULT_LIMIT = PIVOT_TABLE_DEFAULT_LIMIT_ENV > 0 ? PIVOT_TABLE_DEFAULT_LIMIT_ENV : 20000;

/** Column limit for pivot table rendering (-1 means unset) */
export const PIVOT_TABLE_COLUMN_LIMIT = PIVOT_TABLE_COLUMN_LIMIT_ENV > 0 ? PIVOT_TABLE_COLUMN_LIMIT_ENV : 200;

/** Row limit for pivot table rendering (-1 means unset) */
export const PIVOT_TABLE_ROW_LIMIT = PIVOT_TABLE_ROW_LIMIT_ENV > 0 ? PIVOT_TABLE_ROW_LIMIT_ENV : 10000;
