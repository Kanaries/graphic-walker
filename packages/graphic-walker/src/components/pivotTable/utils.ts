import { IRow } from "../../interfaces";
import { INestNode } from "./inteface";

const key_prefix = 'nk_';

export function insertNode (tree: INestNode, layerKeys: string[], nodeData: IRow, depth: number) {
    if (depth >= layerKeys.length) {
        // tree.key = nodeData[layerKeys[depth]];
        return;   
    }
    const key = nodeData[layerKeys[depth]];
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
            fieldKey: layerKeys[depth],
            children: [],
        }
        tree.children.push(child);
    }
    insertNode(child, layerKeys, nodeData, depth + 1);

}
const ROOT_KEY = '__root';

export function buildNestTree (layerKeys: string[], data: IRow[]): INestNode {
    const tree: INestNode = {
        key: ROOT_KEY,
        value: 'root',
        fieldKey: 'root',
        children: [],
    };
    for (let row of data) {
        insertNode(tree, layerKeys, row, 0);
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
        while (node.children.length > 0) {
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
                if (node.children.length > 0) {
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
            const row = data.find(r => predicates.every(pre => r[pre.key] === pre.value))
            vec.push(row)
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