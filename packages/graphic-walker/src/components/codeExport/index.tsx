import React, { useEffect, useState } from 'react';
import Modal from '../modal';
import { observer } from 'mobx-react-lite';
import { useVizStore } from '../../store';
import DefaultButton from '../button/default';
import PrimaryButton from '../button/primary';
import { useTranslation } from 'react-i18next';
import DefaultTab, { ITabOption } from '../tabs/defaultTab';

const syntaxHighlight = (json: any) => {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 4);
    }
    json = json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/\s/g, '&nbsp;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'text-sky-500'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-purple-500'; // key
            } else {
                cls = 'text-emerald-500'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-blue-500';
        } else if (/null/.test(match)) {
            cls = 'text-sky-500';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
};

const CodeExport: React.FC = observer((props) => {
    const vizStore = useVizStore();
    const { showCodeExportPanel } = vizStore;
    const { t } = useTranslation();
    const [tabKey, setTabKey] = useState<string>('graphic-walker');
    const [code, setCode] = useState<any>('');

    const specTabs: ITabOption[] = [
        {
            key: 'graphic-walker',
            label: 'Graphic-Walker',
        },
        {
            key: 'vega-lite',
            label: 'Vega-Lite',
        },
    ];

    useEffect(() => {
        if (showCodeExportPanel) {
            if (tabKey === 'graphic-walker') {
                const res = vizStore.exportCode();
                setCode(res);
            } else {
                setCode(vizStore.lastSpec);
            }
        }
    }, [tabKey, showCodeExportPanel, vizStore]);
    return (
        <Modal
            show={showCodeExportPanel}
            onClose={() => {
                vizStore.setShowCodeExportPanel(false);
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
                <div className="text-sm px-6 max-h-96 overflow-auto">
                    <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(code) }} />
                </div>
                <div className="mt-4 flex justify-start">
                    <PrimaryButton
                        // text={t("actions.confirm")}
                        className="mr-2 px-6"
                        text="Copy to Clipboard"
                        onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(code));
                            vizStore.setShowCodeExportPanel(false);
                        }}
                    />
                    <DefaultButton
                        text={t('actions.cancel')}
                        className="mr-2 px-6"
                        onClick={() => {
                            vizStore.setShowCodeExportPanel(false);
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
});

export default CodeExport;
