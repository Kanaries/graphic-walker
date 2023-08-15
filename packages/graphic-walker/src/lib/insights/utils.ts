import { IField } from '../../interfaces';

export function groupByAnalyticTypes(fields: IField[]) {
    const dimensions = fields.filter((f) => f.analyticType === 'dimension');
    const measures = fields.filter((f) => f.analyticType === 'measure');
    return {
        dimensions,
        measures,
    };
}

export function complementaryFields(props: { selection: IField[]; all: IField[] }): IField[] {
    return props.all.filter((f) => f.analyticType === 'dimension').filter((f) => !props.selection.find((vf) => vf.fid === f.fid));
}
