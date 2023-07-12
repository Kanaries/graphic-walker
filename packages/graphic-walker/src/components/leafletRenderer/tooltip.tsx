import React, { memo, useMemo } from "react";
import type { DeepReadonly, IViewField, VegaGlobalConfig } from "../../interfaces";
import { useDisplayValueFormatter } from "./utils";


export interface ITooltipContentProps {
    allFields: readonly DeepReadonly<IViewField>[];
    vegaConfig: VegaGlobalConfig;
    field: DeepReadonly<IViewField>;
    value: unknown;
}

export const TooltipContent = memo<ITooltipContentProps>(function TooltipContent ({ allFields, vegaConfig, field, value }) {
    const { fid, analyticType, aggName } = field;
    const fieldDisplayLabel = useMemo(() => {
        const name = allFields.find(f => f.fid === fid)?.name ?? fid;
        return analyticType === 'measure' && aggName ? `${aggName}(${name})` : name;
    }, [allFields, fid, analyticType, aggName]);
    const formatter = useDisplayValueFormatter(field.semanticType, vegaConfig);
    
    return (
        <p>{fieldDisplayLabel}: {formatter(value)}</p>
    );
});
