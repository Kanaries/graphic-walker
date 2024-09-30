import { IChannelScales, IField, IFieldInfos, IRow, ISemanticType, IStackMode, IViewField } from '../../interfaces';
import { autoMark } from './mark';
import { NULL_FIELD } from './field';
import { channelAggregate } from './aggregate';
import { IEncodeProps, channelEncode, encodeFid } from './encode';
import { channelStack } from './stack';
import { addTooltipEncode } from './tooltip';
import { getTimeFormat } from '../../lib/inferMeta';
import { unexceptedUTCParsedPatternFormats } from '../../lib/op/offset';
import { addBinStep } from './bin';

export interface SingleViewProps extends IEncodeProps {
    defaultAggregated: boolean;
    stack: IStackMode;
    hasLegend?: boolean;
    hideLegend?: boolean;
    dataSource: readonly IRow[];
}

function formatOffset(offset: number) {
    if (offset === 0) return '';
    return `${offset > 0 ? '+' : '-'}${Math.abs(offset)}`;
}

export function getSingleView(props: SingleViewProps) {
    const {
        x,
        y,
        color,
        opacity,
        size,
        shape,
        theta,
        radius,
        text,
        row,
        column,
        xOffset,
        yOffset,
        details,
        defaultAggregated,
        stack,
        geomType,
        hasLegend = true,
        hideLegend = false,
        displayOffset,
        dataSource,
        vegaConfig,
    } = props;
    const fields: IViewField[] = [x, y, color, opacity, size, shape, row, column, xOffset, yOffset, theta, radius, text];
    let markType = geomType;
    let config: any = {};
    if (!hasLegend) {
        config.legend = {
            disable: true,
        };
    } else if (hideLegend) {
        config.legend = {
            gradientOpacity: 0,
            labelColor: 'transparent',
            symbolOpacity: 0,
            symbolStrokeColor: 'transparent',
            titleColor: 'transparent',
            titleOpacity: 0,
        };
    }
    if (geomType === 'auto') {
        const types: ISemanticType[] = [];
        if (x !== NULL_FIELD) types.push(x.semanticType); //types.push(getFieldType(x));
        if (y !== NULL_FIELD) types.push(y.semanticType); //types.push(getFieldType(yField));
        markType = autoMark(types);
    }

    const transform = fields
        .filter((f) => f.semanticType === 'temporal')
        .map((f) => {
            let offsetTime = (displayOffset ?? new Date().getTimezoneOffset()) * -60000;
            const fid = encodeFid(f.fid);
            const sample = dataSource[0]?.[f.fid];
            if (sample) {
                const format = getTimeFormat(sample);
                if (format !== 'timestamp') {
                    offsetTime += (f.offset ?? new Date().getTimezoneOffset()) * 60000;
                    if (!unexceptedUTCParsedPatternFormats.includes(format)) {
                        // the raw data will be parsed as local timezone, so reduce the offset with the local time zone.
                        offsetTime -= new Date().getTimezoneOffset() * 60000;
                    }
                    if (offsetTime === 0) {
                        return null;
                    }
                    return {
                        calculate: `toDate(datum[${JSON.stringify(fid)}])${formatOffset(offsetTime)}`,
                        as: fid,
                    };
                }
            }
            if (offsetTime === 0) {
                return null;
            }
            return {
                calculate: `datum[${JSON.stringify(fid)}]${formatOffset(offsetTime)}`,
                as: fid,
            };
        })
        .filter(Boolean);

    let encoding = channelEncode({
        geomType: markType,
        x,
        y,
        color,
        opacity,
        size,
        shape,
        row,
        column,
        xOffset,
        yOffset,
        theta,
        radius,
        details,
        text,
        displayOffset,
        vegaConfig,
    });
    if (defaultAggregated) {
        channelAggregate(encoding, fields);
    }
    addBinStep(encoding, dataSource);
    addTooltipEncode(encoding, details, defaultAggregated);
    channelStack(encoding, stack);
    const mark = {
        type: markType,
        opacity: 0.96,
        tooltip: { content: 'data' },
    };
    return {
        config,
        transform,
        mark,
        encoding,
    };
}

export function resolveScale<T extends Object>(
    scale: T | ((info: IFieldInfos) => T),
    field: IField | null | undefined,
    data: readonly IRow[],
    theme: 'dark' | 'light'
) {
    if (typeof scale === 'function') {
        if (!field) return undefined;
        const values = data.map((x) => x[field.fid]);
        return scale({
            semanticType: field.semanticType,
            theme,
            values,
        });
    }
    return scale;
}

export function resolveScales(scale: IChannelScales, view: any, data: readonly IRow[], theme: 'dark' | 'light') {
    const newEncoding = { ...view.encoding };
    function addScale(c: string, encodingName?: string) {
        encodingName = encodingName ?? c;
        if (scale[c] && newEncoding[encodingName]) {
            if (typeof scale[c] === 'function') {
                const field = newEncoding[encodingName].field;
                const values = data.map((x) => x[field]);
                newEncoding[encodingName].scale = scale[c]({
                    semanticType: newEncoding[encodingName].type,
                    theme,
                    values,
                });
            } else {
                newEncoding[encodingName].scale = scale[c];
            }
        }
    }
    addScale('row', 'y');
    addScale('column', 'x');
    addScale('color');
    addScale('opacity');
    addScale('size');
    addScale('radius');
    addScale('theta');

    return {
        ...view,
        encoding: newEncoding,
    };
}
