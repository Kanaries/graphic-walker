import React from 'react';
import { IAutoVizChartType } from '../../lib/autoViz';

/**
 * Hand-drawn 32×32 glyphs for the Auto Viz palette.
 * Everything is painted with currentColor (+ opacity layers) so the icons
 * follow the theme in both light and dark mode.
 */

interface IconProps {
    className?: string;
}

const svgProps = (className?: string) =>
    ({
        viewBox: '0 0 32 32',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
        'aria-hidden': true,
    } as const);

const TableIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <rect x="5" y="7" width="22" height="18" rx="1.5" />
        <line x1="5" y1="13" x2="27" y2="13" />
        <line x1="5" y1="19" x2="27" y2="19" />
        <line x1="13" y1="7" x2="13" y2="25" />
        <line x1="20" y1="7" x2="20" y2="25" />
    </svg>
);

const HighlightTableIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <rect x="5" y="7" width="22" height="18" rx="1.5" />
        <line x1="5" y1="13" x2="27" y2="13" />
        <line x1="5" y1="19" x2="27" y2="19" />
        <line x1="13" y1="7" x2="13" y2="25" />
        <line x1="20" y1="7" x2="20" y2="25" />
        <rect x="13" y="13" width="7" height="6" fill="currentColor" opacity="0.55" stroke="none" />
        <rect x="20" y="7" width="7" height="6" fill="currentColor" opacity="0.3" stroke="none" />
        <rect x="5" y="19" width="8" height="6" fill="currentColor" opacity="0.8" stroke="none" />
    </svg>
);

const HeatmapIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)} stroke="none">
        {[
            [6, 6, 0.2],
            [13.2, 6, 0.5],
            [20.4, 6, 0.9],
            [6, 13.2, 0.55],
            [13.2, 13.2, 0.85],
            [20.4, 13.2, 0.3],
            [6, 20.4, 0.75],
            [13.2, 20.4, 0.25],
            [20.4, 20.4, 0.6],
        ].map(([x, y, o], i) => (
            <rect key={i} x={x} y={y} width="5.8" height="5.8" rx="1" fill="currentColor" opacity={o} />
        ))}
    </svg>
);

const BarIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <rect x="6" y="14" width="5" height="12" rx="0.5" fill="currentColor" stroke="none" />
        <rect x="13.5" y="7" width="5" height="19" rx="0.5" fill="currentColor" stroke="none" />
        <rect x="21" y="17" width="5" height="9" rx="0.5" fill="currentColor" stroke="none" />
        <line x1="4" y1="26.75" x2="28" y2="26.75" opacity="0.4" />
    </svg>
);

const StackedBarIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)} stroke="none">
        <rect x="6" y="17" width="5" height="9" fill="currentColor" />
        <rect x="6" y="11" width="5" height="5.4" fill="currentColor" opacity="0.4" />
        <rect x="13.5" y="14" width="5" height="12" fill="currentColor" />
        <rect x="13.5" y="6.5" width="5" height="6.9" fill="currentColor" opacity="0.4" />
        <rect x="21" y="20" width="5" height="6" fill="currentColor" />
        <rect x="21" y="15.5" width="5" height="3.9" fill="currentColor" opacity="0.4" />
        <line x1="4" y1="26.75" x2="28" y2="26.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
);

const GroupedBarIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)} stroke="none">
        <rect x="6" y="12" width="4.2" height="14" fill="currentColor" />
        <rect x="10.8" y="17" width="4.2" height="9" fill="currentColor" opacity="0.45" />
        <rect x="17.5" y="9" width="4.2" height="17" fill="currentColor" />
        <rect x="22.3" y="14" width="4.2" height="12" fill="currentColor" opacity="0.45" />
        <line x1="4" y1="26.75" x2="28" y2="26.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
);

const LineIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <polyline points="5,22 12,11 19,16 27,7" />
        {[
            [5, 22],
            [12, 11],
            [19, 16],
            [27, 7],
        ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.6" fill="currentColor" stroke="none" />
        ))}
    </svg>
);

const AreaIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <path d="M5,24 L12,12 L19,16.5 L27,7.5 L27,24 Z" fill="currentColor" opacity="0.25" stroke="none" />
        <polyline points="5,24 12,12 19,16.5 27,7.5" />
    </svg>
);

const HistogramIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)} stroke="none">
        {[6, 10, 15, 19, 13, 7].map((h, i) => (
            <rect key={i} x={5 + i * 3.7} y={26 - h} width="3.3" height={h} rx="0.4" fill="currentColor" opacity={0.85} />
        ))}
        <line x1="4" y1="26.75" x2="28" y2="26.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
);

const ScatterIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)} stroke="none">
        {[
            [8, 21, 1],
            [11, 15, 1],
            [14.5, 18, 1],
            [17, 10, 1],
            [20.5, 13.5, 1],
            [24.5, 8, 1],
            [22.5, 18.5, 0.45],
            [9.5, 10.5, 0.45],
            [26, 22, 0.45],
        ].map(([cx, cy, o], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.8" fill="currentColor" opacity={o} />
        ))}
    </svg>
);

const CircleViewIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)} stroke="none">
        {[
            [9, 4],
            [16, 6],
            [23, 3],
        ].flatMap(([cx, n], col) =>
            Array.from({ length: n }, (_, i) => (
                <circle key={`${col}-${i}`} cx={cx} cy={24 - i * 3.4} r="1.6" fill="currentColor" opacity={i === n - 1 ? 1 : 0.45} />
            ))
        )}
        <line x1="4" y1="27.5" x2="28" y2="27.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
);

const PieIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <circle cx="16" cy="16" r="10" />
        <path d="M16,16 L16,6 A10,10 0 0 1 25.4,19.4 Z" fill="currentColor" opacity="0.4" stroke="none" />
        <line x1="16" y1="16" x2="16" y2="6" />
        <line x1="16" y1="16" x2="25.4" y2="19.4" />
    </svg>
);

const BoxplotIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <line x1="12.5" y1="5.5" x2="19.5" y2="5.5" />
        <line x1="16" y1="5.5" x2="16" y2="10" />
        <rect x="9.5" y="10" width="13" height="12" rx="1" />
        <line x1="9.5" y1="15.5" x2="22.5" y2="15.5" strokeWidth="2" />
        <line x1="16" y1="22" x2="16" y2="26.5" />
        <line x1="12.5" y1="26.5" x2="19.5" y2="26.5" />
    </svg>
);

const PoiMapIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <path
            d="M6,20.5 C6.5,15 11,12.5 15.5,13.5 C20,14.5 26,12 26.5,16.5 C27,21 21.5,25.5 15,25 C10,24.6 5.6,24.5 6,20.5 Z"
            fill="currentColor"
            opacity="0.18"
            stroke="none"
        />
        <path d="M12,7 a3.2,3.2 0 1 1 0.01,0 Z M12,10.2 L12,15" fill="currentColor" fillOpacity="0.9" />
        <path d="M21.5,13.5 a2.4,2.4 0 1 1 0.01,0 Z M21.5,15.9 L21.5,19.3" fill="currentColor" fillOpacity="0.5" />
    </svg>
);

const ChoroplethMapIcon: React.FC<IconProps> = ({ className }) => (
    <svg {...svgProps(className)}>
        <path d="M6,19 C6,12 11,8 16,8.5 C22,9 27,12 26.5,17.5 C26,23 20,26 14.5,25 C9.5,24 6,23 6,19 Z" />
        <path d="M6,19 C6,12 11,8 16,8.5 L14.5,25 C9.5,24 6,23 6,19 Z" fill="currentColor" opacity="0.7" stroke="none" />
        <path d="M16,8.5 C22,9 27,12 26.5,17.5 L14.5,25 L16,8.5 Z" fill="currentColor" opacity="0.3" stroke="none" />
    </svg>
);

export const chartIcons: Record<IAutoVizChartType, React.FC<IconProps>> = {
    table: TableIcon,
    highlight_table: HighlightTableIcon,
    heatmap: HeatmapIcon,
    bar: BarIcon,
    stacked_bar: StackedBarIcon,
    grouped_bar: GroupedBarIcon,
    line: LineIcon,
    area: AreaIcon,
    histogram: HistogramIcon,
    scatter: ScatterIcon,
    circle_view: CircleViewIcon,
    pie: PieIcon,
    boxplot: BoxplotIcon,
    poi_map: PoiMapIcon,
    choropleth_map: ChoroplethMapIcon,
};

/** English fallbacks; overridden by the `autoviz.charts.*` i18n keys when present */
export const chartTypeLabels: Record<IAutoVizChartType, string> = {
    table: 'Text Table',
    highlight_table: 'Highlight Table',
    heatmap: 'Heat Map',
    bar: 'Bar Chart',
    stacked_bar: 'Stacked Bar',
    grouped_bar: 'Grouped Bar',
    line: 'Line Chart',
    area: 'Area Chart',
    histogram: 'Histogram',
    scatter: 'Scatter Plot',
    circle_view: 'Circle View',
    pie: 'Pie Chart',
    boxplot: 'Box Plot',
    poi_map: 'Symbol Map',
    choropleth_map: 'Filled Map',
};
