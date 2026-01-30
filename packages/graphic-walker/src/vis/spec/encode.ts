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

const AXIS_CHANNELS = new Set(['x', 'y', 'xOffset', 'yOffset', 'theta', 'radius']);
const LEGEND_CHANNELS = new Set(['color', 'size', 'shape', 'opacity']);

function applyCustomFormat(channelKey: string, entry: Record<string, any>, field: IViewField) {
    if (!field.customFormat || !entry) return;
    entry.format = field.customFormat;
    if (channelKey === 'text') {
        return;
    }
    if (channelKey === 'row' || channelKey === 'column') {
        entry.header = { ...(entry.header ?? {}), format: field.customFormat };
        return;
    }
    if (LEGEND_CHANNELS.has(channelKey)) {
        entry.legend = { ...(entry.legend ?? {}), format: field.customFormat };
        return;
    }
    if (AXIS_CHANNELS.has(channelKey)) {
        entry.axis = { ...(entry.axis ?? {}), format: field.customFormat };
    }
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
                    title: field.titleOverride ?? field.name,
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
                applyCustomFormat(c, encoding[c], field);
            }
        });
    // FIXME: temporal fix, only for x and y relative order
    if (encoding.x) {
        encoding.x.axis = { ...(encoding.x.axis ?? {}), labelOverlap: true };
    }
    if (encoding && encoding.y) {
        encoding.y.axis = { ...(encoding.y.axis ?? {}), labelOverlap: true };
    }

    const applyManualSort = (channelKey: 'x' | 'y' | 'row' | 'column', field: IViewField | undefined, fallback?: 'x' | 'y') => {
        if (!field || field === NULL_FIELD || field.analyticType !== 'dimension') return;
        const strategy = field.sortType ?? 'measure';
        if (!encoding[channelKey]) return;
        if (strategy === 'manual' && field.sortList && field.sortList.length > 0) {
            encoding[channelKey].sort = field.sortList;
            return;
        }
        if (strategy === 'alphabetical') {
            const order = field.sort && field.sort !== 'none' ? field.sort : 'ascending';
            encoding[channelKey].sort = order;
            return;
        }
        if (strategy === 'measure' && fallback && field.sort && field.sort !== 'none') {
            encoding[channelKey].sort = {
                encoding: fallback,
                order: field.sort,
            };
        }
    };

    const xField = props.x;
    const yField = props.y;

    if (
        xField &&
        yField &&
        xField !== NULL_FIELD &&
        yField !== NULL_FIELD &&
        ((xField.sortType ?? 'measure') === 'manual' || (xField.sortType ?? 'measure') === 'alphabetical' || (yField.sortType ?? 'measure') === 'manual' || (yField.sortType ?? 'measure') === 'alphabetical')
    ) {
        // allow alphabetical/manual without requiring measure counterpart
        applyManualSort('x', xField);
        applyManualSort('y', yField);
    } else {
        if (xField && yField && xField !== NULL_FIELD && yField !== NULL_FIELD) {
            const xNeedsMeasureSort = xField.analyticType === 'dimension' && yField.analyticType === 'measure';
            const yNeedsMeasureSort = yField.analyticType === 'dimension' && xField.analyticType === 'measure';
            if (xNeedsMeasureSort) {
                applyManualSort('x', xField, 'y');
            }
            if (yNeedsMeasureSort) {
                applyManualSort('y', yField, 'x');
            }
        } else {
            if (xField) {
                applyManualSort('x', xField);
            }
            if (yField) {
                applyManualSort('y', yField);
            }
        }
    }

    applyManualSort('column', props.column);
    applyManualSort('row', props.row);

    return encoding;
}
