import { IRow } from "../../interfaces";
import { IBinQuery } from "../../interfaces";

export function bin (dataSource: IRow[], query: IBinQuery): IRow[] {
    const { binBy, newBinCol, binSize } = query;
    let _min = Infinity;
    let _max = -Infinity;
    for (let i = 0; i < dataSource.length; i++) {
        let val = dataSource[i][binBy];
        if (val > _max) _max = val;
        if (val < _min) _min = val;
    }
    const step = (_max - _min) / binSize;
    // const beaStep = Math.max(-Math.round(Math.log10(_max - _min)) + 2, 0)
    return dataSource.map((r) => {
        let bIndex = Math.floor((r[binBy] - _min) / step);
        if (bIndex === binSize) bIndex = binSize - 1;
        return {
            ...r,
            [newBinCol]: [bIndex * step + _min, (bIndex + 1) * step + _min],
            
            // [binFid]: Number(((bIndex * step + _min)).toFixed(beaStep)),
        };
    });
}