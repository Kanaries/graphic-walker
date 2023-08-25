import { ArrowsPointingOutIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDebounceValueBind } from "../hooks";

interface SizeSettingProps {
    onWidthChange: (val: number) => void;
    onHeightChange: (val: number) => void;
    width: number;
    height: number;
}

export const ResizeDialog: React.FC<SizeSettingProps> = (props) => {
    const { onWidthChange, onHeightChange, width, height, children } = props;
    const { t } = useTranslation("translation", { keyPrefix: "main.tabpanel.settings.size_setting" });
    const [innerWidth, setInnerWidth] = useDebounceValueBind(width, onWidthChange);
    const [innerHeight, setInnerHeight] = useDebounceValueBind(height, onHeightChange);
    return (
        <div className="text-zinc-400">
            {children}
            <div className="mt-4 w-60">
                <input
                    className="w-full h-2 bg-blue-100 appearance-none"
                    style={{ cursor: "ew-resize" }}
                    type="range"
                    name="width"
                    value={Math.sqrt(innerWidth / 1000)}
                    min="0"
                    max="1"
                    step="0.01"
                    onChange={(e) => {
                        setInnerWidth(Math.round(Number(e.target.value) ** 2 * 1000));
                    }}
                />
                <output className="text-sm ml-1" htmlFor="width">
                    {`${t("width")}: ${innerWidth}`}
                </output>
            </div>
            <div className=" mt-2">
                <input
                    className="w-full h-2 bg-blue-100 appearance-none"
                    style={{ cursor: "ew-resize" }}
                    type="range"
                    name="height"
                    value={Math.sqrt(innerHeight / 1000)}
                    min="0"
                    max="1"
                    step="0.01"
                    onChange={(e) => {
                        setInnerHeight(Math.round(Number(e.target.value) ** 2 * 1000));
                    }}
                />
                <output className="text-sm ml-1" htmlFor="height">
                    {`${t("height")}: ${innerHeight}`}
                </output>
            </div>
        </div>
    );
};

const SizeSetting: React.FC<SizeSettingProps> = (props) => {
    const { onWidthChange, onHeightChange, width, height } = props;
    const [show, setShow] = useState<boolean>(false);
    const { t } = useTranslation("translation", { keyPrefix: "main.tabpanel.settings.size_setting" });

    useEffect(() => {
        if (show) {
            const closeDialog = () => {
                setShow(false);
            };

            let subscribed = false;
            const timer = setTimeout(() => {
                subscribed = true;
                document.body.addEventListener("click", closeDialog);
            }, 200);

            return () => {
                clearTimeout(timer);
                if (subscribed) {
                    document.body.removeEventListener("click", closeDialog);
                }
            };
        }
    }, [show]);

    return (
        <div className="leading-none cursor-pointer">
            <ArrowsPointingOutIcon
                role="button"
                id="button:size_setting"
                aria-describedby="button:size_setting:label"
                tabIndex={0}
                aria-haspopup="dialog"
                onClick={() => {
                    setShow((v) => !v);
                }}
                className="w-4 h-4 inline-block mr-0.5 text-gray-900"
            />
            {show && (
                <>
                <ResizeDialog {...props}>
                    <div>
                        <XMarkIcon
                            className="text-gray-900 absolute right-2 top-2 w-4 cursor-pointer hover:bg-red-100"
                            role="button"
                            tabIndex={0}
                            aria-label="close"
                            onClick={(e) => {
                                setShow(false);
                                e.stopPropagation();
                            }}
                        />
                    </div>
                </ResizeDialog>
                </>
            )}
        </div>
    );
};

export default SizeSetting;
