import React from "react";
import { useGlobalStore } from "../../store";
import { observer } from "mobx-react-lite";


interface GWFileProps {
    fileRef: React.RefObject<HTMLInputElement>;
}
const GWFile: React.FC<GWFileProps> = (props) => {
    const { dataStore } = useGlobalStore();

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
                        dataStore.importData(JSON.parse(res))
                    })
                }
            }}
        />
    );
};

export default observer(GWFile);
