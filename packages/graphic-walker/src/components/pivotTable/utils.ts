import { IRow } from '../../interfaces';
import { INestNode } from './inteface';
import { PIVOT_TABLE_DEBUG } from '../../constants';

const key_prefix = 'nk_';

// WeakMap to store childrenMap for O(1) lookup during tree construction
const nodeChildrenMap = new WeakMap<INestNode, Map<string | number, INestNode>>();

function getOrCreateChildrenMap(node: INestNode): Map<string | number, INestNode> {
    let map = nodeChildrenMap.get(node);
    if (!map) {
        map = new Map();
        // Initialize from existing children if any
        for (const child of node.children) {
            map.set(child.key, child);
        }
        nodeChildrenMap.set(node, map);
    }
    return map;
}

function insertNodeOptimized(
    tree: INestNode,
    layerKeys: string[],
    nodeData: IRow,
    depth: number,
    collapsedKeyList: string[],
    collapsedKeySet: Set<string>,
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
    }
) {
    if (depth >= layerKeys.length) {
        return;
    }
    const key = nodeData[layerKeys[depth]];
    const uniqueKey = `${tree.uniqueKey}__${key}`;

    // O(1) lookup using Map instead of O(n) find
    const childrenMap = getOrCreateChildrenMap(tree);
    let child = childrenMap.get(key);
    
    if (!child) {
        child = {
            key,
            value: key,
            sort: depth === layerKeys.length - 1 && sort ? nodeData[sort.fid] ?? `_${key}` : key,
            uniqueKey: uniqueKey,
            fieldKey: layerKeys[depth],
            children: [],
            path: [...tree.path, { key: layerKeys[depth], value: key }],
            height: layerKeys.length - depth - 1,
            isCollapsed: false,
        };
        
        // Use Set for O(1) lookup instead of includes
        if (collapsedKeySet.has(tree.uniqueKey)) {
            tree.isCollapsed = true;
        }
        
        const reverse = depth === layerKeys.length - 1 && sort?.type === 'descending';
        tree.children.splice(binarySearchIndex(tree.children, child.sort, reverse), 0, child);
        childrenMap.set(key, child);
    }
    insertNodeOptimized(child, layerKeys, nodeData, depth + 1, collapsedKeyList, collapsedKeySet, sort);
}

// Legacy version kept for reference
function insertNode(
    tree: INestNode,
    layerKeys: string[],
    nodeData: IRow,
    depth: number,
    collapsedKeyList: string[],
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
    }
) {
    if (depth >= layerKeys.length) {
        // tree.key = nodeData[layerKeys[depth]];
        return;
    }
    const key = nodeData[layerKeys[depth]];
    const uniqueKey = `${tree.uniqueKey}__${key}`;

    let child = tree.children.find((c) => c.key === key);
    if (!child) {
        child = {
            key,
            value: key,
            sort: depth === layerKeys.length - 1 && sort ? nodeData[sort.fid] ?? `_${key}` : key,
            uniqueKey: uniqueKey,
            fieldKey: layerKeys[depth],
            children: [],
            path: [...tree.path, { key: layerKeys[depth], value: key }],
            height: layerKeys.length - depth - 1,
            isCollapsed: false,
        };
        if (collapsedKeyList.includes(tree.uniqueKey)) {
            tree.isCollapsed = true;
        }
        const reverse = depth === layerKeys.length - 1 && sort?.type === 'descending';
        tree.children.splice(binarySearchIndex(tree.children, child.sort, reverse), 0, child);
    }
    insertNode(child, layerKeys, nodeData, depth + 1, collapsedKeyList, sort);
}

// Custom binary search function to find appropriate index for insertion.
function binarySearchIndex(arr: INestNode[], keyVal: string | number, reverse = false): number {
    let start = 0,
        end = arr.length - 1;

    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        let middleVal = arr[middle].sort;
        if (typeof middleVal === 'number' && typeof keyVal === 'number') {
            if (reverse !== middleVal < keyVal) start = middle + 1;
            else end = middle - 1;
        } else {
            let cmp = String(middleVal).localeCompare(String(keyVal));
            if (reverse !== cmp < 0) start = middle + 1;
            else end = middle - 1;
        }
    }
    return start;
}

const ROOT_KEY = '__root';
const TOTAL_KEY = '__total';

