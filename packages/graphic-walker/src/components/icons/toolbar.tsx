import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string };

/**
 * Toolbar icons drawn on the Heroicons outline grid (24px, 1.5 stroke, round caps)
 * so they can sit next to the Heroicons that the toolbar still uses.
 * A 22% fill of the current color (`tint`) marks the "data" part of a glyph.
 */
function createIcon(children: React.ReactNode) {
    return function ToolbarIcon({ title, titleId, ...props }: IconProps) {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                aria-labelledby={titleId}
                {...props}
            >
                {title ? <title id={titleId}>{title}</title> : null}
                {children}
            </svg>
        );
    };
}

const tint = { fill: 'currentColor', fillOpacity: 0.22 } as const;

/** One stacked column whose lower segment (from `split` down to the baseline) is tinted. */
const stackedColumn = (x: number, top: number, split: number) => (
    <>
        <rect x={x} y={top} width="4.5" height={20.5 - top} rx=".75" />
        <path {...tint} d={`M${x} ${split}h4.5v${20.5 - split}h-4.5z`} />
    </>
);

// ---------- toolbar actions ----------

/** The familiar cube, with a small sigma badge that spells out "aggregate". */
export const AggregationIcon = createIcon(
    <>
        <path d="M2.5 6.5l7-4 7 4-7 4z" />
        <path d="M2.5 6.5v8l7 4v-8M16.5 6.5v4.25M9.5 18.5l2.25-1.29" />
        <path d="M20.75 15.25V13.5h-6.5l3.5 4-3.5 4h6.5v-1.75" />
    </>
);

export const MarkTypeIcon = createIcon(
    <>
        <rect x="3.5" y="10" width="5" height="10.5" rx="1" />
        <circle cx="16.5" cy="7" r="3.5" />
        <path d="M12.5 20.5l8-6.5" />
    </>
);

export const TransposeIcon = createIcon(
    <>
        <rect x="3" y="3.5" width="12" height="5" rx="1" />
        <rect x="15.5" y="9" width="5" height="12" rx="1" />
        <path d="M5.5 12v3.5a4 4 0 0 0 4 4H12" />
        <path d="M3.5 14l2-2 2 2M10 17.5l2 2-2 2" />
    </>
);

export const SortAscendingIcon = createIcon(
    <>
        <path d="M3.5 20.5v-4M8 20.5v-8M12.5 20.5v-12" />
        <path d="M18.5 20.5v-16m-2.75 2.75 2.75-2.75 2.75 2.75" />
    </>
);

export const SortDescendingIcon = createIcon(
    <>
        <path d="M3.5 20.5v-12M8 20.5v-8M12.5 20.5v-4" />
        <path d="M18.5 4.5v16m-2.75-2.75 2.75 2.75 2.75-2.75" />
    </>
);

export const TableSummaryIcon = createIcon(
    <>
        <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
        <path d="M3 9.5h18M9.5 4.5v10" />
        <path {...tint} d="M3 14.5h18V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
    </>
);

export const ComputedFieldIcon = createIcon(
    <>
        <path d="M11 5c-2.2-.9-3.7.1-4 2.2L5.6 17c-.3 2-1.6 2.9-3.4 2.3M4 10.5h6" />
        <path d="M12.5 13l5 6.5M17.5 13l-5 6.5" />
        <path d="M19 3.5v5M16.5 6h5" />
    </>
);

export const AxesZoomIcon = createIcon(
    <>
        <path d="M3.5 3.5v17h17" />
        <circle cx="12.5" cy="10" r="4.25" />
        <path d="M15.6 13.1l3.9 3.9" />
    </>
);

export const LayoutSizeIcon = createIcon(
    <>
        <rect x="3.5" y="8.5" width="12" height="12" rx="1.5" />
        <path d="M3.5 4.5h12m-10-2-2 2 2 2m8-4 2 2-2 2" />
        <path d="M19.5 8.5v12m-2-10 2-2 2 2m-4 8 2 2 2-2" />
    </>
);

export const CoordSystemIcon = createIcon(<path d="M5 3v16h16M3 5l2-2 2 2M19 17l2 2-2 2" />);

export const DebugIcon = createIcon(
    <>
        <path d="M8 11a4 4 0 0 1 8 0v4.5a4 4 0 0 1-8 0z" />
        <path d="M12 11v8.5M9.3 7.9 7.5 5.5M14.7 7.9l1.8-2.4M8 12H4.5M8 16l-3 1.5M16 12h3.5M16 16l3 1.5" />
    </>
);

export const ExportChartIcon = createIcon(
    <>
        <path d="M12 19.5H5.5A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v5" />
        <path d="M4 15.5l4-4 4 4" />
        <circle cx="14.5" cy="8.5" r="1.25" />
        <path d="M18 14v7m-3-3 3 3 3-3" />
    </>
);

export const ExportCsvIcon = createIcon(
    <>
        <path d="M12 19.5H5.5A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v5" />
        <path d="M4 9.5h16M4 14.5h8M10 4.5v15" />
        <path d="M18 14v7m-3-3 3 3 3-3" />
    </>
);

export const RowLimitIcon = createIcon(
    <>
        <path d="M4 5h16M4 9.5h16" />
        <path strokeDasharray="2 2.5" d="M2.5 14h19" />
        <path opacity={0.35} d="M4 18.5h16" />
    </>
);

// ---------- mark types ----------

