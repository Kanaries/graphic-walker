import { IExpParamter, IExpression, IField, IRow } from "../interfaces";

interface IDataFrame {
    [key: string]: any[];
}

export function execExpression (exp: IExpression, dataFrame: IDataFrame, columns: IField[]): IDataFrame {
    const { op, params } = exp;
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
                let f = execExpression(param.value, dataFrame, columns);
                Object.keys(f).forEach(key => {
                    subFrame[key] = f[key];
                })
                break;
            case 'value':
            default:
                break;
        }
    }
    switch (op) {
        case 'bin':
            return bin(exp.as, params, subFrame);
        case 'log2':
            return log2(exp.as, params, subFrame);
        case 'log10':
            return log10(exp.as, params, subFrame);
        default:
            return subFrame;
    }
}

function bin(resKey: string, params: IExpParamter[], data: IDataFrame, binSize: number | undefined = 10): IDataFrame {
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
    const beaStep = Math.max(-Math.round(Math.log10(_max - _min)) + 2, 0)
    const newValues = fieldValues.map((v: number) => {
        let bIndex = Math.floor((v - _min) / step);
        if (bIndex === binSize) bIndex = binSize - 1;
        return Number(((bIndex * step + _min)).toFixed(beaStep))
    });
    return {
        ...data,
        [resKey]: newValues,
    }
}

function log2(resKey: string, params: IExpParamter[], data: IDataFrame): IDataFrame {
    const { value } = params[0];
    const field = data[value];
    const newField = field.map((v: number) => Math.log2(v));
    return {
        ...data,
        [resKey]: newField,
    }
}

function log10(resKey: string, params: IExpParamter[], data: IDataFrame): IDataFrame {
    const { value } = params[0];
    const field = data[value];
    const newField = field.map((v: number) => Math.log10(v));
    return {
        ...data,
        [resKey]: newField,
    }
}

export function dataset2DataFrame(dataset: IRow[], columns: IField[]): IDataFrame {
    const dataFrame: IDataFrame = {};
    columns.forEach((col) => {
        dataFrame[col.fid] = dataset.map((row) => row[col.fid]);
    });
    return dataFrame;
}

export function dataframe2Dataset(dataFrame: IDataFrame, columns: IField[]): IRow[] {
    if (columns.length === 0) return [];
    const dataset: IRow[] = [];
    const len = dataFrame[Object.keys(dataFrame)[0]].length;
    for (let i = 0; i < len; i++) {
        const row: IRow = {};
        columns.forEach((col) => {
            row[col.fid] = dataFrame[col.fid][i];
        });
        dataset.push(row);
    }
    return dataset;
}