function insertSummaryNode(node: INestNode): void {
    if (node.children.length > 0) {
        node.children.unshift({
            key: TOTAL_KEY,
            value: `${node.value}(total)`,
            sort: '',
            fieldKey: TOTAL_KEY,
            uniqueKey: `${node.uniqueKey}${TOTAL_KEY}`,
            children: [],
            path: [],
            height: node.children[0].height,
            isCollapsed: true,
        });
        for (let i = 1; i < node.children.length; i++) {
            insertSummaryNode(node.children[i]);
        }
    }
}

export function buildNestTree(
    layerKeys: string[],
    data: IRow[],
    collapsedKeyList: string[],
    showSummary: boolean,
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
    },
    dataWithoutSort?: IRow[]
): INestNode {
    const tree: INestNode = {
        key: ROOT_KEY,
        value: 'root',
        fieldKey: 'root',
        sort: '',
        uniqueKey: ROOT_KEY,
        children: [],
        path: [],
        height: layerKeys.length,
        isCollapsed: false,
    };
    
    // Convert to Set for O(1) lookup
    const collapsedKeySet = new Set(collapsedKeyList);
    
    for (let row of data) {
        insertNodeOptimized(tree, layerKeys, row, 0, collapsedKeyList, collapsedKeySet, sort);
    }
    if (dataWithoutSort) {
        for (let row of dataWithoutSort) {
            insertNodeOptimized(tree, layerKeys, row, 0, collapsedKeyList, collapsedKeySet, { fid: '', type: sort?.type ?? 'ascending' });
        }
    }
    if (showSummary) {
        insertSummaryNode(tree);
    }
    return tree;
}

class NodeIterator {
    public tree: INestNode;
    public nodeStack: INestNode[] = [];
    public current: INestNode | null = null;
    constructor(tree: INestNode) {
        this.tree = tree;
    }
    public first() {
        let node = this.tree;
        this.nodeStack = [node];
        while (node.children.length > 0 && !node.isCollapsed) {
            this.nodeStack.push(node.children[0]);
            node = node.children[0];
        }
        this.current = node;
        return this.current;
    }
    public next(): INestNode | null {
        let cursorMoved = false;
        let counter = 0;
        while (this.nodeStack.length > 1) {
            counter++;
            if (counter > 100) break;
            let node = this.nodeStack[this.nodeStack.length - 1];
            let parent = this.nodeStack[this.nodeStack.length - 2];
            let nodeIndex = parent.children.findIndex((n) => n.key === node!.key);
            if (nodeIndex === -1) break;
            if (cursorMoved) {
                if (node.children.length > 0 && !node.isCollapsed) {
                    this.nodeStack.push(node.children[0]);
                    continue;
                } else {
                    break;
                }
            } else {
                if (nodeIndex < parent.children.length - 1) {
                    this.nodeStack.pop();
                    this.nodeStack.push(parent.children[nodeIndex + 1]);
                    cursorMoved = true;
                    continue;
                }
                if (nodeIndex >= parent.children.length - 1) {
                    this.nodeStack.pop();
                    continue;
                }
            }
        }
        if (cursorMoved) {
            this.current = this.nodeStack[this.nodeStack.length - 1] || null;
        } else {
            this.current = null;
        }
        return this.current;
    }
    public predicates(): { key: string; value: string | number }[] {
        return this.nodeStack
            .filter((node) => node.key !== ROOT_KEY)
            .map((node) => ({
                key: node.fieldKey,
                value: node.value,
            }));
    }
}

/**
 * Count leaf nodes using fast recursive traversal
 * O(n) instead of O(n²) with NodeIterator
 */
export function countLeafNodes(tree: INestNode): number {
    function count(node: INestNode): number {
        // A leaf is a node with no children or a collapsed node
        if (node.children.length === 0 || node.isCollapsed) {
            return 1;
        }
        let total = 0;
        for (const child of node.children) {
            total += count(child);
        }
        return total;
    }
    return count(tree);
}

/**
 * Collect first N leaf keys using fast recursive traversal
 * Returns early once limit is reached
 */
function collectFirstNLeafKeys(tree: INestNode, maxLeaves: number): Set<string> {
    const keys = new Set<string>();
    
    function traverse(node: INestNode): boolean {
        // A leaf is a node with no children or a collapsed node
        if (node.children.length === 0 || node.isCollapsed) {
            keys.add(node.uniqueKey);
            return keys.size >= maxLeaves; // Return true if we've collected enough
        }
        for (const child of node.children) {
            if (traverse(child)) {
                return true; // Stop early if we have enough
            }
        }
        return false;
    }
    
    traverse(tree);
    return keys;
}

