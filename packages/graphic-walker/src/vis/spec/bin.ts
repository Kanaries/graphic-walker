import { IRow } from '@/interfaces';

export function addBinStep(encoding: { [key: string]: any }, dataSource: readonly IRow[]) {
    Object.keys(encoding).forEach((c) => {
        if (encoding[c].bin && dataSource[0]?.[encoding[c].field.replace('[0]', '')]) {
            const data = dataSource[0][encoding[c].field.replace('[0]', '')];
            encoding[c].bin.step = data[1] - data[0];
        }
    });
    return encoding;
}
