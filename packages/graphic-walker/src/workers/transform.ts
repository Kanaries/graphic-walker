import { IField, IRow } from "../interfaces";
import { dataframe2Dataset, dataset2DataFrame, execExpression } from "../lib/execExp";

export function transformData(data: IRow[], columns: IField[]) {
    const computedFields = columns.filter((f) => f.computed);
    let df = dataset2DataFrame(data, columns);
    for (let i = 0; i < computedFields.length; i++) {
        const field = computedFields[i];
        df = execExpression(field.expression!, df, columns);
    }
    return dataframe2Dataset(df, columns);
}
