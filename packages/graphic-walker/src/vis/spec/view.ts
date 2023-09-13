import { IChannelScales, ISemanticType, IStackMode, IViewField } from '../../interfaces';
import { autoMark } from './mark';
import { NULL_FIELD } from './field';
import { channelAggregate } from './aggregate';
import { IEncodeProps, channelEncode } from './encode';
import { channelStack } from './stack';
import { addTooltipEncode } from './tooltip';

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
        text
    });
    if (defaultAggregated) {
        channelAggregate(encoding, fields);
    }
    addTooltipEncode(encoding, details, defaultAggregated);
    channelStack(encoding, stack);
    const mark = {
        type: markType,
        opacity: 0.96,
        tooltip: { content: 'data' }
    };
    return {
        config,
        mark,
        encoding,
    };
}

export function resolveScales(scale: IChannelScales, view: any, data: readonly any[], theme: 'dark' | 'light') {
    const newEncoding = {...view.encoding};
    function addScale(c: string) {
        if (scale[c] && newEncoding[c]) {
            if (typeof scale[c] === 'function') {
                const field = newEncoding[c].field;
                const values = data.map(x => x[field]);
                newEncoding[c].scale = scale[c]({
                    semanticType: newEncoding[c].type,
                    theme,
                    values,
                })
            } else {
                newEncoding[c].scale = scale[c];
            }

        }
    }
    addScale('color');
    addScale('opacity');
    addScale('size');
    console.log(newEncoding)
    return {
        ...view,
        encoding: newEncoding
    };
}