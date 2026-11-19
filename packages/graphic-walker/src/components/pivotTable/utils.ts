import type { IRow, IViewField } from '../../interfaces';
import type { INestNode, IPivotTablePath, PivotTableValue } from './interface';

export function pivotTableValuesEqual(left: unknown, right: unknown): boolean {
    return left === right || (typeof left === 'number' && typeof right === 'number' && Number.isNaN(left) && Number.isNaN(right));
}

function encodePivotTableValue(value: PivotTableValue): readonly [type: string, value?: string | number | boolean] {
    if (value === null) return ['null'];
    if (value === undefined) return ['undefined'];
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return ['number', 'NaN'];
        if (value === Infinity) return ['number', 'Infinity'];
        if (value === -Infinity) return ['number', '-Infinity'];
        return ['number', value === 0 ? 0 : value];
    }
    return [typeof value, value];
}

export function createPivotPathKey(path: readonly { key: string; value: PivotTableValue }[]): string {
    return JSON.stringify(path.map(({ key, value }) => [key, encodePivotTableValue(value)]));
}

function insertNode(
    tree: INestNode,
    layerKeys: string[],
    nodeData: IRow,
    depth: number,
    collapsedKeySet: ReadonlySet<string>,
    fields: ReadonlyMap<string, IViewField>,
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
    }
) {
    if (depth >= layerKeys.length) {
        // tree.key = nodeData[layerKeys[depth]];
        return;
    }
    const key = nodeData[layerKeys[depth]] as PivotTableValue;
    const path: IPivotTablePath = [...tree.path, { key: layerKeys[depth], value: key }];
    const uniqueKey = createPivotPathKey(path);

    let child = tree.children.find((candidate) => pivotTableValuesEqual(candidate.key, key));
    if (!child) {
        child = {
            kind: 'value',
            key,
            value: key,
            sort: depth === layerKeys.length - 1 && sort ? nodeData[sort.fid] ?? `_${key}` : key,
            uniqueKey: uniqueKey,
            fieldKey: layerKeys[depth],
            children: [],
            path,
            height: layerKeys.length - depth - 1,
            isCollapsed: collapsedKeySet.has(uniqueKey),
        };
        const field = fields.get(child.fieldKey);
        const comparator = field?.sortType === 'manual' || field?.sortType === 'alphabetical'
            ? (left: INestNode, right: INestNode) => comparePivotDimension(left.value, right.value, field)
            : (left: INestNode, right: INestNode) => {
                  const reverse = depth === layerKeys.length - 1 && sort?.type === 'descending';
                  return comparePivotValues(left.sort, right.sort) * (reverse ? -1 : 1);
              };
        tree.children.splice(binarySearchIndex(tree.children, child, comparator), 0, child);
    }
    insertNode(child, layerKeys, nodeData, depth + 1, collapsedKeySet, fields, sort);
}

function comparePivotValues(left: PivotTableValue, right: PivotTableValue): number {
    return typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
}

export function comparePivotDimension(left: PivotTableValue, right: PivotTableValue, field: IViewField): number {
    if (field.sortType === 'manual' && field.sortList?.length) {
        const index = (value: PivotTableValue) => {
            const position = field.sortList!.findIndex((entry) => pivotTableValuesEqual(entry, value));
            return position < 0 ? field.sortList!.length : position;
        };
        return index(left) - index(right) || comparePivotValues(left, right);
    }
    if (field.sortType === 'alphabetical') {
        return String(left).localeCompare(String(right)) * (field.sort === 'descending' ? -1 : 1);
    }
    return comparePivotValues(left, right);
}

function binarySearchIndex(arr: INestNode[], node: INestNode, compare: (left: INestNode, right: INestNode) => number): number {
    let start = 0;
    let end = arr.length - 1;
    while (start <= end) {
        const middle = Math.floor((start + end) / 2);
        if (compare(arr[middle], node) < 0) start = middle + 1;
        else end = middle - 1;
    }
    return start;
}

const ROOT_KEY = '__pivot_root__';
const SUMMARY_KEY = '__pivot_summary__';

function insertSummaryNode(node: INestNode): void {
    if (node.children.length > 0) {
        node.children.unshift({
            kind: 'summary',
            key: SUMMARY_KEY,
            value: `${node.value}(total)`,
            sort: '',
            fieldKey: '',
            uniqueKey: JSON.stringify(['summary', node.uniqueKey]),
            children: [],
            path: [...node.path],
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
    dimensions: IViewField[] = []
): INestNode {
    const collapsedKeySet = new Set(collapsedKeyList);
    const fields = new Map(dimensions.map((field) => [field.fid, field]));
    const tree: INestNode = {
        kind: 'root',
        key: ROOT_KEY,
        value: 'root',
        fieldKey: 'root',
        sort: '',
        uniqueKey: createPivotPathKey([]),
        children: [],
        path: [],
        height: layerKeys.length,
        isCollapsed: false,
    };
    for (let row of data) {
        insertNode(tree, layerKeys, row, 0, collapsedKeySet, fields, sort);
    }
    if (dataWithoutSort) {
        for (let row of dataWithoutSort) {
            insertNode(tree, layerKeys, row, 0, collapsedKeySet, fields, { fid: '', type: sort?.type ?? 'ascending' });
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
            let nodeIndex = parent.children.findIndex((candidate) => candidate === node);
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
    public predicates(): IPivotTablePath {
        return this.nodeStack
            .filter((node) => node.kind === 'value')
            .map((node) => ({
                key: node.fieldKey,
                value: node.value,
            }));
    }
}

export function buildMetricTableFromNestTree(leftTree: INestNode, topTree: INestNode, data: IRow[]): (IRow | null | undefined)[][] {
    const mat: any[][] = [];
    const iteLeft = new NodeIterator(leftTree);
    const iteTop = new NodeIterator(topTree);
    const dimensionKeys = Array.from(
        new Set(
            [...leftTree.children, ...topTree.children].flatMap(function collectKeys(node: INestNode): string[] {
                return [...(node.kind === 'value' ? [node.fieldKey] : []), ...node.children.flatMap(collectKeys)];
            })
        )
    );
    const indexedRows = new Map<string, IRow>();
    for (const row of data) {
        const predicates = dimensionKeys
            .filter((key) => Object.prototype.hasOwnProperty.call(row, key))
            .map((key) => ({ key, value: row[key] as PivotTableValue }));
        const key = createPivotPathKey(predicates);
        const existing = indexedRows.get(key);
        if (!existing || Object.keys(row).length <= Object.keys(existing).length) {
            indexedRows.set(key, row);
        }
    }
    iteLeft.first();
    while (iteLeft.current !== null) {
        const vec: any[] = [];
        iteTop.first();
        while (iteTop.current !== null) {
            const predicates = iteLeft
                .predicates()
                .concat(iteTop.predicates());
            const indexedRow = indexedRows.get(createPivotPathKey(predicates));
            const matchedRows = indexedRow
                ? [indexedRow]
                : data.filter((row) => predicates.every((predicate) => pivotTableValuesEqual(row[predicate.key], predicate.value)));
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
