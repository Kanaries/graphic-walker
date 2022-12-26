import {
    BarsArrowDownIcon,
    BarsArrowUpIcon,
    PhotoIcon,
    AdjustmentsHorizontalIcon,
    FunnelIcon,
    ChevronUpDownIcon,
    BellIcon,
    ArrowsUpDownIcon,
    BackwardIcon,
    ArrowsPointingOutIcon,
    RectangleGroupIcon,
    PlayIcon,
    BugAntIcon,
    CircleStackIcon,
} from "@heroicons/react/24/outline";
import { observer } from "mobx-react-lite";
import React from "react";
import styled from "styled-components";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import SizeSetting from "../components/sizeSetting";
import { GEMO_TYPES, STACK_MODE, CHART_LAYOUT_TYPE } from "../config";
import { useGlobalStore } from "../store";
import { IStackMode, EXPLORATION_TYPES, IBrushDirection, BRUSH_DIRECTIONS } from "../interfaces";
import { IReactVegaHandler } from "../vis/react-vega";
import Toolbar from "../components/toolbar";

export const LiteContainer = styled.div`
    margin: 0.2em;
    border: 1px solid #d9d9d9;
    padding: 1em;
    background-color: #fff;
    .menu-root {
        position: relative;
        & > *:not(.trigger) {
            display: flex;
            flex-direction: column;
            position: absolute;
            right: 0;
            top: 100%;
            border: 1px solid #8884;
        }
        &:not(:hover) > *:not(.trigger):not(:hover) {
            display: none;
        }
    }
`;

interface IVisualSettings {
    rendererHandler?: React.RefObject<IReactVegaHandler>;
}

