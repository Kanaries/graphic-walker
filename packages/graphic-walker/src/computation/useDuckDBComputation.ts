/**
 * React hook for DuckDB computation with fallback to client computation.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { IComputationFunction, IRow } from '../interfaces';
import { getComputation as getClientComputation } from './clientComputation';
import { getDuckDBComputation, isDuckDBEnabled } from './duckdbComputation';

interface UseDuckDBComputationResult {
    computation: IComputationFunction;
    isLoading: boolean;
    isDuckDB: boolean;
}

/**
 * Hook that provides computation function, using DuckDB when available and enabled.
 * Falls back to in-memory JavaScript computation if DuckDB is not available.
 * 
 * @param data - The data to compute on
 * @returns Object with computation function, loading state, and whether DuckDB is active
 */
export function useDuckDBComputation(data: IRow[]): UseDuckDBComputationResult {
    const [duckDBComputation, setDuckDBComputation] = useState<IComputationFunction | null>(null);
    const [isLoading, setIsLoading] = useState(isDuckDBEnabled());
    const [isDuckDB, setIsDuckDB] = useState(false);
    
    // Track data reference for change detection
    const dataRef = useRef<IRow[]>(data);
    const initStarted = useRef(false);
    
    // Client computation as fallback (sync, always available)
    const clientComputation = useMemo(() => getClientComputation(data), [data]);
    
    useEffect(() => {
        // If DuckDB is not enabled, skip initialization
        if (!isDuckDBEnabled()) {
            setIsLoading(false);
            setIsDuckDB(false);
            return;
        }
        
        // Check if data has changed
        const dataChanged = dataRef.current !== data;
        dataRef.current = data;
        
        // Skip if already initialized with same data
        if (initStarted.current && !dataChanged && duckDBComputation) {
            return;
        }
        
        initStarted.current = true;
        setIsLoading(true);
        
        let cancelled = false;
        
        (async () => {
            try {
                const computation = await getDuckDBComputation(data);
                
                if (cancelled) return;
                
                if (computation) {
                    setDuckDBComputation(() => computation);
                    setIsDuckDB(true);
                    console.log('%c[DuckDB] Using DuckDB for computation', 'color: #339af0; font-weight: bold');
                } else {
                    setIsDuckDB(false);
                    console.log('%c[DuckDB] Using in-memory JavaScript computation', 'color: #868e96');
                }
            } catch (error) {
                console.error('[DuckDB] Initialization error:', error);
                setIsDuckDB(false);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        })();
        
        return () => {
            cancelled = true;
        };
    }, [data]);
    
    // Return DuckDB computation if available, otherwise client computation
    const computation = useMemo(() => {
        if (isDuckDB && duckDBComputation) {
            return duckDBComputation;
        }
        return clientComputation;
    }, [isDuckDB, duckDBComputation, clientComputation]);
    
    return {
        computation,
        isLoading,
        isDuckDB,
    };
}
