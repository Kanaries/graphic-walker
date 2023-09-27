import { IRow } from "../../interfaces";
import { INestNode } from "./inteface";

const key_prefix = 'nk_';

function insertNode (tree: INestNode, layerKeys: string[], nodeData: IRow, depth: number, collapsedKeyList: string[]) {
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
            uniqueKey: uniqueKey, 
            fieldKey: layerKeys[depth],
            children: [],
            path: [...tree.path, {key: layerKeys[depth], value: key}],
            height: layerKeys.length - depth - 1,
            isCollapsed: false,
        }
        if (collapsedKeyList.includes(tree.uniqueKey)) {
            tree.isCollapsed = true;
        }
        tree.children.splice(binarySearchIndex(tree.children, child.key), 0, child);
    }
    insertNode(child, layerKeys, nodeData, depth + 1, collapsedKeyList);

}

// Custom binary search function to find appropriate index for insertion.
function binarySearchIndex(arr: INestNode[], keyVal: string | number): number {
    let start = 0, end = arr.length - 1;

    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        let middleVal = arr[middle].key;
        if (typeof middleVal === 'number' && typeof keyVal === 'number') {
            if (middleVal < keyVal) start = middle + 1;
            else end = middle - 1;
        } else {
            let cmp = String(middleVal).localeCompare(String(keyVal));
            if (cmp < 0) start = middle + 1;
            else end = middle - 1;
        }
    }
    return start;
}

const ROOT_KEY = '__root';
const TOTAL_KEY = '__total'

function insertSummaryNode (node: INestNode): void {
    if (node.children.length > 0) {
        node.children.push({
            key: TOTAL_KEY,
            value: 'total',
            fieldKey: node.children[0].fieldKey,
            uniqueKey: `${node.uniqueKey}${TOTAL_KEY}`,
            children: [],
            path: [],
            height: node.children[0].height,
            isCollapsed: true,
        });
        for (let i = 0; i < node.children.length - 1; i ++) {
            insertSummaryNode(node.children[i]);
        }
    }
};

export function buildNestTree (layerKeys: string[], data: IRow[], collapsedKeyList: string[], showSummary: boolean): INestNode {
    const tree: INestNode = {
        key: ROOT_KEY,
        value: 'root',
        fieldKey: 'root',
        uniqueKey: ROOT_KEY,
        children: [],
        path: [],
        height: layerKeys.length,
        isCollapsed: false,
    };
    for (let row of data) {
        insertNode(tree, layerKeys, row, 0, collapsedKeyList);
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
    constructor (tree: INestNode) {
        this.tree = tree;
    }
    public first () {
        let node = this.tree
        this.nodeStack = [node];
        while (node.children.length > 0 && !node.isCollapsed) {
            this.nodeStack.push(node.children[0])
            node = node.children[0]
        }
        this.current = node;
        return this.current;
    }
    public next (): INestNode | null {
        let cursorMoved = false;
        let counter = 0
        while (this.nodeStack.length > 1) {
            counter++
            if (counter > 100) break;
            let node = this.nodeStack[this.nodeStack.length - 1];
            let parent = this.nodeStack[this.nodeStack.length - 2];
            let nodeIndex = parent.children.findIndex(n => n.key === node!.key);
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
                    this.nodeStack.push(parent.children[nodeIndex + 1])
                    cursorMoved = true
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
    public predicates (): { key: string; value: string | number }[] {
        return this.nodeStack.filter(node => node.key !== ROOT_KEY).map(node => ({
            key: node.fieldKey,
            value: node.value
        }))
    }
}

export function buildMetricTableFromNestTree (leftTree: INestNode, topTree: INestNode, data: IRow[]): (IRow | null)[][] {
    const mat: any[][] = [];
    const iteLeft = new NodeIterator(leftTree);
    const iteTop = new NodeIterator(topTree);
    iteLeft.first();
    while (iteLeft.current !== null) {
        const vec: any[] = [];
        iteTop.first();
        while (iteTop.current !== null) {
            const predicates = iteLeft.predicates().concat(iteTop.predicates()).filter((ele) => ele.value !== "total");
            const matchedRows = data.filter(r => predicates.every(pre => r[pre.key] === pre.value));
            if (matchedRows.length > 0) {
                // If multiple rows are matched, then find the most matched one (the row with smallest number of keys)
                vec.push(matchedRows.reduce((a, b) => Object.keys(a).length < Object.keys(b).length ? a : b));
            } else {
                vec.push(undefined);
            }
            iteTop.next();
        }
        mat.push(vec)
        iteLeft.next();
    }
    return mat;
}

export function getAllChildrenSize (node: INestNode, depth: number): number {
    if (depth === 0) {
        return node.children.length;
    }
    return node.children.reduce((acc, child) => acc + getAllChildrenSize(child, depth + 1), 0)

}