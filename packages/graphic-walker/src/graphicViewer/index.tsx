import React from "react";
import { IGWDataLoader } from "../dataLoader";
import StandaloneRenderer from "./standaloneRenderer";
import { IDarkMode, IDataQueryPayload, IThemeKey, IVisSpec } from "../interfaces";
import KanariesServerDataLoader from "../dataLoader/kanariesServerDataLoader";

export interface GraphicViewerProps {
    datasetId: IDataQueryPayload['datasetId'];
    datasetName?: string;
    visSpec: IVisSpec;
    dataLoader: IGWDataLoader;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}

const GraphicViewer: React.FC<GraphicViewerProps> = (props) => {
    const {
        datasetId,
        datasetName,
        dataLoader,
        visSpec,
        themeKey = 'vega',
        dark = 'media',
    } = props;
    return (
        <StandaloneRenderer
            datasetId={datasetId}
            datasetName=""
            visSpec={visSpec}
            dataLoader={dataLoader}
            themeKey={themeKey}
            dark={dark}
        />
    )
};
export default GraphicViewer;