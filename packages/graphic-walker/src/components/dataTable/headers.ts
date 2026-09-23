import type { IMutField } from '../../interfaces';

export type wrapMutField = {
    colSpan: number;
    rowSpan: number;
} & (
    | { type: 'field'; value: IMutField; fIndex: number }
    | {
          type: 'name';
          value: string;
      }
);

export const getHeaders = (metas: IMutField[]): wrapMutField[][] => {
    const height = metas.map((x) => x.path?.length ?? 1).reduce((a, b) => Math.max(a, b), 0);
    const result: wrapMutField[][] = [...Array(height)].map(() => []);
    let prevPath: string[] = [];
    metas.forEach((x, fIndex) => {
        const path = x.path ?? [x.name ?? x.fid];
        // group levels shared with the previous field widen its group headers, the others open new ones
        let shared = 0;
        while (shared < path.length - 1 && shared < prevPath.length - 1 && path[shared] === prevPath[shared]) {
            shared++;
        }
        for (let i = 0; i < path.length - 1; i++) {
            if (i < shared) {
                result[i][result[i].length - 1].colSpan++;
            } else {
                result[i].push({
                    colSpan: 1,
                    rowSpan: 1,
                    type: 'name',
                    value: path[i],
                });
            }
        }
        prevPath = path;
        result[path.length - 1].push({
            type: 'field',
            value: x,
            colSpan: 1,
            rowSpan: height - path.length + 1,
            fIndex,
        });
    });
    return result;
};

export const getHeaderKey = (f: wrapMutField) => {
    if (f.type === 'name') {
        return f.value;
    }
    return f.value.name ?? f.value.fid;
};
