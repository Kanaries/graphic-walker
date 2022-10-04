import React, { useRef, useCallback } from "react";
import { FileReader } from "@kanaries/web-data-loader";
import { IRow } from "../../interfaces";
import Table from "../table";
import styled from "styled-components";
import { useGlobalStore } from "../../store";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";

const Container = styled.div`
    overflow-x: auto;
`;

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
