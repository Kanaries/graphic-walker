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

function withTextStackEncoding(encoding: Record<string, any>, stack: IStackMode, markType: string) {
    if (stack === 'none') return undefined;
    const positionChannel = ['x', 'y', 'theta', 'radius'].find((channel) => encoding[channel]?.type === 'quantitative');
    if (!positionChannel) return undefined;
    const otherAxis = positionChannel === 'x' ? 'y' : 'x';
    const stackFields = ['color', 'opacity', 'size', 'shape']
        .map((channel) => encoding[channel])
        .filter((channel) => channel?.field && !channel.aggregate && channel.field !== encoding[otherAxis]?.field);
    const implicitStack = (markType === 'bar' || markType === 'area') &&
        stackFields.length > 0 && encoding[positionChannel].aggregate !== null &&
        encoding[otherAxis]?.type !== 'quantitative' && !encoding.xOffset && !encoding.yOffset;
    const stackValue = encoding[positionChannel].stack ?? (implicitStack && (stack === 'zero' || stack === 'stack') ? true : undefined);
    if (stackValue === undefined || stackValue === null) return undefined;
    const stackEncoding: Record<string, any> = {
        [positionChannel]: {
            ...encoding[positionChannel],
            stack: stackValue,
        },
    };
    const order = stackFields.map(({ field, type }) => ({
        field, type, sort: positionChannel === 'y' ? 'descending' : 'ascending',
    }));

    const detail = stackFields.filter((field) => field !== encoding.color).map(({ field, type }) => ({ field, type }));
    if (detail.length) stackEncoding.detail = detail;
    return { encoding: stackEncoding, order };
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
        markType = autoMark(types, defaultAggregated);
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
                        calculate: `datum[${JSON.stringify(fid)}]!==null?(toDate(datum[${JSON.stringify(fid)}])${formatOffset(offsetTime)}):null`,
                        as: fid,
                    };
                }
            }
            if (offsetTime === 0) {
                return null;
            }
            return {
                calculate: `datum[${JSON.stringify(fid)}]!==null?(datum[${JSON.stringify(fid)}]${formatOffset(offsetTime)}):null`,
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
    const mark: Record<string, any> = {
        type: markType,
        opacity: 0.96,
        tooltip: { content: 'data' },
    };

    // When a text field is present on a non-text mark type, produce a layered spec
    // with the main mark in one layer and a text overlay in a second layer.
    const TEXT_LAYER_ELIGIBLE_MARKS = new Set(['bar', 'point', 'circle', 'rect', 'line', 'area', 'tick', 'trail', 'arc']);
    const SHARED_ENCODING_KEYS = new Set(['x', 'y', 'x2', 'y2', 'row', 'column', 'xOffset', 'yOffset', 'tooltip', 'theta', 'radius', 'color']);
    if (TEXT_LAYER_ELIGIBLE_MARKS.has(markType as string) && text !== NULL_FIELD && encoding.text) {
        const sharedEncoding: Record<string, any> = {};
        const mainLayerEncoding: Record<string, any> = {};
        const textLayerEncoding: Record<string, any> = {};
        for (const [key, value] of Object.entries(encoding)) {
            if (key === 'text') {
                textLayerEncoding.text = value;
            } else if (SHARED_ENCODING_KEYS.has(key) && (key !== 'color' || markType !== 'rect')) {
                sharedEncoding[key] = value;
            } else {
                mainLayerEncoding[key] = value;
            }
        }
        const labelStack = withTextStackEncoding(encoding, stack, markType);
        let stackOrderTransform: { window: { op: 'dense_rank'; as: string }[]; sort: { field: string; order: string }[] }[] | undefined;
        if (labelStack) {
            Object.assign(textLayerEncoding, labelStack.encoding);
            const { order } = labelStack;
            if (order.length > 1) {
                // Vega-Lite 5 drops array-valued order encodings. Rank the grouping tuple once for both layers.
                const usedFields = new Set([...fields, ...details].map((field) => encodeFid(field.fid)));
                let stackOrderField = '__gw_stack_order';
                while (usedFields.has(stackOrderField) || dataSource.some((row) => Object.prototype.hasOwnProperty.call(row, stackOrderField))) {
                    stackOrderField += '_';
                }
                stackOrderTransform = [
                    {
                        window: [{ op: 'dense_rank', as: stackOrderField }],
                        sort: order.map(({ field, sort }) => ({ field, order: sort })),
                    },
                ];
                mainLayerEncoding.order = textLayerEncoding.order = { field: stackOrderField, type: 'quantitative', sort: 'ascending' };
            } else if (order.length === 1) {
                mainLayerEncoding.order = textLayerEncoding.order = order[0];
            }
        }

        // Build text mark with dx/dy offsets for non-rect marks
        const textMark: any = { type: 'text' };
        if (markType !== 'rect' && markType !== 'arc') {
            if (encoding.x?.type === 'quantitative') textMark.dx = 2;
            if (encoding.y?.type === 'quantitative') textMark.dy = -5;
        } else if (markType === 'arc') {
            if (encoding.radius) {
                textMark.radiusOffset = 10;
            } else {
                textMark.radius = 90;
                mark.outerRadius = 80;
            }
        } else {
            textMark.color = 'white';
        }

        return {
            config,
            transform,
            encoding: sharedEncoding,
            layer: [
                { mark, encoding: mainLayerEncoding, transform: stackOrderTransform },
                { mark: textMark, encoding: textLayerEncoding, transform: stackOrderTransform },
            ],
        };
    }

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
    theme: 'dark' | 'light',
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

function resolveEncodingScales(scale: IChannelScales, encoding: Record<string, any>, data: readonly IRow[], theme: 'dark' | 'light') {
    const newEncoding = { ...encoding };
    function addScale(c: string, encodingName?: string) {
        encodingName = encodingName ?? c;
        if (scale[c] && newEncoding[encodingName]) {
            newEncoding[encodingName] = { ...newEncoding[encodingName] };
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

    return newEncoding;
}

export function resolveScales(scale: IChannelScales, view: any, data: readonly IRow[], theme: 'dark' | 'light') {
    return {
        ...view,
        encoding: resolveEncodingScales(scale, view.encoding, data, theme),
        ...(view.layer && {
            layer: view.layer.map((layer: any) => ({
                ...layer,
                encoding: resolveEncodingScales(scale, layer.encoding, data, theme),
            })),
        }),
    };
}
