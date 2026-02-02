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

/** Enable pivot table debug logging */
const PIVOT_TABLE_DEBUG_ENV = 
    import.meta.env.VITE_PIVOT_TABLE_DEBUG ?? import.meta.env.PIVOT_TABLE_DEBUG;

export const PIVOT_TABLE_DEBUG: boolean = 
    PIVOT_TABLE_DEBUG_ENV === 'true' || PIVOT_TABLE_DEBUG_ENV === '1';

/** 
 * Use DuckDB for data computation instead of in-memory JavaScript.
 * When enabled, data is loaded into DuckDB-WASM and queries are executed as SQL.
 * This provides better performance for large datasets (>10k rows).
 * 
 * Enable via: VITE_USE_DUCKDB=true in .env.local
 */
const USE_DUCKDB_ENV = 
    import.meta.env.VITE_USE_DUCKDB ?? import.meta.env.USE_DUCKDB;

export const USE_DUCKDB: boolean = 
    USE_DUCKDB_ENV === 'true' || USE_DUCKDB_ENV === '1';

/** 
 * Enable DuckDB debug logging.
 * Shows detailed logs for DuckDB initialization, SQL queries, and timing.
 * 
 * Enable via: VITE_DUCKDB_DEBUG=true in .env.local
 */
const DUCKDB_DEBUG_ENV = 
    import.meta.env.VITE_DUCKDB_DEBUG ?? import.meta.env.DUCKDB_DEBUG;

export const DUCKDB_DEBUG: boolean = 
    DUCKDB_DEBUG_ENV === 'true' || DUCKDB_DEBUG_ENV === '1';

// Debug: log USE_DUCKDB status at startup (only when debug enabled)
if (typeof window !== 'undefined' && DUCKDB_DEBUG) {
    console.log(`%c[GraphicWalker] USE_DUCKDB = ${USE_DUCKDB} (env: ${USE_DUCKDB_ENV})`, 
        USE_DUCKDB ? 'color: #40c057; font-weight: bold' : 'color: #868e96');
}
