import { GLOBAL_CONFIG } from '../config';
import { IChannelScales, IRow, IStackMode, IViewField, VegaGlobalConfig } from '../interfaces';
import { NULL_FIELD } from '../vis/spec/field';
import { getSingleView, resolveScales } from '../vis/spec/view';

export function toVegaSpec({
    rows,
    columns,
    color,
    opacity,
    size,
    details = [],
    radius,
    shape,
    text,
    theta,
    interactiveScale,
    dataSource,
    layoutMode,
    width,
    height,
    defaultAggregated,
    geomType,
    stack,
    channelScales,
    mediaTheme,
    vegaConfig,
}: {
    rows: readonly IViewField[];
    columns: readonly IViewField[];
    color?: IViewField;
    opacity?: IViewField;
    size?: IViewField;
    shape?: IViewField;
    theta?: IViewField;
    radius?: IViewField;
    text?: IViewField;
    details?: Readonly<IViewField[]>;
    interactiveScale: boolean;
    dataSource: readonly IRow[];
    layoutMode: string;
    width: number;
    height: number;
    defaultAggregated: boolean;
    stack: IStackMode;
    geomType: string;
    channelScales?: IChannelScales;
    mediaTheme: 'dark' | 'light';
    vegaConfig: VegaGlobalConfig;
}) {
    const yField = rows.length > 0 ? rows[rows.length - 1] : NULL_FIELD;
    const xField = columns.length > 0 ? columns[columns.length - 1] : NULL_FIELD;
    const rowDims = rows.filter((f) => f.analyticType === 'dimension');
    const colDims = columns.filter((f) => f.analyticType === 'dimension');
    const rowMeas = rows.filter((f) => f.analyticType === 'measure');
    const colMeas = columns.filter((f) => f.analyticType === 'measure');
    const rowRepeatFields = rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas;
    const colRepeatFields = colMeas.length === 0 ? colDims.slice(-1) : colMeas;

    const rowLeftFacetFields = rows.slice(0, -1).filter((f) => f.analyticType === 'dimension');
    const colLeftFacetFields = columns.slice(0, -1).filter((f) => f.analyticType === 'dimension');

    const rowFacetField = rowLeftFacetFields.length > 0 ? rowLeftFacetFields[rowLeftFacetFields.length - 1] : NULL_FIELD;
    const colFacetField = colLeftFacetFields.length > 0 ? colLeftFacetFields[colLeftFacetFields.length - 1] : NULL_FIELD;
    const allFieldIds = [...rows, ...columns, color, opacity, size].filter((f) => Boolean(f)).map((f) => (f as IViewField).fid);

    const spec: any = {
        data: {
            values: dataSource,
        },
        params: [
            {
                name: 'geom',
                select: {
                    type: 'point',
                    fields: allFieldIds,
                },
            },
        ],
    };
    if (interactiveScale) {
        spec.params.push({
            name: 'grid',
            select: 'interval',
            bind: 'scales',
        });
    }
    if (rowRepeatFields.length <= 1 && colRepeatFields.length <= 1) {
        if (layoutMode === 'fixed') {
            if (rowFacetField === NULL_FIELD && colFacetField === NULL_FIELD) {
                spec.autosize = 'fit';
            }
            spec.width = width;
            spec.height = height;
        }
        const v = getSingleView({
            x: xField,
            y: yField,
            color: color ? color : NULL_FIELD,
            opacity: opacity ? opacity : NULL_FIELD,
            size: size ? size : NULL_FIELD,
            shape: shape ? shape : NULL_FIELD,
            theta: theta ? theta : NULL_FIELD,
            radius: radius ? radius : NULL_FIELD,
            text: text ? text : NULL_FIELD,
            row: rowFacetField,
            column: colFacetField,
            xOffset: NULL_FIELD,
            yOffset: NULL_FIELD,
            details,
            defaultAggregated,
            stack,
            geomType,
        });
        const singleView = channelScales ? resolveScales(channelScales, v, dataSource, mediaTheme) : v;

        spec.mark = singleView.mark;
        if ('encoding' in singleView) {
            spec.encoding = singleView.encoding;
        }

        spec.resolve ||= {};
        // @ts-ignore
        let resolve = vegaConfig.resolve;
        for (let v in resolve) {
            let value = resolve[v] ? 'independent' : 'shared';
            spec.resolve.scale = { ...spec.resolve.scale, [v]: value };
            if ((GLOBAL_CONFIG.POSITION_CHANNEL_CONFIG_LIST as string[]).includes(v)) {
                spec.resolve.axis = { ...spec.resolve.axis, [v]: value };
            } else if ((GLOBAL_CONFIG.NON_POSITION_CHANNEL_CONFIG_LIST as string[]).includes(v)) {
                spec.resolve.legend = { ...spec.resolve.legend, [v]: value };
            }
        }
        return [spec];
    } else {
        if (layoutMode === 'fixed') {
            spec.width = Math.floor(width / colRepeatFields.length) - 5;
            spec.height = Math.floor(height / rowRepeatFields.length) - 5;
            spec.autosize = 'fit';
        }
        let index = 0;
        let result = new Array(rowRepeatFields.length * colRepeatFields.length);
        for (let i = 0; i < rowRepeatFields.length; i++) {
            for (let j = 0; j < colRepeatFields.length; j++, index++) {
                const hasLegend = i === 0 && j === colRepeatFields.length - 1;
                const v = getSingleView({
                    x: colRepeatFields[j] || NULL_FIELD,
                    y: rowRepeatFields[i] || NULL_FIELD,
                    color: color ? color : NULL_FIELD,
                    opacity: opacity ? opacity : NULL_FIELD,
                    size: size ? size : NULL_FIELD,
                    shape: shape ? shape : NULL_FIELD,
                    theta: theta ? theta : NULL_FIELD,
                    radius: radius ? radius : NULL_FIELD,
                    row: rowFacetField,
                    column: colFacetField,
                    text: text ? text : NULL_FIELD,
                    xOffset: NULL_FIELD,
                    yOffset: NULL_FIELD,
                    details,
                    defaultAggregated,
                    stack,
                    geomType,
                    hideLegend: !hasLegend,
                });
                const singleView = channelScales ? resolveScales(channelScales, v, dataSource, mediaTheme) : v;
                let commonSpec = { ...spec };

                const ans = { ...commonSpec, ...singleView };
                if ('params' in commonSpec) {
                    ans.params = commonSpec.params;
                }
                result[index] = ans;
            }
        }
        return result;
    }
}
