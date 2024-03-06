import {
    DraggableFieldState,
    IStoInfoOld,
    IVisSpec,
    IVisualConfig,
    IVisualConfigNew,
    IVisualLayout,
} from '../interfaces';
import { GLOBAL_CONFIG } from '../config';

export function initEncoding(): DraggableFieldState {
    return {
        dimensions: [],
        measures: [],
        rows: [],
        columns: [],
        color: [],
        opacity: [],
        size: [],
        shape: [],
        radius: [],
        theta: [],
        longitude: [],
        latitude: [],
        geoId: [],
        details: [],
        filters: [],
        text: [],
    };
}

export function initVisualConfig(): IVisualConfig {
    const [geom] = GLOBAL_CONFIG.GEOM_TYPES.generic;
    return {
        defaultAggregated: true,
        geoms: [geom],
        showTableSummary: false,
        coordSystem: 'generic',
        stack: 'stack',
        showActions: false,
        interactiveScale: false,
        sorted: 'none',
        zeroScale: true,
        scaleIncludeUnmatchedChoropleth: false,
        background: undefined,
        size: {
            mode: 'auto',
            width: 320,
            height: 200,
        },
        format: {
            numberFormat: undefined,
            timeFormat: undefined,
            normalizedNumberFormat: undefined,
        },
        geoKey: 'name',
        resolve: {
            x: false,
            y: false,
            color: false,
            opacity: false,
            shape: false,
            size: false,
        },
        limit: -1,
    };
}

export const emptyVisualLayout: IVisualLayout = {
    showActions: false,
    showTableSummary: false,
    stack: 'stack',
    interactiveScale: false,
    zeroScale: true,
    background: undefined,
    size: {
        mode: 'auto',
        width: 320,
        height: 200,
    },
    format: {
        numberFormat: undefined,
        timeFormat: undefined,
        normalizedNumberFormat: undefined,
    },
    geoKey: 'name',
    resolve: {
        x: false,
        y: false,
        color: false,
        opacity: false,
        shape: false,
        size: false,
    },
};

export const emptyVisualConfig: IVisualConfigNew = {
    defaultAggregated: true,
    geoms: [GLOBAL_CONFIG.GEOM_TYPES.generic[0]],
    coordSystem: 'generic',
    limit: -1,
};

export const emptyEncodings: DraggableFieldState = {
    dimensions: [],
    measures: [],
    rows: [],
    columns: [],
    color: [],
    opacity: [],
    size: [],
    shape: [],
    radius: [],
    theta: [],
    longitude: [],
    latitude: [],
    geoId: [],
    details: [],
    filters: [],
    text: [],
};

export function visSpecDecoder(visSpec: IVisSpec): IVisSpec {
    return {
        ...visSpec,
        encodings: {
            ...initEncoding(),
            ...visSpec.encodings,
        },
    } as IVisSpec;
}

export const forwardVisualConfigs = (content: IStoInfoOld['specList'][number]): IVisSpec => {
    return {
        ...content,
        config: {
            ...initVisualConfig(),
            ...content.config,
        },
    };
};

export function download(data: string, filename: string, type: string) {
    var file = new Blob([data], { type: type });
    // @ts-ignore
    if (window.navigator.msSaveOrOpenBlob)
        // IE10+
        // @ts-ignore
        window.navigator.msSaveOrOpenBlob(file, filename);
    else {
        // Others
        var a = document.createElement('a'),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

export function downloadBlob(blob: Blob, filename: string) {
    // @ts-ignore
    if (window.navigator.msSaveOrOpenBlob)
        // IE10+
        // @ts-ignore
        window.navigator.msSaveOrOpenBlob(blob, filename);
    else {
        // Others
        var a = document.createElement('a'),
            url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}
