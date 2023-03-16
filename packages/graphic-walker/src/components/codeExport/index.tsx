import React, { useEffect, useState, useMemo } from "react";
import Modal from "../modal";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import DefaultButton from "../button/default";
import PrimaryButton from "../button/primary";
import { useTranslation } from "react-i18next";
import DefaultTab, { ITabOption } from "../tabs/defaultTab";

const syntaxHighlight = (json: any) => {
    if (typeof json != "string") {
        json = JSON.stringify(json, undefined, 4);
    }
    json = json
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
        .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
        .replace(/\s/g, "&nbsp;&nbsp;");
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
            var cls = "text-sky-500"; // number
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = "text-purple-500"; // key
                } else {
                    cls = "text-emerald-500"; // string
                }
            } else if (/true|false/.test(match)) {
                cls = "text-blue-500";
            } else if (/null/.test(match)) {
                cls = "text-sky-500";
            }
            return '<span class="' + cls + '">' + match + "</span>";
        }
    );
};

const CodeExport: React.FC = observer((props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showCodeExportPanel } = commonStore;
    const { t } = useTranslation();
    const [tabKey, setTabKey] = useState<string>("pygwalker");
    const [code, setCode] = useState<any>("");
    const [manualCopy, setManualCopy] = useState<boolean>(false);

    const copyOutput = useMemo(() => {
        let output = JSON.stringify(code);
        if (tabKey === "pygwalker") {
            output = `vis_spec = """${output}"""\npyg.walk(df, spec=vis_spec)`;
        }
        return output;
    }, [code, tabKey]);

    const specTabs: ITabOption[] = [
        {
            key: "pygwalker",
            label: "PyGWalker",
        },
        {
            key: "graphic-walker",
            label: "Graphic-Walker",
        },
        {
            key: "vega-lite",
            label: "Vega-Lite",
            disabled: true
        },
    ];

    const hlId = (s: string) => {
        const cls = 'text-violet-800';
        return `<span class="${cls}">${s}</span>`
    }

    useEffect(() => {
        if (showCodeExportPanel) {
            if (tabKey === "graphic-walker" || tabKey === "pygwalker") {
                const res = vizStore.exportViewSpec();
                setCode(res);
            } else {
                setCode("vega code");
            }
        }
    }, [tabKey, showCodeExportPanel]);

    return (
        <Modal
            show={showCodeExportPanel}
            onClose={() => {
                commonStore.setShowCodeExportPanel(false);
            }}
        >
            <div>
                <h1>Code Export</h1>
                <DefaultTab
                    tabs={specTabs}
                    selectedKey={tabKey}
                    onSelected={(k) => {
                        setTabKey(k as string);
                    }}
                />
                {tabKey === "graphic-walker" && (
                    <div className="text-sm px-6 max-h-56 overflow-auto">
                        <div dangerouslySetInnerHTML={{ __html: syntaxHighlight(code) }} />
                    </div>
                )}
                {tabKey === "pygwalker" && (
                    <div className="text-sm px-6 max-h-56 overflow-auto">
                        <div dangerouslySetInnerHTML={{
                            __html: `<p>${hlId("vis_spec")}\
                             = """</p>\n${syntaxHighlight(code)}<p>"""</p><p>${hlId("pyg")}.${hlId("walk")}(${hlId("df")}, spec=${hlId("vis_spec")})</p>` }} />
                    </div>
                )}
                <div className="mt-4 flex justify-start">
                    <PrimaryButton
                        // text={t("actions.confirm")}
                        className="mr-2 px-6"
                        text="Copy to Clipboard"
                        onClick={async () => {
                            if (!manualCopy) {
                                const queryOpts = { name: 'clipboard-read' as PermissionName, allowWithoutGesture: false };
                                const permissionStatus = await navigator.permissions.query(queryOpts);
                                try {
                                    if (permissionStatus.state !== 'denied') {
                                        navigator.clipboard.writeText(copyOutput);
                                        commonStore.setShowCodeExportPanel(false);
                                    }
                                    else { setManualCopy(true); }
                                } catch(e) { setManualCopy(true); }
                            } else {
                                setManualCopy(false);
                            }
                        }}
                    />
                    {/* <DefaultButton
                        text={t("Edit & Preview")}
                        className="mr-2 px-6"
                        onClick={() => {

                        }}
                    /> */}
                    <DefaultButton
                        text={t("actions.cancel")}
                        className="mr-2 px-6"
                        onClick={() => {
                            commonStore.setShowCodeExportPanel(false);
                        }}
                    />
                </div>
                { manualCopy && <div className="text-sm px-6 max-h-56">
                    <textarea style={{fontFamily: "monospace"}} readOnly={true} rows={3} cols={90} wrap="off" defaultValue={copyOutput} />
                    <p style={{textAlign: 'right'}}>The Clipboard API has been blocked in this environment. Please copy manully.</p>
                </div>}
            </div>
        </Modal>
    );
});

export default CodeExport;