export function pruneTreeByLeafLimit(tree: INestNode, maxLeaves: number): { tree: INestNode; leafCount: number; truncated: boolean } {
    const leafCount = countLeafNodes(tree);
    if (maxLeaves <= 0 || leafCount <= maxLeaves) {
        return { tree, leafCount, truncated: false };
    }

    // Collect first N leaf keys using fast traversal
    const keepLeafKeys = collectFirstNLeafKeys(tree, maxLeaves);

    const prune = (node: INestNode): INestNode | null => {
        const isLeaf = node.isCollapsed || node.children.length === 0;
        if (isLeaf) {
            return keepLeafKeys.has(node.uniqueKey) ? { ...node, children: [] } : null;
        }
        const prunedChildren: INestNode[] = [];
        for (const child of node.children) {
            const pruned = prune(child);
            if (pruned) {
                prunedChildren.push(pruned);
            }
        }
        if (prunedChildren.length === 0) {
            return null;
        }
        return { ...node, children: prunedChildren };
    };

    const prunedRoot = prune(tree);
    const safeRoot = prunedRoot ?? { ...tree, children: [] };

    return { tree: safeRoot, leafCount, truncated: true };
}

/**
 * Build a hash key from predicates for O(1) lookup
 * Optimized version: avoids creating intermediate arrays
 */
function buildHashKey(predicates: { key: string; value: string | number }[]): string {
    const len = predicates.length;
    if (len === 0) return '';
    if (len === 1) return `${predicates[0].key}=${predicates[0].value}`;
    
    // Sort by key to ensure consistent ordering - use in-place sort on copy
    const sorted = predicates.slice().sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    
    // Build string without map/join for better performance
    let result = `${sorted[0].key}=${sorted[0].value}`;
    for (let i = 1; i < len; i++) {
        result += `|${sorted[i].key}=${sorted[i].value}`;
    }
    return result;
}

/**
 * Fast hash key builder for pre-filtered predicates (no TOTAL_KEY)
 * Assumes predicates are already in consistent order
 */
function buildHashKeyFast(leftPredicates: { key: string; value: string | number }[], topPredicates: { key: string; value: string | number }[]): string {
    // Merge and sort in one pass
    const all: { key: string; value: string | number }[] = [];
    let li = 0, ti = 0;
    const ll = leftPredicates.length, tl = topPredicates.length;
    
    // Merge sort style - both arrays contribute
    while (li < ll && ti < tl) {
        if (leftPredicates[li].key < topPredicates[ti].key) {
            all.push(leftPredicates[li++]);
        } else {
            all.push(topPredicates[ti++]);
        }
    }
    while (li < ll) all.push(leftPredicates[li++]);
    while (ti < tl) all.push(topPredicates[ti++]);
    
    if (all.length === 0) return '';
    
    let result = `${all[0].key}=${all[0].value}`;
    for (let i = 1; i < all.length; i++) {
        result += `|${all[i].key}=${all[i].value}`;
    }
    return result;
}

/**
 * Build a hash index from data for O(1) cell lookup
 * Returns a Map where key = hash of field values, value = array of matching rows
 */
function buildDataIndex(data: IRow[], fieldKeys: string[]): Map<string, IRow[]> {
    const index = new Map<string, IRow[]>();
    
    for (const row of data) {
        // Get only the fields that exist in this row and are in our fieldKeys
        const predicates: { key: string; value: string | number }[] = [];
        for (const key of fieldKeys) {
            if (key in row) {
                predicates.push({ key, value: row[key] as string | number });
            }
        }
        
        const hashKey = buildHashKey(predicates);
        const existing = index.get(hashKey);
        if (existing) {
            existing.push(row);
        } else {
            index.set(hashKey, [row]);
        }
    }
    
    return index;
}

/**
 * Collect all unique field keys from a tree
 */
function collectFieldKeys(tree: INestNode): Set<string> {
    const keys = new Set<string>();
    const stack: INestNode[] = [tree];
    
    while (stack.length > 0) {
        const node = stack.pop()!;
        if (node.fieldKey !== 'root' && node.fieldKey !== TOTAL_KEY) {
            keys.add(node.fieldKey);
        }
        for (const child of node.children) {
            stack.push(child);
        }
    }
    
    return keys;
}

// Debug flag is imported from constants (controlled via VITE_PIVOT_TABLE_DEBUG env var)

