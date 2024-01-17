import React from "react";
import { ButtonBaseProps } from "./base";

const DefaultMiniButton: React.FC<ButtonBaseProps> = (props) => {
    const { text, onClick, disabled } = props;
    return (
        <button
            className="inline-block min-w-96 text-xs ml-2 pt-1 pb-1 pl-6 pr-6 border border-gray-500 rounded-sm hover:bg-gray-800 hover:border-gray-800 hover:text-white disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:text-white"
            onClick={onClick}
            disabled={disabled}
        >
            {text}
        </button>
    );
};

export default DefaultMiniButton;
