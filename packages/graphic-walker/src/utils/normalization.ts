import { IRow } from "../interfaces";

export function normalizeWithParent(
    data: IRow[],
    parentData: IRow[],
    measures: string[],
    syncScale: boolean
): {
    normalizedData: IRow[];
    normalizedParentData: IRow[];
} {
    const totalMeasuresOfParent: IRow = {};
    const totalMeasures: IRow = {};
    measures.forEach((mea) => {
        totalMeasuresOfParent[mea] = 0;
        totalMeasures[mea] = 0;
    });
    parentData.forEach((record) => {
        measures.forEach((mea) => {
            totalMeasuresOfParent[mea] += Math.abs(record[mea]);
        });
    });
    data.forEach((record) => {
        measures.forEach((mea) => {
            totalMeasures[mea] += Math.abs(record[mea]);
        });
    });
    const normalizedParentData: IRow[] = [];
    parentData.forEach((record) => {
        const newRecord = { ...record };
        measures.forEach((mea) => {
            newRecord[mea] /= totalMeasuresOfParent[mea];
        });
        normalizedParentData.push(newRecord);
    });
    const normalizedData: IRow[] = [];
    data.forEach((record) => {
        const newRecord = { ...record };
        measures.forEach((mea) => {
            if (syncScale) {
                newRecord[mea] /= totalMeasuresOfParent[mea];
            } else {
                newRecord[mea] /= totalMeasures[mea];
            }
        });
        normalizedData.push(newRecord);
    });
    return {
        normalizedData,
        normalizedParentData,
    };
}

export function compareDistribution(
    distribution1: IRow[],
    distribution2: IRow[],
    dimensions: string[],
    measures: string[]
): number {
    let score = 0;
    let count = 0;
    const tagsForD2: boolean[] = distribution2.map(() => false);
    for (let record of distribution1) {
        let targetRecordIndex = distribution2.findIndex((r, i) => {
            return !tagsForD2[i] && dimensions.every((dim) => r[dim] === record[dim]);
        });
        if (targetRecordIndex > -1) {
            tagsForD2[targetRecordIndex] = true;
            const targetRecord = distribution2[targetRecordIndex];
            for (let mea of measures) {
                score = Math.max(
                    score,
                    Math.max(targetRecord[mea], record[mea]) / Math.min(targetRecord[mea], record[mea])
                );
                count++;
            }
        } else {
            for (let mea of measures) {
                score = Math.max(score, record[mea]);
                count++;
            }
        }
    }
    for (let i = 0; i < distribution2.length; i++) {
        if (!tagsForD2[i]) {
            tagsForD2[i] = true;
            for (let mea of measures) {
                score = Math.max(score, distribution2[i][mea]);
                count++;
            }
        }
    }
    return score;
}

export function compareDistributionKL(
    distribution1: IRow[],
    distribution2: IRow[],
    dimensions: string[],
    measures: string[]
): number {
    let score = 0;
    const tagsForD2: boolean[] = distribution2.map(() => false);
    for (let record of distribution1) {
        let targetRecordIndex = distribution2.findIndex((r, i) => {
            return !tagsForD2[i] && dimensions.every((dim) => r[dim] === record[dim]);
        });
        if (targetRecordIndex > -1) {
            tagsForD2[targetRecordIndex] = true;
            const targetRecord = distribution2[targetRecordIndex];
            for (let mea of measures) {
                score += targetRecord[mea] * Math.log2(targetRecord[mea] / record[mea])
                // score += record[mea] * Math.log2(record[mea] / targetRecord[mea])
            }
        }
    }
    return score;
}

// Jensen–Shannon divergence
export function compareDistributionJS(
    distribution1: IRow[],
    distribution2: IRow[],
    dimensions: string[],
    measure: string
): number {
    let score = 0;
    const tagsForD2: boolean[] = distribution2.map(() => false);
    for (let record of distribution1) {
        let targetRecordIndex = distribution2.findIndex((r, i) => {
            return !tagsForD2[i] && dimensions.every((dim) => r[dim] === record[dim]);
        });
        if (targetRecordIndex > -1) {
            tagsForD2[targetRecordIndex] = true;
            const targetRecord = distribution2[targetRecordIndex];
            let p = record[measure];
            let q = targetRecord[measure];
            if (p === 0 || q === 0) continue;
            let m = 0.5 * (p + q);
            score += (0.5 * p * Math.log2(p / m) + 0.5 * q * Math.log2(q / m));
        }
    }
    const weight = tagsForD2.filter((tag) => tag === true).length / tagsForD2.length;

    return score * weight;
}

export function normalizeByMeasures(dataSource: IRow[], measures: string[]) {
    let sums: Map<string, number> = new Map();

    measures.forEach((mea) => {
        sums.set(mea, 0);
    });

    dataSource.forEach((record) => {
        measures.forEach((mea) => {
            sums.set(mea, sums.get(mea)! + Math.abs(record[mea]));
        });
    });

    const ans: IRow[] = [];
    dataSource.forEach((record) => {
        const norRecord: IRow = { ...record };
        measures.forEach((mea) => {
            norRecord[mea] /= sums.get(mea)!;
        });
        ans.push(norRecord);
    });
    return ans;
}

export function getDistributionDifference(
    dataSource: IRow[],
    dimensions: string[],
    measure1: string,
    measure2: string
): number {
    let score = 0;
    for (let record of dataSource) {
        if (record[measure1] === 0 || record[measure2] === 0) continue;
        score += Math.max(record[measure1], record[measure2]) / Math.min(record[measure1], record[measure2]);
    }
    return score;
}

export function makeBinField(dataSource: IRow[], fid: string, binFid: string, binSize: number | undefined = 10) {
    let _min = Infinity;
    let _max = -Infinity;
    for (let i = 0; i < dataSource.length; i++) {
        let val = dataSource[i][fid];
        if (val > _max) _max = val;
        if (val < _min) _min = val;
    }
    const step = (_max - _min) / binSize;
    const beaStep = Math.max(-Math.round(Math.log10(_max - _min)) + 2, 0)
    return dataSource.map((r) => {
        let bIndex = Math.floor((r[fid] - _min) / step);
        if (bIndex === binSize) bIndex = binSize - 1;
        return {
            ...r,
            [binFid]: [bIndex * step + _min, (bIndex + 1) * step + _min],
            
            // [binFid]: Number(((bIndex * step + _min)).toFixed(beaStep)),
        };
    });
}

export function makeLogField(dataSource: IRow[], fid: string, logFid: string) {
    return dataSource.map((r) => {
        return {
            ...r,
            [logFid]: typeof r[fid] === "number" && r[fid] > 0 ? Math.log10(r[fid]) : null,
        };
    });
}
