import { IExpParameter, IExpression, IPaintMap, IRow } from '../interfaces';
import dateTimeDrill from './op/dateTimeDrill';
import dateTimeFeature from './op/dateTimeFeature';
import { calcMap } from './paint';

export interface IDataFrame {
    [key: string]: any[];
}

export async function execExpression(exp: IExpression, dataFrame: IDataFrame): Promise<IDataFrame> {
    const { op, params, num } = exp;
    const subFrame: IDataFrame = { ...dataFrame };
    const len = dataFrame[Object.keys(dataFrame)[0]].length;
    for (let param of params) {
        switch (param.type) {
            case 'field':
                subFrame[param.value] = dataFrame[param.value];
                break;
            case 'constant':
                subFrame[param.value] = new Array(len).fill(param.value);
                break;
            case 'expression':
                let f = await execExpression(param.value, dataFrame);
                Object.keys(f).forEach((key) => {
                    subFrame[key] = f[key];
                });
                break;
            case 'value':
            default:
                break;
        }
    }
    switch (op) {
        case 'one':
            return one(exp.as, params, subFrame);
        case 'log':
            return log(exp.as, params, subFrame, num);
        case 'log2':
            return log(exp.as, params, subFrame, 2);
        case 'log10':
            return log(exp.as, params, subFrame, 10);
        case 'binCount':
            return binCount(exp.as, params, subFrame, num);
        case 'bin':
            return bin(exp.as, params, subFrame, num);
        case 'dateTimeDrill':
            return dateTimeDrill(exp.as, params, subFrame);
        case 'dateTimeFeature':
            return dateTimeFeature(exp.as, params, subFrame);
        case 'paint':
            return await paint(exp.as, params, subFrame);
        default:
            return subFrame;
    }
}

function bin(resKey: string, params: IExpParameter[], data: IDataFrame, binSize: number | undefined = 10): IDataFrame {
    const { value: fieldKey } = params[0];
    const fieldValues = data[fieldKey] as number[];
    let _min = Infinity;
    let _max = -Infinity;
    for (let i = 0; i < fieldValues.length; i++) {
        let val = fieldValues[i];
        if (val > _max) _max = val;
        if (val < _min) _min = val;
    }
    const step = (_max - _min) / binSize;
    // prevent (_max - _min) to be 0
    const safeWidth = Math.min(Number.MAX_SAFE_INTEGER, Math.max(_max - _min, Number.MIN_VALUE));
    const beaStep = Math.max(-Math.round(Math.log10(safeWidth)) + 2, 0);
    // toFix() accepts 0-100
    const safeBeaStep = Math.min(100, Math.max(0, Math.max(Number.isFinite(beaStep) ? beaStep : 0, 0)));
    const newValues = fieldValues.map((v: number) => {
        let bIndex = Math.floor((v - _min) / step);
        if (bIndex === binSize) bIndex = binSize - 1;
        if (Number.isNaN(bIndex)) {
            bIndex = 0;
        }
        return Number((bIndex * step + _min).toFixed(safeBeaStep));
    });
    return {
        ...data,
        [resKey]: newValues,
    };
}

function binCount(resKey: string, params: IExpParameter[], data: IDataFrame, binSize: number | undefined = 10): IDataFrame {
    const { value: fieldKey } = params[0];
    const fieldValues = data[fieldKey] as number[];

    const valueWithIndices: { val: number; index: number; orderIndex: number }[] = fieldValues
        .map((v, i) => ({
            val: v,
            index: i,
        }))
        .sort((a, b) => a.val - b.val)
        .map((item, i) => ({
            val: item.val,
            index: item.index,
            orderIndex: i,
        }));

    const groupSize = valueWithIndices.length / binSize;

    const newValues = valueWithIndices
        .sort((a, b) => a.index - b.index)
        .map((item) => {
            let bIndex = Math.floor(item.orderIndex / groupSize);
            if (bIndex === binSize) bIndex = binSize - 1;
            return bIndex + 1;
        });
    return {
        ...data,
        [resKey]: newValues,
    };
}

function log(resKey: string, params: IExpParameter[], data: IDataFrame, baseNum: number | undefined = 10): IDataFrame {
    const { value: fieldKey } = params[0];
    const fieldValues = data[fieldKey];
    const newField = fieldValues.map((v: number) => Math.log(v) / Math.log(baseNum));
    return {
        ...data,
        [resKey]: newField,
    };
}

function one(resKey: string, params: IExpParameter[], data: IDataFrame): IDataFrame {
    // const { value: fieldKey } = params[0];
    if (Object.keys(data).length === 0) return data;
    const len = data[Object.keys(data)[0]].length;
    const newField = new Array(len).fill(1);
    return {
        ...data,
        [resKey]: newField,
    };
}

async function paint(resKey: string, params: IExpParameter[], data: IDataFrame): Promise<IDataFrame> {
    const param = params.find((x) => x.type === 'map');
    if (!param) return data;
    const map: IPaintMap = param.value;
    return {
        ...data,
        [resKey]: await calcMap(data[map.x], data[map.y], map),
    };
}

export function dataset2DataFrame(dataset: IRow[]): IDataFrame {
    const dataFrame: IDataFrame = {};
    if (dataset.length === 0) return dataFrame;
    Object.keys(dataset[0]).forEach((k) => {
        dataFrame[k] = dataset.map((row) => row[k]);
    });
    return dataFrame;
}

export function dataframe2Dataset(dataFrame: IDataFrame): IRow[] {
    const cols = Object.keys(dataFrame);
    if (cols.length === 0) return [];
    const dataset: IRow[] = [];
    const len = dataFrame[Object.keys(dataFrame)[0]].length;
    for (let i = 0; i < len; i++) {
        const row: IRow = {};
        cols.forEach((k) => {
            row[k] = dataFrame[k][i];
        });
        dataset.push(row);
    }
    return dataset;
}
