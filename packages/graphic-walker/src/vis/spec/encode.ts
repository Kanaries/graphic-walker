import { IViewField } from '../../interfaces';
import { NULL_FIELD } from './field';
export interface IEncodeProps {
    geomType: string;
    x: IViewField;
    y: IViewField;
    color: IViewField;
    opacity: IViewField;
    size: IViewField;
    shape: IViewField;
    xOffset: IViewField;
    yOffset: IViewField;
    row: IViewField;
    column: IViewField;
    theta: IViewField;
    radius: IViewField;
    details: Readonly<IViewField[]>;
}
function availableChannels(geomType: string): Set<string> {
    if (geomType === 'arc') {
        return new Set(['opacity', 'color', 'size', 'theta', 'radius']);
    }
    return new Set(['column', 'opacity', 'color', 'row', 'size', 'x', 'y', 'xOffset', 'yOffset', 'shape']);
}
export function channelEncode(props: IEncodeProps) {
    const avcs = availableChannels(props.geomType);
    const encoding: { [key: string]: any } = {};
    Object.keys(props)
        .filter((c) => avcs.has(c))
        .forEach((c) => {
            if (props[c] !== NULL_FIELD) {
                encoding[c] = {
                    field: props[c].fid,
                    title: props[c].name,
                    type: props[c].semanticType,
                };
                if (props[c].analyticType !== 'measure') {
                    // if `aggregate` is set to null,
                    // do not aggregate this field
                    encoding[c].aggregate = null;
                }
                if (props[c].analyticType === 'measure') {
                    encoding[c].type = 'quantitative';
                }
            }
        });
    // FIXME: temporal fix, only for x and y relative order
    if (encoding.x) {
        encoding.x.axis = { labelOverlap: true }
    }
    if (encoding && encoding.y) {
        encoding.y.axis = { labelOverlap: true }
    }
    if (encoding.x && encoding.y) {
        if ((props.x.sort && props.x.sort) || (props.y && props.y.sort)) {
            if (props.x.sort !== 'none' && (props.y.sort === 'none' || !Boolean(props.y.sort))) {
                encoding.x.sort = {
                    encoding: 'y',
                    order: props.x.sort,
                };
            } else if (props.y.sort && props.y.sort !== 'none' && (props.x.sort === 'none' || !Boolean(props.x.sort))) {
                encoding.y.sort = {
                    encoding: 'x',
                    order: props.y.sort,
                };
            }
        }
    }
    return encoding;
}
