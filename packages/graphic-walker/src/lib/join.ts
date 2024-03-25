import { IRow, IDatasetForeign } from '../interfaces';

function transformDataset(data: IRow[], name: string) {
    return data.map(transformData(name));
}

function transformData(name: string) {
    return (row: IRow) => Object.fromEntries(Object.entries(row).map(([k, v]) => [`${name}.${k}`, v]));
}

export function join(rawDatasets: Record<string, IRow[]>, foreigns: IDatasetForeign[]) {
    let res: IRow[] | undefined;
    const joined = new Set<string>();
    foreigns.forEach((foreign) => {
        if (!res) {
            res = transformDataset(rawDatasets[foreign.keys[0].dataset], foreign.keys[0].as);
            joined.add(foreign.keys[0].as);
        }
        const base = foreign.keys.find((x) => joined.has(x.as))!;
        const links = foreign.keys.filter((x) => !joined.has(x.as));

        const baseKey = `${base.as}.${base.field}`;
        links.forEach(({ as, dataset, field }) => {
            res = res!.flatMap((row) =>
                rawDatasets[dataset]
                    .filter((rowToJoin) => rowToJoin[field] === row[baseKey])
                    .map(transformData(as))
                    .map((additionData) => ({ ...additionData, ...row }))
            );
            joined.add(as);
        });
    });
    return res;
}
