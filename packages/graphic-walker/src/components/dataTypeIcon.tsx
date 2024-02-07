import React from 'react';
import { IMutField } from '../interfaces';
import { DocumentTextIcon, HashtagIcon, CalendarIcon } from '@heroicons/react/24/outline';

const DataTypeIcon: React.FC<{ dataType: IMutField['semanticType']; analyticType: IMutField['analyticType'] }> = (props) => {
    const { dataType, analyticType } = props;
    const color = analyticType === 'dimension' ? 'text-dimension' : 'text-measure';
    const iconClassName = `w-3 inline-block ${color}`;
    switch (dataType) {
        case 'quantitative':
        case 'ordinal':
            return <HashtagIcon className={iconClassName} />;
        case 'temporal':
            return <CalendarIcon className={iconClassName} />;
        default:
            return <DocumentTextIcon className={iconClassName} />;
    }
};

export default DataTypeIcon;
