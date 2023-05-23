import React, { useEffect, useMemo, useCallback } from 'react';
import { IField, IRow } from '../../interfaces';
import { getMeaAggKey } from '../../utils';
import { interpolateRgbBasis } from 'd3-interpolate';
import { NOMINAL } from 'vega-lite/build/src/type';

interface MetricTableProps {
    matrix: any[][];
    measures: IField[];
    themeConfig: any;
    colorMeaKey?: string;
    opacityMeaKey?: string;
    sizeMeaKey?: string;
}

function minMaxNorm(val, min, max) {
    return (val - min) / (max - min);
}

const MetricTable: React.FC<MetricTableProps> = (props) => {
    const { matrix, measures, themeConfig, colorMeaKey, opacityMeaKey, sizeMeaKey } = props;

    const meaStats = useMemo(() => {
        let meaToBeNormList: string[] = [];
        const newMeaStats = {};
        if (colorMeaKey) meaToBeNormList.push(colorMeaKey);
        if (opacityMeaKey) meaToBeNormList.push(opacityMeaKey);
        if (sizeMeaKey) meaToBeNormList.push(sizeMeaKey);
        meaToBeNormList.forEach((mea) => {
            const values = matrix
                .flatMap((row) =>
                    row.map((item) => {
                        return item !== undefined ? item[mea] : undefined;
                    })
                )
                .filter((val) => val !== undefined);
            const min = Math.min(...values);
            const max = Math.max(...values);
            newMeaStats[mea] = { min, max };
        });
        return newMeaStats;
    }, [matrix, colorMeaKey, opacityMeaKey, sizeMeaKey]);

    const getCellData = useCallback(
        (cell: IRow, measure: IField) => {
            const calculateNormVal = (meaKey) => minMaxNorm(cell[meaKey], meaStats[meaKey].min, meaStats[meaKey].max);
            const meaKey = getMeaAggKey(measure.fid, measure.aggName);
            if (cell[meaKey] === undefined) {
                return '--';
            }
            let colorStyle = {};
            let opacityStyle = {};
            let sizeStyle = {};
            if (colorMeaKey) {
                const colorInterpolator = interpolateRgbBasis(themeConfig.range.ramp);
                let normVal = calculateNormVal(colorMeaKey);
                colorStyle = { color: colorInterpolator(normVal) };
            }
            if (opacityMeaKey) {
                let normVal = calculateNormVal(opacityMeaKey);
                opacityStyle = { opacity: normVal * 0.8 + 0.2 };
            }
            if (sizeMeaKey) {
                let normVal = calculateNormVal(sizeMeaKey);
                sizeStyle = {
                    width: `${normVal * 0.8 + 0.2}rem`,
                    height: `${normVal * 0.8 + 0.2}rem`,
                    background: colorStyle['color'] ? colorStyle['color'] : themeConfig.area.fill,
                    opacity: opacityStyle['opacity'] ? opacityStyle['opacity'] : 1
                };

                return <div style={sizeStyle}></div>;
            }
            return <div style={{ ...colorStyle, ...opacityStyle, ...sizeStyle }}>{cell[meaKey]}</div>;
        },
        [colorMeaKey, opacityMeaKey, sizeMeaKey, meaStats, themeConfig]
    );

    return (
        <tbody className="bg-white border-r border-b border-gray-300">
            {matrix.map((row, rIndex) => {
                return (
                    <tr className="divide-x divide-gray-200" key={rIndex}>
                        {row.flatMap((cell, cIndex) => {
                            cell = cell ?? {};
                            if (measures.length > 0) {
                                return measures.map((mea, meaIdx) => {
                                    return (
                                        <td
                                            className="bg-white dark:bg-zinc-900 whitespace-nowrap p-2 text-xs text-gray-500 dark:text-white"
                                            key={`${rIndex}-${cIndex}-${meaIdx}`}
                                        >
                                            {getCellData(cell, mea)}
                                        </td>
                                    );
                                });
                            } else {
                                return (
                                    <td
                                        className="bg-white dark:bg-zinc-900 whitespace-nowrap p-2 text-xs text-gray-500 dark:text-white"
                                        key={`${rIndex}-${cIndex}`}
                                    >
                                        --
                                    </td>
                                );
                            }
                        })}
                    </tr>
                );
            })}
        </tbody>
    );
};

export default MetricTable;
