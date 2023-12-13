import React from 'react';

interface GWFileProps {
    fileRef: React.RefObject<HTMLInputElement>;
    onImport: (file: File) => void;
}
const GWFile: React.FC<GWFileProps> = (props) => {
    return (
        <input
            style={{ display: 'none' }}
            type="file"
            ref={props.fileRef}
            onChange={(e) => {
                const files = e.target.files;
                if (files !== null) {
                    const file = files[0];
                    props.onImport(file);
                }
            }}
        />
    );
};

export default GWFile;
