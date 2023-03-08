import React, { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { useGlobalStore } from "../store";
import { dumpsGWPureSpec } from "../utils/save";
import { useCurrentMediaTheme } from "../utils/media";

const VisExport: React.FC<any> = (props) => {

    // const exportVisSpec = useCallback(throttle(() => {
    // }, 200), [vizStore]);
    const {commonStore, vizStore} = useGlobalStore();
    const [visSpec, setVisSpec] = useState("");
    useEffect(() => {
        const pureVisList = vizStore.exportVisSpec();
        const s = JSON.stringify(pureVisList, null, 2);
        setVisSpec(s);
    }, [commonStore.showSpecExport]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(visSpec).then(() => {
            console.log("success");
        }).catch((reason) => {
            console.warn("failed:", reason);
        });
    }
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            commonStore.showSpecExport = false;
            e.preventDefault();
        }
    };
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        ref.current?.addEventListener('keydown', handleEscape);

        return () => {
            ref.current?.removeEventListener('keydown', handleEscape);
        }
    }, []);
    return (
    <>
        <div ref={ref} className="bg-white dark:bg-zinc-900 dark:text-white flex flex-col text-sm px-2">
            <span className="flex flex-row space-x-20">
                <nav className="-mb-px flex space-x-8" role="tablist">
                    <button>JSON</button>
                    <button>PyGWalker</button>
                </nav>
                <button onClick={copyToClipboard}>Copy to clipboard</button>
            </span>
            <textarea className="bg-white dark:bg-zinc-800 dark:text-green-500 font-mono"
            rows={20} cols={60} value={visSpec}
            onChange={(ev) => setVisSpec(ev.target.value)}>
            </textarea>
        </div>
    </>);
}

export default VisExport;