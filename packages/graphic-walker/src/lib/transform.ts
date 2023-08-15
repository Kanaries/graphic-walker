import { IFieldTransform, IRow } from "../interfaces";
import { dataframe2Dataset, dataset2DataFrame, execExpression } from "./execExp";

export function transformData(data: IRow[], trans: IFieldTransform[]) {
    let df = dataset2DataFrame(data);
    for (let i = 0; i < trans.length; i++) {
        const field = trans[i];
        df = execExpression(field.expression, df);
    }
    return dataframe2Dataset(df);
}
