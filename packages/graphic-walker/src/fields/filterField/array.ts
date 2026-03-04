import { OrderedMap } from 'immutable';

export class SparseArray<T> {
    private tree: OrderedMap<number, T>;

    private constructor(tree?: OrderedMap<number, T>) {
        this.tree = tree || OrderedMap<number, T>();
    }

    static create<T>() {
        return new SparseArray<T>();
    }

    get(index: number): T | null {
        return this.tree.has(index) ? this.tree.get(index)! : null;
    }

    set(index: number, item: T): SparseArray<T> {
        const newTree = this.tree.set(index, item);
        return new SparseArray<T>(newTree);
    }

    slice(start: number, end: number): (T | null)[] {
        const result: (T | null)[] = [];
        for (let i = start; i < end; i++) {
            result.push(this.get(i));
        }
        return result;
    }

    putIn(start: number, items: T[]): SparseArray<T> {
        let newTree = this.tree;
        for (let i = 0; i < items.length; i++) {
            newTree = newTree.set(start + i, items[i]);
        }
        return new SparseArray<T>(newTree);
    }
}
