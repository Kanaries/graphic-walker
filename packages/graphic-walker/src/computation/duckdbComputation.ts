/**
 * DuckDB computation wrapper for graphic-walker.
 * 
 * This module provides a bridge to @kanaries/duckdb-computation
 * when USE_DUCKDB is enabled. It handles async initialization
 * and provides the same interface as clientComputation.
 */

import type { IComputationFunction, IRow } from '../interfaces';
import { USE_DUCKDB, DUCKDB_DEBUG } from '../constants';

// Debug logging helper
const log = (message: string, ...args: unknown[]) => {
    if (DUCKDB_DEBUG) console.log(message, ...args);
};
const logStyled = (message: string, style: string, ...args: unknown[]) => {
    if (DUCKDB_DEBUG) console.log(message, style, ...args);
};

// Lazy-loaded DuckDB module
let duckdbModule: typeof import('@kanaries/duckdb-computation') | null = null;
let duckdbLoadPromise: Promise<typeof import('@kanaries/duckdb-computation') | null> | null = null;

/**
 * Dynamically import DuckDB computation module.
 * Returns null if the module is not available.
 */
async function loadDuckDBModule(): Promise<typeof import('@kanaries/duckdb-computation') | null> {
    if (duckdbModule) return duckdbModule;
    if (duckdbLoadPromise) return duckdbLoadPromise;
    
    logStyled('%c[DuckDB] Loading @kanaries/duckdb-computation module...', 'color: #f08c00');
    
    duckdbLoadPromise = (async () => {
        try {
            const module = await import('@kanaries/duckdb-computation');
            duckdbModule = module;
            logStyled('%c[DuckDB] Module loaded successfully', 'color: #40c057; font-weight: bold');
            log('  Available exports:', Object.keys(module));
            return module;
        } catch (error) {
            console.error('%c[DuckDB] Failed to load @kanaries/duckdb-computation:', 'color: #ff6b6b', error);
            console.warn('[DuckDB] Falling back to in-memory JavaScript computation');
            return null;
        }
    })();
    
    return duckdbLoadPromise;
}

// Cache for active computation contexts
interface ComputationContext {
    computation: IComputationFunction;
    close: () => Promise<void>;
    dataHash: string;
}

let activeContext: ComputationContext | null = null;

/**
 * Create a simple hash of data for cache invalidation
 */
function hashData(data: IRow[]): string {
    return `${data.length}_${data[0] ? Object.keys(data[0]).join(',') : 'empty'}`;
}

/**
 * Get DuckDB-based computation function for the given data.
 * 
 * This is an async version that:
 * 1. Loads the DuckDB module if not already loaded
 * 2. Creates a computation context with data loaded into DuckDB
 * 3. Returns the computation function
 * 
 * Returns null if DuckDB is not available, allowing fallback to clientComputation.
 */
export async function getDuckDBComputation(data: IRow[]): Promise<IComputationFunction | null> {
    if (!USE_DUCKDB) {
        return null;
    }
    
    const module = await loadDuckDBModule();
    if (!module) {
        return null;
    }
    
    const dataHash = hashData(data);
    
    // Reuse existing context if data hasn't changed
    if (activeContext && activeContext.dataHash === dataHash) {
        return activeContext.computation;
    }
    
    // Close previous context if exists
    if (activeContext) {
        try {
            await activeContext.close();
        } catch (e) {
            if (DUCKDB_DEBUG) console.warn('[DuckDB] Error closing previous context:', e);
        }
    }
    
    // Create new computation context
    const startTime = performance.now();
    const context = await module.getComputation(data);
    const setupTime = performance.now() - startTime;
    
    logStyled(`%c[DuckDB] Computation context ready in ${setupTime.toFixed(2)}ms`, 'color: #40c057');
    log(`  Data: ${data.length.toLocaleString()} rows`);
    
    activeContext = {
        computation: context.computation as IComputationFunction,
        close: context.close,
        dataHash,
    };
    
    return activeContext.computation;
}

/**
 * Check if DuckDB mode is enabled via environment variable
 */
export function isDuckDBEnabled(): boolean {
    return USE_DUCKDB;
}

/**
 * Cleanup function to close active DuckDB context
 */
export async function closeDuckDBContext(): Promise<void> {
    if (activeContext) {
        await activeContext.close();
        activeContext = null;
    }
}
