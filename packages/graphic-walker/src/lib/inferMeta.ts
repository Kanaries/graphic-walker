import { IAnalyticType, IMutField, IRow, ISemanticType, IUncertainMutField } from '../interfaces';

const COMMON_TIME_FORMAT: RegExp[] = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{4}\.\d{2}\.\d{2}$/, // YYYY.MM.DD
    /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, // YYYY-MM-DDTHH:MM:SS (ISO-8601)
];

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
        const number = parseFloat(item);
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

export function inferSemanticType(data: IRow[], fid: string): ISemanticType {
    const values = data.map((row) => row[fid]);

    let st: ISemanticType = isNumericArray(values) ? 'quantitative' : 'nominal';
    if (st === 'nominal') {
        if (isDateTimeArray(data.map((row) => `${row[fid]}`))) st = 'temporal';
    }
    return st;
}

export function inferMeta(props: { dataSource: IRow[]; fields: IUncertainMutField[] }): IMutField[] {
    const { dataSource, fields } = props;
    const finalFieldMetas: IMutField[] = [];
    for (let field of fields) {
        let semanticType: ISemanticType =
            field.semanticType === '?' ? inferSemanticType(dataSource, field.fid) : field.semanticType;
        let analyticType: IAnalyticType = inferAnalyticTypeFromSemanticType(semanticType);

        finalFieldMetas.push({
            fid: field.fid,
            key: field.key ? field.key : field.fid,
            name: field.name ? field.name : field.fid,
            analyticType,
            semanticType,
            basename: field.basename || field.name || field.fid,
            path: field.path,
        });
    }
    return finalFieldMetas;
}
