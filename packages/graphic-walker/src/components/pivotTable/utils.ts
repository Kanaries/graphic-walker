import { IManualSortValue, IRow } from '../../interfaces';
import { INestNode, NestSortToken } from './inteface';

const key_prefix = 'nk_';

export type ManualSortLookup = Record<string, Record<string, number>>;

const MANUAL_NULL_KEY = '__gw_manual_null__';
const MANUAL_UNDEFINED_KEY = '__gw_manual_undefined__';

export function serializeManualKey(value: any): string {
    if (value === null) return MANUAL_NULL_KEY;
    if (value === undefined) return MANUAL_UNDEFINED_KEY;
    const type = typeof value;
    switch (type) {
        case 'number':
            return `n:${value}`;
        case 'boolean':
            return `b:${value}`;
        default:
            return `s:${String(value)}`;
    }
}

export function createManualSortLookup(config?: Record<string, IManualSortValue[]>): ManualSortLookup | undefined {
    if (!config) return undefined;
    const lookup: ManualSortLookup = {};
    Object.entries(config).forEach(([fid, values]) => {
        if (!values || values.length === 0) return;
        lookup[fid] = {};
        values.forEach((value, index) => {
            lookup[fid][serializeManualKey(value)] = index;
        });
    });
    return Object.keys(lookup).length > 0 ? lookup : undefined;
}

const normalizeSortValue = (value: string | number | boolean | null | undefined): string | number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 1 : 0;
    return String(value);
};

const createSortToken = (
    fieldKey: string,
    keyValue: any,
    nodeData: IRow,
    isLeaf: boolean,
    sort: { fid: string; type: 'ascending' | 'descending' } | undefined,
    manualSortLookup?: ManualSortLookup,
    alphabeticalSort?: 'ascending' | 'descending'
): NestSortToken => {
    const manualLookup = manualSortLookup?.[fieldKey];
    if (manualLookup) {
        const manualIndex = manualLookup[serializeManualKey(keyValue)];
        if (manualIndex !== undefined) {
            return { priority: 0, value: manualIndex };
        }
        if (alphabeticalSort) {
            return { priority: 2, value: normalizeSortValue(keyValue) };
        }
        return { priority: 3, value: normalizeSortValue(keyValue) };
    }
    if (isLeaf && sort) {
        const measureValue = sort.fid ? nodeData[sort.fid] : undefined;
        const fallback = measureValue !== undefined ? measureValue : `_${String(keyValue)}`;
        return { priority: 1, value: normalizeSortValue(fallback as any) };
    }
    if (alphabeticalSort) {
        return { priority: 2, value: normalizeSortValue(keyValue) };
    }
    return { priority: 3, value: normalizeSortValue(keyValue) };
};

function insertNode(
    tree: INestNode,
    layerKeys: string[],
    nodeData: IRow,
    depth: number,
    collapsedKeyList: string[],
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
    },
    manualSortLookup?: ManualSortLookup,
    alphabeticalSortConfig?: Record<string, 'ascending' | 'descending'>
) {
    if (depth >= layerKeys.length) {
        // tree.key = nodeData[layerKeys[depth]];
        return;
    }
    const key = nodeData[layerKeys[depth]];
    const uniqueKey = `${tree.uniqueKey}__${key}`;

    let child = tree.children.find((c) => c.key === key);
    if (!child) {
        const fieldKey = layerKeys[depth];
        const isLeaf = depth === layerKeys.length - 1;
        const alphabeticalSort = alphabeticalSortConfig?.[fieldKey];
        child = {
            key,
            value: key,
            sort: createSortToken(fieldKey, key, nodeData, isLeaf, isLeaf ? sort : undefined, manualSortLookup, alphabeticalSort),
            uniqueKey: uniqueKey,
            fieldKey,
            children: [],
            path: [...tree.path, { key: fieldKey, value: key }],
            height: layerKeys.length - depth - 1,
            isCollapsed: false,
        };
        if (collapsedKeyList.includes(tree.uniqueKey)) {
            tree.isCollapsed = true;
        }
        const reverse = alphabeticalSort ? alphabeticalSort === 'descending' : depth === layerKeys.length - 1 && sort?.type === 'descending';
        tree.children.splice(binarySearchIndex(tree.children, child.sort, reverse), 0, child);
    }
    insertNode(child, layerKeys, nodeData, depth + 1, collapsedKeyList, sort, manualSortLookup, alphabeticalSortConfig);
}

// Custom binary search function to find appropriate index for insertion.
function binarySearchIndex(arr: INestNode[], keyVal: NestSortToken, reverse = false): number {
    let start = 0,
        end = arr.length - 1;

    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        const middleVal = arr[middle].sort;
        const cmp = compareSortToken(keyVal, middleVal, reverse);
        if (cmp > 0) start = middle + 1;
        else end = middle - 1;
    }
    return start;
}

function compareSortToken(a: NestSortToken, b: NestSortToken, reverse = false): number {
    if (a.priority !== b.priority) {
        return a.priority - b.priority;
    }
    let cmp: number;
    if (typeof a.value === 'number' && typeof b.value === 'number') {
        cmp = a.value - b.value;
    } else {
        cmp = String(a.value).localeCompare(String(b.value));
    }
    return reverse ? -cmp : cmp;
}

const ROOT_KEY = '__root';
const TOTAL_KEY = '__total';

function insertSummaryNode(node: INestNode): void {
    if (node.children.length > 0) {
        node.children.unshift({
            key: TOTAL_KEY,
            value: `${node.value}(total)`,
            sort: { priority: 0, value: '' },
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
    dataWithoutSort?: IRow[],
    manualSortLookup?: ManualSortLookup,
    alphabeticalSortConfig?: Record<string, 'ascending' | 'descending'>
): INestNode {
    const tree: INestNode = {
        key: ROOT_KEY,
        value: 'root',
        fieldKey: 'root',
        sort: { priority: 0, value: '' },
        uniqueKey: ROOT_KEY,
        children: [],
        path: [],
        height: layerKeys.length,
        isCollapsed: false,
    };
    for (let row of data) {
        insertNode(tree, layerKeys, row, 0, collapsedKeyList, sort, manualSortLookup, alphabeticalSortConfig);
    }
    if (dataWithoutSort) {
        for (let row of dataWithoutSort) {
            insertNode(tree, layerKeys, row, 0, collapsedKeyList, { fid: '', type: sort?.type ?? 'ascending' }, manualSortLookup, alphabeticalSortConfig);
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

export function buildMetricTableFromNestTree(leftTree: INestNode, topTree: INestNode, data: IRow[]): (IRow | null)[][] {
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
    return mat;
}

export function getAllChildrenSize(node: INestNode, depth: number): number {
    if (depth === 0) {
        return node.children.length;
    }
    return node.children.reduce((acc, child) => acc + getAllChildrenSize(child, depth + 1), 0);
}
