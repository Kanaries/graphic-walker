import { ISemanticType } from 'visual-insights';
import { IStackMode, IViewField } from '../../interfaces';
import { autoMark } from './mark';
import { NULL_FIELD } from './field';
import { channelAggregate } from './aggregate';
import { IEncodeProps, channelEncode } from './encode';
import { channelStack } from './stack'

const BRUSH_SIGNAL_NAME = '__gw_brush__';
const POINT_SIGNAL_NAME = '__gw_point__';
export interface SingleViewProps extends IEncodeProps {
    
    defaultAggregated: boolean;
    stack: IStackMode;
    enableCrossFilter: boolean;
    asCrossFilterTrigger: boolean;
    selectEncoding: 'default' | 'none';
    brushEncoding: 'x' | 'y' | 'default' | 'none';
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
        row,
        column,
        xOffset,
        yOffset,
        defaultAggregated,
        stack,
        geomType,
        selectEncoding,
        brushEncoding,
        enableCrossFilter,
        asCrossFilterTrigger,
        hideLegend = false,
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
    });
    if (defaultAggregated) {
        channelAggregate(encoding, fields);
    }
    channelStack(encoding, stack);
    if (!enableCrossFilter || (brushEncoding === 'none' && selectEncoding === 'none')) {
        return {
            config,
            mark: {
                type: markType,
                opacity: 0.96,
                tooltip: true,
            },
            encoding,
        };
    }
    const mark = {
        type: markType,
        opacity: 0.96,
        tooltip: true,
    };

    if (brushEncoding !== 'none') {
        return {
            config,
            transform: asCrossFilterTrigger ? [] : [{ filter: { param: BRUSH_SIGNAL_NAME } }],
            params: [
                // {
                //   name: BRUSH_SIGNAL_DISPLAY_NAME,
                //   select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
                //   on: '__YOU_CANNOT_MODIFY_THIS_SIGNAL__',
                // },
                {
                    name: BRUSH_SIGNAL_NAME,
                    select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
                },
            ],
            mark,
            encoding,
        };
    }

    return {
        config,
        transform: asCrossFilterTrigger ? [] : [{ filter: { param: POINT_SIGNAL_NAME } }],
        params: [
            {
                name: POINT_SIGNAL_NAME,
                select: { type: 'point' },
            },
        ],
        mark,
        encoding: asCrossFilterTrigger
            ? {
                  ...encoding,
                  color: {
                      condition: {
                          ...encoding.color,
                          param: POINT_SIGNAL_NAME,
                      },
                      value: '#888',
                  },
              }
            : encoding,
    };
}
