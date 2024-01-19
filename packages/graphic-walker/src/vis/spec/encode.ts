import { DATE_TIME_DRILL_LEVELS } from '../../constants';
import { IPaintMap, IPaintMapV2, IViewField } from '../../interfaces';
import { isNotEmpty } from '../../utils';
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
    text: IViewField;
    displayOffset?: number;
}
export function availableChannels(geomType: string): Set<string> {
    if (geomType === 'text') {
        return new Set(['text', 'color', 'size', 'x', 'y', 'xOffset', 'yOffset', 'opacity']);
    }
    if (geomType === 'arc') {
        return new Set(['opacity', 'color', 'size', 'theta', 'radius']);
    }
    return new Set(['column', 'opacity', 'color', 'row', 'size', 'x', 'y', 'xOffset', 'yOffset', 'shape']);
}
function encodeTimeunit(unit: (typeof DATE_TIME_DRILL_LEVELS)[number]) {
    switch (unit) {
        case 'quarter':
            return 'yearquarter';
        case 'month':
            return 'yearmonth';
        case 'week':
            return 'yearweek';
        case 'day':
            return 'yearmonthdate';
        case 'hour':
            return 'yearmonthdatehours';
        case 'minute':
            return 'yearmonthdatehoursminutes';
        case 'second':
            return 'yearmonthdatehoursminutesseconds';
    }
    return unit;
}

export function encodeFid(fid: string) {
    return fid
        .replace(/([\"\'\.\[\]\/\\])/g, '\\$1')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');
}

export function channelEncode(props: IEncodeProps) {
    const avcs = availableChannels(props.geomType);
    const encoding: { [key: string]: any } = {};
    Object.keys(props)
        .filter((c) => avcs.has(c))
        .forEach((c) => {
            if (props[c] !== NULL_FIELD) {
                encoding[c] = {
                    field: encodeFid(props[c].fid),
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
                if (props[c].semanticType === 'temporal' && isNotEmpty(props.displayOffset)) {
                    encoding[c].scale = { type: 'utc' };
                }
                if (props[c].semanticType === 'temporal' && props[c].timeUnit) {
                    encoding[c].timeUnit = encodeTimeunit(props[c].timeUnit);
                }
                if (c === 'color' && props[c].expression?.op === 'paint') {
                    const map: IPaintMap | IPaintMapV2 = props[c].expression!.params.find((x) => x.type === 'map' || x.type === 'newmap')!.value;
                    const colors = map.usedColor.map((x) => map.dict[x]).filter(Boolean);
                    encoding[c].scale = {
                        domain: colors.map((x) => x.name),
                        range: colors.map((x) => x.color),
                    };
                }
            }
        });
    // FIXME: temporal fix, only for x and y relative order
    if (encoding.x) {
        encoding.x.axis = { labelOverlap: true };
    }
    if (encoding && encoding.y) {
        encoding.y.axis = { labelOverlap: true };
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
