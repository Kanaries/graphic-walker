import React, { useRef, useCallback } from "react";
import { useGlobalStore } from "../../store";
import { observer } from "mobx-react-lite";


interface GWFileProps {
    fileRef: React.RefObject<HTMLInputElement>;
}
const GWFile: React.FC<GWFileProps> = (props) => {
    const { commonStore, vizStore } = useGlobalStore();

    return (
        <input
            style={{ display: "none" }}
            type="file"
            ref={props.fileRef}
            onChange={(e) => {
                const files = e.target.files;
                if (files !== null) {
                    const file = files[0];
                    file.text().then(res => {
                        vizStore.importRaw(res)
                    })
                }
            }}
        />
    );
};

export default observer(GWFile);
