import { MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID, PAINT_FIELD_ID, DEFAULT_DATASET } from '@/constants';
import { IDatasetForeign, IExpression, IFilterField, IJoinPath, IMutField, IPaintMapV2, IViewField } from '@/interfaces';
import { reverse } from 'lodash-es';
import { produce } from 'immer';

export function mergePaths(paths: IJoinPath[]) {
    const result: IJoinPath[] = [];
    if (paths.length === 0) return [];
    paths.forEach((route) => {
        if (result.length) {
            const lastRoute = result[result.length - 1];
            if (route.from === lastRoute.to && route.fid === lastRoute.tid && route.to === lastRoute.from && route.tid === lastRoute.fid) {
                result.pop();
                return;
            }
        }
        result.push(route);
    });
    return result;
}

export function reversePath({ fid, from, tid, to }: IJoinPath) {
    return { fid: tid, from: to, tid: fid, to: from };
}

export function reversePaths(paths: IJoinPath[]) {
    return reverse(paths.slice()).map(reversePath);
}

export function getMap(fields: IMutField[]) {
    const map: Record<string, IJoinPath[]> = {};
    fields
        .filter((f) => f.foreign && f.dataset)
        .forEach((f) => {
            if (!map[f.dataset!]) {
                map[f.dataset!] = [];
            }
            map[f.dataset!].push({
                from: f.dataset!,
                fid: f.fid,
                to: f.foreign!.dataset,
                tid: f.foreign!.fid,
            });
            if (!map[f.foreign!.dataset!]) {
                map[f.foreign!.dataset!] = [];
            }
            map[f.foreign!.dataset].push({
                to: f.dataset!,
                tid: f.fid,
                from: f.foreign!.dataset,
                fid: f.foreign!.fid,
            });
        });
    return map;
}

export function getRoute(from: string, to: string, map: Record<string, IJoinPath[]>): IJoinPath[] | null {
    const current = [{ pos: from, path: [] as IJoinPath[] }];
    const visited = new Set([from]);
    while (current.length) {
        const { pos: now, path } = current.shift()!;
        if (now === to) {
            return path;
        }
        map[now].forEach((v) => {
            if (!visited.has(v.to)) {
                current.push({ pos: v.to, path: path.concat([v]) });
                visited.add(v.to);
            }
        });
    }
    return null;
}

export function getReachedDatasets(from: string, map: Record<string, IJoinPath[]>) {
    const current = [from];
    const visited = new Set([from]);
    while (current.length) {
        const now = current.shift()!;
        (map[now] ?? []).forEach((v) => {
            if (!visited.has(v.to)) {
                current.push(v.to);
                visited.add(v.to);
            }
        });
    }
    return visited;
}

const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export function encodePath(path: IJoinPath[]) {
    return cyrb53(path.map((p) => `${p.from}_${p.fid}_${p.to}_${p.tid}`).join('_')).toString(36);
}

export const BASE_DATASET_AS = encodePath([]);

const reversedFids = new Set([MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID, PAINT_FIELD_ID]);

export interface IFieldTransformer {
    get(): { fid: string; dataset?: string; joinPath?: IJoinPath[] };
    update(fid: string): void;
}

export function buildMultiDatasetQuery(transformers: IFieldTransformer[]): {
    foreignKeys: IDatasetForeign[] | null;
    datasets: string[];
    processFid: (path?: IJoinPath[]) => (x: string) => string;
} {
    if (transformers.length === 0) {
        return {
            foreignKeys: null,
            datasets: [],
            processFid: () => (x) => x,
        };
    }
    const endPointDatasets = new Set<string>(
        transformers.map((f) => {
            const { dataset = DEFAULT_DATASET, joinPath = [] } = f.get();
            return JSON.stringify([dataset, joinPath]);
        })
    );
    const [baseDataset, path] = JSON.parse(Array.from(endPointDatasets).sort()[0]);
    const basePath = reversePaths(path);
    const getActualPath = (path: IJoinPath[]) => mergePaths(path.concat(basePath));
    const joinedDatasets = new Set([BASE_DATASET_AS]);
    const usedDatasets = new Set([baseDataset]);
    const foreignKeys: IDatasetForeign[] = [];
    const updater: (() => void)[] = [];
    transformers.forEach((field) => {
        const { fid, joinPath = [] } = field.get();
        if (reversedFids.has(fid)) {
            return;
        }
        const actualPath = getActualPath(joinPath);
        actualPath.forEach((_, i, arr) => {
            const path = arr.slice(i);
            const [node, ...restPath] = path;
            const key = encodePath(path);
            if (!joinedDatasets.has(key)) {
                joinedDatasets.add(key);
                usedDatasets.add(node.from);
                usedDatasets.add(node.to);
                foreignKeys.push({
                    type: 'inner',
                    keys: [
                        { dataset: node.from, field: node.fid, as: key },
                        { dataset: node.to, field: node.tid, as: encodePath(restPath) },
                    ],
                });
            }
        });
        updater.push(() => field.update(`${encodePath(actualPath)}.${fid}`));
    });
    if (usedDatasets.size > 1) {
        updater.forEach((f) => f());
        return {
            foreignKeys: sortForeignKeys(foreignKeys),
            datasets: Array.from(usedDatasets),
            processFid: (path?: IJoinPath[]) => {
                const prefix = encodePath(getActualPath(path ?? []));
                return (x: string) => `${prefix}.${x}`;
            },
        };
    }
    return {
        foreignKeys: null,
        datasets: Array.from(usedDatasets),
        processFid: () => (x: string) => x,
    };
}

