import { IChannelScales, IField, IFieldInfos, IRow, ISemanticType, IStackMode, IViewField } from '../../interfaces';
import { autoMark } from './mark';
import { NULL_FIELD } from './field';
import { channelAggregate } from './aggregate';
import { IEncodeProps, channelEncode, encodeFid } from './encode';
import { channelStack } from './stack';
import { addTooltipEncode } from './tooltip';
import { isNotEmpty } from '../../utils';

export interface SingleViewProps extends IEncodeProps {
    defaultAggregated: boolean;
    stack: IStackMode;
    hideLegend?: boolean;
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
        hideLegend = false,
        displayOffset,
    } = props;
    const fields: IViewField[] = [x, y, color, opacity, size, shape, row, column, xOffset, yOffset, theta, radius, text];
    let markType = geomType;
    let config: any = {};
    if (hideLegend) {
        config.legend = {
            disable: true,
        };
    }
    if (geomType === 'auto') {
        const types: ISemanticType[] = [];
        if (x !== NULL_FIELD) types.push(x.semanticType); //types.push(getFieldType(x));
        if (y !== NULL_FIELD) types.push(y.semanticType); //types.push(getFieldType(yField));
        markType = autoMark(types);
    }

    const transform = isNotEmpty(displayOffset)
        ? fields
              .filter((f) => f.semanticType === 'temporal')
              .map((f) => {
                  const fid = encodeFid(f.fid);
                  return {
                      calculate: `datum.${fid} - (${displayOffset * 60000})`,
                      as: fid,
                  };
              })
        : [];

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
    });
    if (defaultAggregated) {
        channelAggregate(encoding, fields);
    }
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
    function addScale(c: string) {
        if (scale[c] && newEncoding[c]) {
            if (typeof scale[c] === 'function') {
                const field = newEncoding[c].field;
                const values = data.map((x) => x[field]);
                newEncoding[c].scale = scale[c]({
                    semanticType: newEncoding[c].type,
                    theme,
                    values,
                });
            } else {
                newEncoding[c].scale = scale[c];
            }
        }
    }
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
