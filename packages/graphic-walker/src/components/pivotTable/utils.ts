import { IRow } from "../../interfaces";
import { INestNode } from "./inteface";

const key_prefix = 'nk_';

export function insertNode (tree: INestNode, layerKeys: string[], nodeData: IRow, depth: number, tableCollapsedHeaderMap: Map<string, INestNode["path"]>) {
    if (depth >= layerKeys.length) {
        // tree.key = nodeData[layerKeys[depth]];
        return;   
    }
    const key = nodeData[layerKeys[depth]];
    const uniqueKey = `${tree.uniqueKey}__${key}`;
    // console.log({
    //     key,
    //     nodeData,
    //     layerKeys,
    //     depth
    // })
    let child = tree.children.find((c) => c.key === key);
    if (!child) {
        // console.log(key, tree.children.map(c => c.key))
        // insertNode(child, layerKeys, nodeData, depth + 1);
        // return;
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
        if (tableCollapsedHeaderMap.has(tree.uniqueKey)) {
            tree.isCollapsed = true;
        }
        tree.children.push(child);
        tree.children.sort((a, b) => (a.key || '').localeCompare((b.key || '')));
    }
    insertNode(child, layerKeys, nodeData, depth + 1, tableCollapsedHeaderMap);

}
const ROOT_KEY = '__root';

export function buildNestTree (layerKeys: string[], data: IRow[], tableCollapsedHeaderMap: Map<string, INestNode["path"]>): INestNode {
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
        insertNode(tree, layerKeys, row, 0, tableCollapsedHeaderMap);
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
            // console.log(this.nodeStack.map(n => `${n.fieldKey}-${n.value}`))
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
        // console.log(this.current)
        return this.current;
    }
    public predicates (): { key: string; value: any }[] {
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
    // console.log(iteLeft, iteTop)
    iteLeft.first();
    // return mat;
    while (iteLeft.current !== null) {
        const vec: any[] = [];
        iteTop.first();
        while (iteTop.current !== null) {
            const predicates = iteLeft.predicates().concat(iteTop.predicates());
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