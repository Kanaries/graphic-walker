import { IAnalyticType, IMutField, IRow, ISemanticType, IUncertainMutField } from '../interfaces';
import { getValueByKeyPath } from '../utils/dataPrep';

const COMMON_TIME_FORMAT: RegExp[] = [
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, // YYYY-MM-DD
    /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/, // MM/DD/YYYY
    /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/, // DD/MM/YYYY
    /^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/, // YYYY/MM/DD
    /^\d{4}\.(0[1-9]|1[0-2])\.(0[1-9]|[12][0-9]|3[01])$/, // YYYY.MM.DD
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\s\d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T\d{2}:\d{2}:\d{2}$/, // YYYY-MM-DDTHH:MM:SS (ISO-8601)
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T\d{2}:\d{2}:\d{2}.\d{3}Z$/, // YYYY-MM-DDTHH:MM:SS.gggZ (ISO-8601)
    /^([1-9]|1[0-2])\/([1-9]|[12][0-9]|3[01])\/\d{4}$/, // m/d/YYYY
    /^([1-9]|[12][0-9]|3[01])\/([1-9]|1[0-2])\/\d{4}$/, // d/m/YYYY
];

const TIME_FORMAT = [
    '%Y-%m-%d',
    '%m/%d/%Y',
    '%d/%m/%Y',
    '%Y/%m/%d',
    '%Y.%m.%d',
    '%Y-%m-%d %H:%M:%S',
    '%Y-%m-%dT%H:%M:%S',
    '%Y-%m-%dT%H:%M:%S.%gZ',
    '%f/%e/%Y',
    '%e/%f/%Y',
];

export function getTimeFormat(data: string | number) {
    if (typeof data === 'number') return 'timestamp';
    const i = COMMON_TIME_FORMAT.findIndex((x) => x.test(data));
    if (i >= 0) return TIME_FORMAT[i];
    return '';
}

/**
 * check if this array is a date time array based on some common date format
 * @param data string array
 * @returns
 */
export function isDateTimeArray(data: string[]): boolean {
    let isDateTime = true;
    for (let d of data) {
        let isDateTimeItem = false;
        for (let r of COMMON_TIME_FORMAT) {
            if (r.test(d)) {
                isDateTimeItem = true;
                break;
            }
        }
        if (!isDateTimeItem) {
            isDateTime = false;
            break;
        }
    }
    return isDateTime;
}

export function isNumericArray(data: any[]): boolean {
    return data.every((item) => {
        // Check if the item is already a number
        if (typeof item === 'number') {
            return true;
        }

        // Check if the item can be converted into a number
        const number = Number(item);
        return !isNaN(number) && isFinite(item);
    });
}

function inferAnalyticTypeFromSemanticType(semanticType: ISemanticType): IAnalyticType {
    switch (semanticType) {
        case 'quantitative':
            return 'measure';
        default:
            return 'dimension';
    }
}

export function inferSemanticType(data: IRow[], path: string[]): ISemanticType {
    const values = data.map((row) => getValueByKeyPath(row, path));

    let st: ISemanticType = isNumericArray(values) ? 'quantitative' : 'nominal';
    if (st === 'nominal') {
        if (isDateTimeArray(data.map((row) => `${getValueByKeyPath(row, path)}`))) st = 'temporal';
    }
    return st;
}

export function inferMeta(props: { dataSource: IRow[]; fields: IUncertainMutField[] }): IMutField[] {
    const { dataSource, fields } = props;
    const finalFieldMetas: IMutField[] = [];
    for (let field of fields) {
        let semanticType: ISemanticType = field.semanticType === '?' ? inferSemanticType(dataSource, field.path) : field.semanticType;
        let analyticType: IAnalyticType = inferAnalyticTypeFromSemanticType(semanticType);

        finalFieldMetas.push({
            fid: field.fid,
            key: field.key ? field.key : field.fid,
            name: field.name ? field.name : field.fid,
            analyticType,
            semanticType,
            basename: field.basename || field.name || field.fid,
            path: field.path,
            offset: semanticType === 'temporal' ? new Date().getTimezoneOffset() : undefined,
        });
    }
    return finalFieldMetas;
}