export const MarkAutoIcon = createIcon(
    <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" strokeDasharray="2.5 2.5" />
        <path d="M8.5 16.5 12 7.5l3.5 9M9.8 13.5h4.4" />
    </>
);

export const MarkBarIcon = createIcon(
    <>
        <rect x="4" y="12" width="4" height="8.5" rx=".75" />
        <rect x="10" y="4" width="4" height="16.5" rx=".75" />
        <rect x="16" y="8.5" width="4" height="12" rx=".75" />
    </>
);

export const MarkLineIcon = createIcon(<path d="M3 17.5l5.5-7 4.5 3.5L20.5 5" />);

export const MarkAreaIcon = createIcon(<path {...tint} d="M3 20.5v-6l5.5-5 4.5 3.5L21 5v15.5z" />);

export const MarkTrailIcon = createIcon(<path {...tint} d="M3 16.5 9 10.5l5 2.5 7-9v6l-7 7.5-5-4.5z" />);

export const MarkPointIcon = createIcon(
    <>
        <path d="M3.5 3.5v17h17" />
        <circle cx="8" cy="15.5" r="1.5" />
        <circle cx="11.5" cy="10" r="1.5" />
        <circle cx="15.5" cy="13" r="1.5" />
        <circle cx="18.5" cy="6.5" r="1.5" />
    </>
);

export const MarkCircleIcon = createIcon(
    <>
        <circle {...tint} cx="8.5" cy="14.5" r="4.5" />
        <circle {...tint} cx="17" cy="7.5" r="3" />
        <circle {...tint} cx="18" cy="17.5" r="1.75" />
    </>
);

export const MarkTickIcon = createIcon(<path d="M4 7v10M7.5 7v10M10 7v10M15 7v10M20 7v10" />);

export const MarkRectIcon = createIcon(
    <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
        <path d="M3.5 9.17h17M3.5 14.83h17M9.17 3.5v17M14.83 3.5v17" />
        <path fill="currentColor" stroke="none" opacity={0.3} d="M9.17 3.5h5.66v5.67H9.17zM14.83 9.17H20.5v5.66h-5.67zM3.5 14.83h5.67V20.5H3.5z" />
    </>
);

export const MarkArcIcon = createIcon(
    <>
        <path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
        <path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
    </>
);

export const MarkTextIcon = createIcon(<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6" />);

export const MarkBoxplotIcon = createIcon(
    <>
        <path d="M12 3v4M12 17v4M9 3h6M9 21h6M7 12.5h10" />
        <rect x="7" y="7" width="10" height="10" rx="1" />
    </>
);

export const MarkTableIcon = createIcon(
    <>
        <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
        <path d="M3 9.5h18M3 14.5h18M9.5 4.5v15" />
    </>
);

export const MarkChoroplethIcon = createIcon(
    <>
        <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20z" />
        <path {...tint} d="M9 4l6 2.5V20l-6-2.5z" />
    </>
);

// ---------- stack modes ----------

export const StackNoneIcon = createIcon(
    <>
        <rect {...tint} x="4" y="7" width="9" height="13.5" rx="1" />
        <rect x="11" y="12" width="9" height="8.5" rx="1" />
    </>
);

export const StackIcon = createIcon(
    <>
        {stackedColumn(3.25, 11, 16)}
        {stackedColumn(9.75, 4, 13)}
        {stackedColumn(16.25, 8, 15)}
    </>
);

export const StackNormalizeIcon = createIcon(
    <>
        {stackedColumn(3.25, 3.5, 14)}
        {stackedColumn(9.75, 3.5, 9)}
        {stackedColumn(16.25, 3.5, 12)}
    </>
);

export const StackCenterIcon = createIcon(
    <>
        <rect x="3.25" y="7" width="4.5" height="10" rx=".75" />
        <path {...tint} d="M3.25 12h4.5v5h-4.5z" />
        <rect x="9.75" y="3.5" width="4.5" height="17" rx=".75" />
        <path {...tint} d="M9.75 12h4.5v8.5h-4.5z" />
        <rect x="16.25" y="6" width="4.5" height="12" rx=".75" />
        <path {...tint} d="M16.25 12h4.5v6h-4.5z" />
    </>
);

// ---------- layout modes ----------

export const LayoutFixedIcon = createIcon(
    <>
        <rect x="7.5" y="7.5" width="13" height="13" rx="1.5" />
        <path d="M3.5 7.5v13M3.5 10.75H5M3.5 14H5M3.5 17.25H5M7.5 3.5h13M10.75 3.5V5M14 3.5V5M17.25 3.5V5" />
    </>
);

export const LayoutAutoIcon = createIcon(
    <>
        <rect x="8" y="7" width="8" height="10" rx="1.5" />
        <path d="M2 12h3.5m-2-2 2 2-2 2M22 12h-3.5m2-2-2 2 2 2" />
    </>
);

export const LayoutFullIcon = createIcon(
    <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M13.5 10.5l4-4m-3 0h3v3M10.5 13.5l-4 4m0-3v3h3" />
    </>
);

// ---------- coordinate systems ----------

export const CoordGenericIcon = createIcon(
    <>
        <path d="M5 3v16h16M3 5l2-2 2 2M19 17l2 2-2 2" />
        <circle cx="14" cy="9.5" r="1.5" />
        <path strokeDasharray="1.5 2" d="M14 12.5V19M5 9.5h6" />
    </>
);
