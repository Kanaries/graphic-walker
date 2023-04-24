import { ISemanticType, IStackMode, IViewField } from '../../interfaces';
import { autoMark } from './mark';
import { NULL_FIELD } from './field';
import { channelAggregate } from './aggregate';
import { IEncodeProps, channelEncode } from './encode';
import { channelStack } from './stack';
import { addTooltipEncode } from './tooltip';
import { setupZeroBaseline } from './interaction';

export interface SingleViewProps extends IEncodeProps {
    defaultAggregated: boolean;
    stack: IStackMode;
    hideLegend?: boolean;
    zeroBaseline: Record<'x' | 'y', boolean>;
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
        row,
        column,
        xOffset,
        yOffset,
        details,
        defaultAggregated,
        stack,
        geomType,
        hideLegend = false,
        zeroBaseline,
    } = props;
    const fields: IViewField[] = [x, y, color, opacity, size, shape, row, column, xOffset, yOffset, theta, radius];
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
        details
    });
    addTooltipEncode(encoding, details)
    setupZeroBaseline(encoding, zeroBaseline);
    if (defaultAggregated) {
        channelAggregate(encoding, fields);
    }
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
