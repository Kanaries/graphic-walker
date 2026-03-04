import React, { memo, useMemo } from 'react';
import type { DeepReadonly, IViewField, VegaGlobalConfig } from '../../interfaces';
import { useDisplayValueFormatter } from './utils';
import { isSameField } from '@/utils';

export interface ITooltipContentProps {
    vegaConfig: VegaGlobalConfig;
    field: DeepReadonly<IViewField>;
    value: unknown;
}

export const TooltipContent = memo<ITooltipContentProps>(function TooltipContent({ vegaConfig, field, value }) {
    const { analyticType, aggName, name } = field;
    const fieldDisplayLabel = useMemo(() => {
        return analyticType === 'measure' && aggName ? `${aggName}(${name})` : name;
    }, [analyticType, aggName]);
    const formatter = useDisplayValueFormatter(field.semanticType, vegaConfig);

    return (
        <p>
            {fieldDisplayLabel}: {formatter(value)}
        </p>
    );
});