/**
 * Original O(N*M*D) implementation - kept for reference and fallback
 */
export function buildMetricTableFromNestTreeLegacy(leftTree: INestNode, topTree: INestNode, data: IRow[]): (IRow | null)[][] {
    const startTime = performance.now();
    let filterOperations = 0;
    let cellCount = 0;
    
    const mat: any[][] = [];
    const iteLeft = new NodeIterator(leftTree);
    const iteTop = new NodeIterator(topTree);
    iteLeft.first();
    while (iteLeft.current !== null) {
        const vec: any[] = [];
        iteTop.first();
        while (iteTop.current !== null) {
            const predicates = iteLeft
                .predicates()
                .concat(iteTop.predicates())
                .filter((ele) => ele.key !== TOTAL_KEY);
            const matchedRows = data.filter((r) => predicates.every((pre) => r[pre.key] === pre.value));
            filterOperations += data.length; // Each filter iterates all data
            cellCount++;
            if (matchedRows.length > 0) {
                // If multiple rows are matched, then find the most matched one (the row with smallest number of keys)
                vec.push(matchedRows.reduce((a, b) => (Object.keys(a).length < Object.keys(b).length ? a : b)));
            } else {
                vec.push(undefined);
            }
            iteTop.next();
        }
        mat.push(vec);
        iteLeft.next();
    }
    
    const endTime = performance.now();
    if (PIVOT_TABLE_DEBUG) {
        console.log('%c[PivotTable] LEGACY mode performance:', 'color: #ff6b6b; font-weight: bold');
        console.log(`  Mode: legacy (O(N*M*D))`);
        console.log(`  Data rows: ${data.length.toLocaleString()}`);
        console.log(`  Matrix size: ${mat.length} rows × ${mat[0]?.length || 0} cols`);
        console.log(`  Total cells: ${cellCount.toLocaleString()}`);
        console.log(`  Filter operations: ${filterOperations.toLocaleString()}`);
        console.log(`  Time: ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`  Ops/ms: ${(filterOperations / (endTime - startTime)).toFixed(0)}`);
    }
    
    return mat;
}

/**
 * Pre-compute all leaf predicates and hash keys for a tree
 * Returns array of { predicates, hashKey } for each leaf in traversal order
 * Optimized: Uses direct tree traversal instead of slow NodeIterator
 */
function precomputeLeafHashes(tree: INestNode): { predicates: { key: string; value: string | number }[]; hashKey: string }[] {
    const results: { predicates: { key: string; value: string | number }[]; hashKey: string }[] = [];
    
    // Fast recursive traversal with path tracking
    function traverse(node: INestNode, path: { key: string; value: string | number }[]): void {
        // Build current path (exclude root and TOTAL)
        const currentPath = node.fieldKey !== 'root' && node.fieldKey !== TOTAL_KEY
            ? [...path, { key: node.fieldKey, value: node.value }]
            : path;
        
        // Check if this is a leaf (no children or collapsed)
        if (node.children.length === 0 || node.isCollapsed) {
            const hashKey = buildHashKey(currentPath);
            results.push({ predicates: currentPath, hashKey });
            return;
        }
        
        // Recurse into children
        for (const child of node.children) {
            traverse(child, currentPath);
        }
    }
    
    traverse(tree, []);
    return results;
}

/**
 * Optimized O(D + N*M) implementation using hash index
 * D = data rows, N = left tree leaves, M = top tree leaves
 */
export function buildMetricTableFromNestTree(leftTree: INestNode, topTree: INestNode, data: IRow[]): (IRow | null)[][] {
    const totalStartTime = performance.now();
    
    // Phase 1: Collect field keys
    const phase1Start = performance.now();
    const leftFieldKeys = collectFieldKeys(leftTree);
    const topFieldKeys = collectFieldKeys(topTree);
    const allFieldKeys = [...new Set([...leftFieldKeys, ...topFieldKeys])];
    const phase1Time = performance.now() - phase1Start;
    
    // Phase 2: Build hash index from data - O(D)
    const phase2Start = performance.now();
    const dataIndex = buildDataIndex(data, allFieldKeys);
    const phase2Time = performance.now() - phase2Start;
    
    // Phase 3a: Pre-compute all leaf predicates and hash keys - O(N + M)
    const phase3aStart = performance.now();
    const leftLeaves = precomputeLeafHashes(leftTree);
    const topLeaves = precomputeLeafHashes(topTree);
    const phase3aTime = performance.now() - phase3aStart;
    
    // Phase 3b: Build matrix using pre-computed hashes - O(N*M)
    const phase3bStart = performance.now();
    let cellCount = 0;
    let hashHits = 0;
    let hashMisses = 0;
    
    const mat: (IRow | null)[][] = [];
    
    for (const leftLeaf of leftLeaves) {
        const vec: (IRow | null)[] = [];
        
        for (const topLeaf of topLeaves) {
            cellCount++;
            
            // Combine hash keys efficiently
            let combinedHashKey: string;
            if (leftLeaf.hashKey === '') {
                combinedHashKey = topLeaf.hashKey;
            } else if (topLeaf.hashKey === '') {
                combinedHashKey = leftLeaf.hashKey;
            } else {
                // Need to merge and re-sort for consistent key
                combinedHashKey = buildHashKeyFast(leftLeaf.predicates, topLeaf.predicates);
            }
            
            // O(1) lookup
            const matchedRows = dataIndex.get(combinedHashKey);
            
            if (matchedRows && matchedRows.length > 0) {
                hashHits++;
                // If multiple rows are matched, find the one with smallest number of keys (most aggregated)
                if (matchedRows.length === 1) {
                    vec.push(matchedRows[0]);
                } else {
                    vec.push(matchedRows.reduce((a, b) => (Object.keys(a).length < Object.keys(b).length ? a : b)));
                }
            } else {
                hashMisses++;
                vec.push(null);
            }
        }
        mat.push(vec);
    }
    const phase3bTime = performance.now() - phase3bStart;
    const phase3Time = phase3aTime + phase3bTime;
    
    const totalTime = performance.now() - totalStartTime;
    
    // Calculate theoretical legacy time for comparison
    const theoreticalLegacyOps = cellCount * data.length;
    const actualOps = data.length + cellCount; // O(D + N*M)
    
    if (PIVOT_TABLE_DEBUG) {
        console.log('%c[PivotTable] HASH_INDEX mode performance:', 'color: #51cf66; font-weight: bold');
        console.log(`  Mode: hash_index (O(D + N*M))`);
        console.log(`  ─────────────────────────────────`);
        console.log(`  Data rows: ${data.length.toLocaleString()}`);
        console.log(`  Field keys: ${allFieldKeys.length} [${allFieldKeys.join(', ')}]`);
        console.log(`  Index size: ${dataIndex.size.toLocaleString()} unique keys`);
        console.log(`  ─────────────────────────────────`);
        console.log(`  Left tree leaves: ${leftLeaves.length.toLocaleString()}`);
        console.log(`  Top tree leaves: ${topLeaves.length.toLocaleString()}`);
        console.log(`  Matrix size: ${mat.length} rows × ${mat[0]?.length || 0} cols`);
        console.log(`  Total cells: ${cellCount.toLocaleString()}`);
        console.log(`  Hash hits: ${hashHits.toLocaleString()} (${((hashHits / cellCount) * 100).toFixed(1)}%)`);
        console.log(`  Hash misses: ${hashMisses.toLocaleString()} (${((hashMisses / cellCount) * 100).toFixed(1)}%)`);
        console.log(`  ─────────────────────────────────`);
        console.log(`  Phase 1 (collect keys): ${phase1Time.toFixed(2)}ms`);
        console.log(`  Phase 2 (build index): ${phase2Time.toFixed(2)}ms`);
        console.log(`  Phase 3a (precompute leaves): ${phase3aTime.toFixed(2)}ms`);
        console.log(`  Phase 3b (build matrix): ${phase3bTime.toFixed(2)}ms`);
        console.log(`  Phase 3 total: ${phase3Time.toFixed(2)}ms`);
        console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`  ─────────────────────────────────`);
        console.log(`  Actual ops: ${actualOps.toLocaleString()}`);
        console.log(`  Legacy would need: ${theoreticalLegacyOps.toLocaleString()} ops`);
        console.log(`  Speedup factor: ${(theoreticalLegacyOps / actualOps).toFixed(0)}x fewer ops`);
        console.log(`  Cells/ms: ${(cellCount / phase3bTime).toFixed(0)}`);
    }
    
    return mat;
}

export function getAllChildrenSize(node: INestNode, depth: number): number {
    if (depth === 0) {
        return node.children.length;
    }
    return node.children.reduce((acc, child) => acc + getAllChildrenSize(child, depth + 1), 0);
}
