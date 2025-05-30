import { SparseArray } from './array';

describe('SparseArray', () => {
    it('should create an empty SparseArray', () => {
        const arr = SparseArray.create<number>();
        expect(arr.get(0)).toBeNull();
    });

    it('should set and get values', () => {
        let arr = SparseArray.create<string>();
        arr = arr.set(10, 'foo');
        arr = arr.set(1000000, 'bar');
        expect(arr.get(10)).toBe('foo');
        expect(arr.get(1000000)).toBe('bar');
        expect(arr.get(5)).toBeNull();
    });

    it('should slice with unset indices as null', () => {
        let arr = SparseArray.create<number>();
        arr = arr.set(2, 42);
        arr = arr.set(4, 99);
        expect(arr.slice(0, 6)).toEqual([null, null, 42, null, 99, null]);
    });

    it('should putIn a range of items', () => {
        let arr = SparseArray.create<number>();
        arr = arr.putIn(5, [1, 2, 3]);
        expect(arr.get(5)).toBe(1);
        expect(arr.get(6)).toBe(2);
        expect(arr.get(7)).toBe(3);
        expect(arr.get(8)).toBeNull();
        expect(arr.slice(4, 9)).toEqual([null, 1, 2, 3, null]);
    });

    it('should handle large indices efficiently', () => {
        let arr = SparseArray.create<string>();
        arr = arr.set(100_000_000, 'big');
        expect(arr.get(100_000_000)).toBe('big');
        expect(arr.get(0)).toBeNull();
    });

    it('should be immutable', () => {
        const arr1 = SparseArray.create<number>();
        const arr2 = arr1.set(5, 42);
        
        expect(arr1.get(5)).toBeNull();
        expect(arr2.get(5)).toBe(42);
        
        const arr3 = arr2.putIn(10, [1, 2, 3]);
        expect(arr2.get(10)).toBeNull();
        expect(arr3.get(10)).toBe(1);
    });
});