function sortForeignKeys(keys: IDatasetForeign[]): IDatasetForeign[] {
    if (keys.length === 0) return keys;
    let now = keys[0].keys[0].as;
    const reached = new Set([now]);
    const queue = keys.slice();
    const result: IDatasetForeign[] = [];
    let loopedItems: IDatasetForeign | null = null;
    while (queue.length) {
        const item = queue.shift()!;
        const linkedItem = item.keys.find((x) => reached.has(x.as));
        if (linkedItem) {
            item.keys.forEach((x) => reached.add(x.as));
            result.push({ type: item.type, keys: [linkedItem, ...item.keys.filter((x) => x !== linkedItem)] });
        } else {
            if (loopedItems === item) {
                console.error('meet looped item', keys, item);
                break;
            }
            queue.push(item);
            loopedItems = item;
        }
    }
    return result;
}

/**
 * return transformers that mutables the computed of the field.
 */
function createTransformerForComputed<T extends { fid: string; dataset?: string; joinPath?: IJoinPath[]; expression?: IExpression }>(
    field: T
): IFieldTransformer[] {
    const { dataset, expression, joinPath } = field;
    if (!expression) {
        return [];
    }
    const result: IFieldTransformer[] = [
        {
            get() {
                return { fid: expression.as, dataset, joinPath };
            },
            update(fid) {
                expression.as = fid;
            },
        },
    ];
    if (expression.op === 'expr') {
        // delayed process in processExpression
    } else if (expression.op === 'paint') {
        expression.params.forEach((p) => {
            if (p.type === 'newmap') {
                p.value.facets.forEach((f) =>
                    f.dimensions.forEach((d) => {
                        result.push({
                            get() {
                                return d;
                            },
                            update(fid) {
                                d.fid = fid;
                            },
                        });
                    })
                );
            }
        });
    } else {
        expression.params.forEach((p) => {
            if (p.type === 'field') {
                result.push({
                    get() {
                        return { fid: p.value, dataset, joinPath };
                    },
                    update(fid) {
                        p.value = fid;
                    },
                });
            }
        });
    }
    return result;
}

export function transformMultiDatasetFields<V extends Record<string, readonly Omit<IViewField, 'dragId'>[] | Omit<IViewField, 'dragId'> | undefined>>(
    fieldsSet: Readonly<{ views: V; filters: IFilterField[] }>
) {
    return produce(
        fieldsSet as typeof fieldsSet & {
            foreignKeys: IDatasetForeign[] | null;
            datasets: string[];
            processFid: (path?: IJoinPath[]) => (x: string) => string;
        },
        (fields) => {
            const transformers: IFieldTransformer[] = [];
            Object.keys(fields.views).forEach((k) => {
                const item = fields.views[k];
                if (!item) return;
                (item instanceof Array ? item : [item]).forEach((f) => {
                    if (f.computed && f.expression) {
                        transformers.push(...createTransformerForComputed(f));
                    }
                    transformers.push({
                        get() {
                            return f;
                        },
                        update(fid) {
                            f.fid = fid;
                        },
                    });
                });
            });
            fields.filters.forEach((f) => {
                if (f.computed && f.expression) {
                    transformers.push(...createTransformerForComputed(f));
                }
                transformers.push({
                    get() {
                        return f;
                    },
                    update(fid) {
                        f.fid = fid;
                    },
                });
            });

            const { datasets, foreignKeys, processFid } = buildMultiDatasetQuery(transformers);
            fields.datasets = datasets;
            fields.foreignKeys = foreignKeys;
            fields.processFid = processFid;
        }
    );
}
