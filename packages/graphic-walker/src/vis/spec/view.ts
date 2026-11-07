import { IChannelScales, IField, IFieldInfos, IRow, ISemanticType, IStackMode, IViewField } from '../../interfaces';
import { autoMark } from './mark';
import { NULL_FIELD } from './field';
import { channelAggregate } from './aggregate';
import { IEncodeProps, availableChannels, channelEncode } from './encode';
import { channelStack } from './stack';
import { addTooltipEncode } from './tooltip';
import { prepareTemporalColumns } from '../../lib/temporalDisplay';
import { addBinStep } from './bin';
import { viewEncodingKeys } from '../../models/visSpec';

export interface SingleViewProps extends IEncodeProps {
    defaultAggregated: boolean;
    stack: IStackMode;
    hasLegend?: boolean;
    hideLegend?: boolean;
    dataSource: readonly IRow[];
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

    // A chart can retain encodings from an earlier mark. Prepare only fields that
    // this mark consumes and its query requested; absent inactive columns are valid.
    const queriedChannels = new Set<string>(viewEncodingKeys(geomType));
    const consumedChannels = availableChannels(markType);
    const channelFields = { x, y, color, opacity, size, shape, row, column, xOffset, yOffset, theta, radius, text };
    const queryChannel = (channel: string) =>
        ['x', 'column', 'xOffset'].includes(channel) ? 'columns' : ['y', 'row', 'yOffset'].includes(channel) ? 'rows' : channel;
    const activeDetails = queriedChannels.has('details') ? details : [];
    const sourceFields = [
        ...Object.entries(channelFields)
            .filter(([channel]) => consumedChannels.has(channel) && queriedChannels.has(queryChannel(channel)))
            .map(([, field]) => field),
        ...activeDetails,
    ];
    const prepared = prepareTemporalColumns({ dataSource, fields: sourceFields, displayOffset });
    const displayFields = new Map(sourceFields.map((field, index) => [field, prepared.fields[index]]));
    const display = (field: IViewField) => displayFields.get(field) ?? field;
    const displayDetails = activeDetails.map(display);

    let encoding = channelEncode({
        geomType: markType,
        x: display(x),
        y: display(y),
        color: display(color),
        opacity: display(opacity),
        size: display(size),
        shape: display(shape),
        row: display(row),
        column: display(column),
        xOffset: display(xOffset),
        yOffset: display(yOffset),
        theta: display(theta),
        radius: display(radius),
        details: displayDetails,
        text: display(text),
        displayOffset,
        vegaConfig,
    });
    if (defaultAggregated) {
        channelAggregate(encoding, fields);
    }
    addBinStep(encoding, dataSource);
    addTooltipEncode(encoding, displayDetails, defaultAggregated);
    channelStack(encoding, stack);
    const mark = {
        type: markType,
        opacity: 0.96,
        tooltip: { content: 'data' },
    };
    return {
        config,
        transform: [],
        mark,
        encoding,
        dataSource: prepared.dataSource,
        rawFieldsByDisplay: prepared.rawFieldsByDisplay,
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

export function resolveScales(
    scale: IChannelScales,
    view: any,
    data: readonly IRow[],
    theme: 'dark' | 'light',
    rawFieldsByDisplay?: ReadonlyMap<string, string>,
) {
    const newEncoding = { ...view.encoding };
    function addScale(c: string, encodingName?: string) {
        encodingName = encodingName ?? c;
        if (scale[c] && newEncoding[encodingName]) {
            if (typeof scale[c] === 'function') {
                const encodedField = newEncoding[encodingName].field;
                const field = rawFieldsByDisplay?.get(encodedField) ?? encodedField;
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
