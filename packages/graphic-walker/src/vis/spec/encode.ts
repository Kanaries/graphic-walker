import { DATE_TIME_DRILL_LEVELS } from '../../constants';
import { IPaintMap, IPaintMapV2, IRow, IViewField } from '../../interfaces';
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
    vegaConfig?: any;
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
        case 'iso_year':
        case 'year':
            return 'utcyear';
        case 'quarter':
            return 'utcyearquarter';
        case 'month':
            return 'utcyearmonth';
        case 'iso_week':
        case 'week':
            return 'utcyearweek';
        case 'day':
            return 'utcyearmonthdate';
        case 'hour':
            return 'utcyearmonthdatehours';
        case 'minute':
            return 'utcyearmonthdatehoursminutes';
        case 'second':
            return 'utcyearmonthdatehoursminutesseconds';
    }
    return unit;
}

function isoTimeformat(unit: string) {
    switch (unit) {
        case 'iso_year':
            return '%G';
        case 'iso_week':
            return '%G W%V';
    }
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
            const field: IViewField = props[c];
            if (field !== NULL_FIELD) {
                encoding[c] = {
                    field: encodeFid(field.fid),
                    title: field.name,
                    type: field.semanticType,
                };
                if (field.computed && field.expression?.op === 'bin') {
                    const fid = encoding[c].field;
                    encoding[c].field = `${fid}[0]`;
                    delete encoding[c].type;
                    encoding[c].bin = {
                        binned: true,
                    };
                    encoding[c].formatType = 'formatBin';
                    encoding[c].format = props.vegaConfig?.numberFormat;
                    if (c === 'x' || c === 'y') {
                        encoding[`${c}2`] = {
                            field: `${fid}[1]`,
                            formatType: 'formatBin',
                            format: props.vegaConfig?.numberFormat,
                        };
                    }
                }
                if (field.analyticType !== 'measure') {
                    // if `aggregate` is set to null,
                    // do not aggregate this field
                    encoding[c].aggregate = null;
                }
                if (field.analyticType === 'measure') {
                    encoding[c].type = 'quantitative';
                }
                if (field.semanticType === 'temporal') {
                    encoding[c].scale = { type: 'utc' };
                }
                if (field.semanticType === 'temporal' && field.timeUnit) {
                    if (field.timeUnit.startsWith('iso')) {
                        encoding[c].format = isoTimeformat(field.timeUnit);
                    }
                    encoding[c].timeUnit = encodeTimeunit(field.timeUnit);
                }
                if (c === 'color' && field.expression?.op === 'paint') {
                    const map: IPaintMap | IPaintMapV2 = field.expression!.params.find((x) => x.type === 'map' || x.type === 'newmap')!.value;
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