const VisualSettings: React.FC<IVisualSettings> = ({ rendererHandler }) => {
    const { vizStore } = useGlobalStore();
    const { visualConfig, sortCondition } = vizStore;
    const { t: tGlobal } = useTranslation();
    const { t } = useTranslation("translation", { keyPrefix: "main.tabpanel.settings" });

    return (
        <Toolbar
            iconList={[
                {
                    key: "aggregation",
                    iconName: () => <AdjustmentsHorizontalIcon />,
                    jsx: () => (
                        <div className="item">
                            <input
                                className="cursor-pointer"
                                type="checkbox"
                                id="toggle:aggregation"
                                aria-describedby="toggle:aggregation:label"
                                checked={visualConfig.defaultAggregated}
                                onChange={(e) => {
                                    console.log(e.target.checked);
                                    vizStore.setVisualConfig("defaultAggregated", e.target.checked);
                                }}
                            />
                            <label
                                className="text-xs text-color-gray-700 ml-2 cursor-pointer"
                                id="toggle:aggregation:label"
                                htmlFor="toggle:aggregation"
                            >
                                {t("toggle.aggregation")}
                            </label>
                        </div>
                    ),
                },
                {
                    key: "geoms",
                    iconName: () => <FunnelIcon />,
                    jsx: () => (
                        <div className="item flex">
                            {/* <label className="px-2" id="dropdown:mark_type:label" htmlFor="dropdown:mark_type">
                                {tGlobal("constant.mark_type.__enum__")}
                            </label> */}
                            {GEMO_TYPES.map((g) => (
                                <span
                                    key={g}
                                    className={`${
                                        visualConfig.geoms[0] === g ? "text-blue-200" : ""
                                    } cursor-pointer mx-2`}
                                    onClick={() => {
                                        vizStore.setVisualConfig("geoms", [g]);
                                    }}
                                >
                                    {tGlobal(`constant.mark_type.${g}`)}
                                </span>
                            ))}
                        </div>
                    ),
                },
                {
                    key: "stack_mode",
                    iconName: () => <CircleStackIcon />,
                    jsx: () => (
                        <div className="item">
                            {/* <label className="px-2" id="dropdown:stack:label" htmlFor="dropdown:stack">
                                {tGlobal("constant.stack_mode.__enum__")}
                            </label> */}
                            {STACK_MODE.map((g) => (
                                <span
                                    key={g}
                                    className={`${visualConfig.stack === g ? "text-blue-200" : ""} cursor-pointer mx-2`}
                                    onClick={() => {
                                        vizStore.setVisualConfig("stack", g as IStackMode);
                                    }}
                                >
                                    {tGlobal(`constant.stack_mode.${g}`)}
                                </span>
                            ))}
                        </div>
                    ),
                },
                {
                    key: "axes_resize",
                    iconName: () => <ChevronUpDownIcon />,
                    jsx: () => (
                        <div className="item">
                            <input
                                type="checkbox"
                                className="cursor-pointer"
                                id="toggle:axes_resize"
                                aria-describedby="toggle:axes_resize:label"
                                checked={visualConfig.interactiveScale}
                                onChange={(e) => {
                                    vizStore.setVisualConfig("interactiveScale", e.target.checked);
                                }}
                            />
                            <label
                                className="text-xs text-color-gray-700 ml-2 cursor-pointer"
                                id="toggle:axes_resize:label"
                                htmlFor="toggle:axes_resize"
                            >
                                {t("toggle.axes_resize")}
                            </label>
                        </div>
                    ),
                },
                {
                    key: "sort",
                    iconName: () => <ArrowsUpDownIcon />,
                    jsx: () => (
                        <div className="item">
                            <label className="text-xs text-color-gray-700 mx-2">{t("sort")}</label>
                            <BarsArrowUpIcon
                                className={`w-4 inline-block mr-1 ${
                                    !sortCondition ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"
                                }`}
                                onClick={() => {
                                    vizStore.applyDefaultSort("ascending");
                                }}
                                role="button"
                                tabIndex={!sortCondition ? undefined : 0}
                                aria-disabled={!sortCondition}
                                xlinkTitle={t("button.ascending")}
                                aria-label={t("button.ascending")}
                            />
                            <BarsArrowDownIcon
                                className={`w-4 inline-block mr-1 ${
                                    !sortCondition ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"
                                }`}
                                onClick={() => {
                                    vizStore.applyDefaultSort("descending");
                                }}
                                role="button"
                                tabIndex={!sortCondition ? undefined : 0}
                                aria-disabled={!sortCondition}
                                xlinkTitle={t("button.descending")}
                                aria-label={t("button.descending")}
                            />
                        </div>
                    ),
                },
                {
                    key: "transpose",
                    iconName: () => <BellIcon />,
                    jsx: () => (
                        <div className="item">
                            <label
                                className="text-xs text-color-gray-700 mr-2"
                                htmlFor="button:transpose"
                                id="button:transpose:label"
                            >
                                {t("button.transpose")}
                            </label>
                            <ArrowPathIcon
                                className="w-4 inline-block mr-1 cursor-pointer"
                                role="button"
                                tabIndex={0}
                                id="button:transpose"
                                aria-describedby="button:transpose:label"
                                xlinkTitle={t("button.transpose")}
                                aria-label={t("button.transpose")}
                                onClick={() => {
                                    vizStore.transpose();
                                }}
                            />
                        </div>
                    ),
                },
                {
                    key: "layout_type",
                    iconName: () => <BackwardIcon />,
                    jsx: () => (
                        <div className="item">
                            <label id="dropdown:layout_type:label" htmlFor="dropdown:layout_type">
                                {tGlobal(`constant.layout_type.__enum__`)}
                            </label>
                            {CHART_LAYOUT_TYPE.map((g) => (
                                <span
                                    key={g}
                                    className={`${
                                        visualConfig.size.mode === g ? "text-blue-200" : ""
                                    } cursor-pointer mx-2`}
                                    onClick={() => {
                                        vizStore.setChartLayout({
                                            mode: g as any,
                                        });
                                    }}
                                >
                                    {tGlobal(`constant.layout_type.${g}`)}
                                </span>
                            ))}
                        </div>
                    ),
                },
                {
                    key: "size",
                    iconName: () => <ArrowsPointingOutIcon />,
                    jsx: () => (
                        <div className="item flex items-center hover:bg-yellow-100">
                            <SizeSetting
                                width={visualConfig.size.width}
                                height={visualConfig.size.height}
                                onHeightChange={(v) => {
                                    vizStore.setChartLayout({
                                        mode: "fixed",
                                        height: v,
                                    });
                                }}
                                onWidthChange={(v) => {
                                    vizStore.setChartLayout({
                                        mode: "fixed",
                                        width: v,
                                    });
                                }}
                            />
                            <label
                                className="text-xs text-color-gray-700 ml-2"
                                htmlFor="button:size_setting"
                                id="button:size_setting:label"
                            >
                                {t("size")}
                            </label>
                        </div>
                    ),
                },
                {
                    key: "exploration",
                    iconName: () => <RectangleGroupIcon />,
                    jsx: () => (
                        <div className="item">
                            <label id="dropdown:exploration_mode:label" htmlFor="dropdown:exploration_mode">
                                {tGlobal(`constant.exploration_mode.__enum__`)}
                            </label>
                            {EXPLORATION_TYPES.map((g) => (
                                <span
                                    key={g}
                                    className={`${
                                        visualConfig.exploration.mode === g ? "text-blue-200" : ""
                                    } cursor-pointer mx-2`}
                                    onClick={() => {
                                        vizStore.setExploration({
                                            mode: g as typeof EXPLORATION_TYPES[number],
                                        });
                                    }}
                                >
                                    {tGlobal(`constant.exploration_mode.${g}`)}
                                </span>
                            ))}
                        </div>
                    ),
                },
                {
                    key: "brush_mode",
                    iconName: () => <PlayIcon />,
                    jsx: () => (
                        <div
                            className="item"
                            style={{ opacity: visualConfig.exploration.mode !== "brush" ? 0.3 : undefined }}
                        >
                            <label id="dropdown:brush_mode:label" htmlFor="dropdown:brush_mode">
                                {tGlobal(`constant.brush_mode.__enum__`)}
                            </label>
                            {BRUSH_DIRECTIONS.map((g) => (
                                <span
                                    key={g}
                                    className={`${
                                        visualConfig.exploration.brushDirection === g ? "text-blue-200" : ""
                                    } cursor-pointer mx-2 ${
                                        visualConfig.exploration.mode !== "brush" ? "cursor-not-allowed" : ""
                                    }`}
                                    onClick={() => {
                                        if (visualConfig.exploration.mode !== "brush") return;
                                        vizStore.setExploration({
                                            brushDirection: g as IBrushDirection,
                                        });
                                    }}
                                >
                                    {tGlobal(`constant.brush_mode.${g}`)}
                                </span>
                            ))}
                        </div>
                    ),
                },
                {
                    key: "debug",
                    iconName: () => <BugAntIcon />,
                    jsx: () => (
                        <div className="item">
                            <input
                                type="checkbox"
                                checked={visualConfig.showActions}
                                id="toggle:debug"
                                aria-describedby="toggle:debug:label"
                                className="cursor-pointer"
                                onChange={(e) => {
                                    vizStore.setVisualConfig("showActions", e.target.checked);
                                }}
                            />
                            <label
                                className="text-xs text-color-gray-700 ml-2 cursor-pointer"
                                id="toggle:debug:label"
                                htmlFor="toggle:debug"
                            >
                                {t("toggle.debug")}
                            </label>
                        </div>
                    ),
                },
                {
                    key: "button",
                    iconName: () => <PhotoIcon />,
                    jsx: () => (
                        <div className="item">
                            <div className="menu-root flex">
                                <button
                                    className="text-xs pt-1 pb-1 pl-6 pr-6 bg-white hover:bg-gray-200"
                                    aria-label={t("button.export_chart_as", { type: "png" })}
                                    onClick={() => rendererHandler?.current?.downloadPNG()}
                                >
                                    {t("button.export_chart_as", { type: "png" })}
                                </button>
                                <button
                                    className="text-xs pt-1 pb-1 pl-6 pr-6 bg-white hover:bg-gray-200"
                                    aria-label={t("button.export_chart_as", { type: "svg" })}
                                    onClick={() => rendererHandler?.current?.downloadSVG()}
                                >
                                    {t("button.export_chart_as", { type: "svg" })}
                                </button>
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
};

export default observer(VisualSettings);
