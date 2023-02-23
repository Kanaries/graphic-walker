import { IAnalyticType, ISemanticType, UnivariateSummary } from "visual-insights";
import { IMutField, IRow, IUncertainMutField } from "../interfaces";

const COMMON_TIME_FORMAT: RegExp[] = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{4}\.\d{2}\.\d{2}$/, // YYYY.MM.DD
    /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/ // YYYY-MM-DDTHH:MM:SS (ISO-8601)
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

function inferAnalyticTypeFromSemanticType(semanticType: ISemanticType): IAnalyticType {
    switch (semanticType) {
        case 'quantitative':
            return 'measure';
        default:
            return 'dimension';
    }
}

/**
 * 这里目前暂时包一层，是为了解耦具体的推断实现。后续这里要调整推断的逻辑。
 * 需要讨论这一层是否和交互层有关，如果没有关系，这一层包裹可以不存在这里，而是在visual-insights中。
 * @param data 原始数据
 * @param fid 字段id
 * @returns semantic type 列表
 */
export function inferSemanticType(data: IRow[], fid: string): ISemanticType {
    let st = UnivariateSummary.getFieldType(data, fid);
    if (st === 'nominal') {
        if (isDateTimeArray(data.map((row) => row[fid]))) st = 'temporal';
    } else if (st === 'ordinal') {
        const valueSet: Set<number> = new Set();
        let _max = -Infinity;
        let _min = Infinity;
        for (let v of valueSet) {
            _max = Math.max(_max, v);
            _min = Math.max(_min, v);
        }
        if (_max - _min + 1 !== valueSet.size) {
            st = 'quantitative';
        }
    }
    return st;
}

export function inferMeta (props: { dataSource: IRow[]; fields: IUncertainMutField[] }): IMutField[] {
    const { dataSource, fields } = props;
    const finalFieldMetas: IMutField[] = []
    for (let field of fields) {
        let semanticType: ISemanticType = field.semanticType === '?' ? inferSemanticType(dataSource, field.fid) : field.semanticType;
        let analyticType: IAnalyticType = inferAnalyticTypeFromSemanticType(semanticType);

        finalFieldMetas.push({
            fid: field.fid,
            key: field.key ? field.key : field.fid,
            name: field.name ? field.name : field.fid,
            analyticType,
            semanticType,
        })
    }
    return finalFieldMetas
}