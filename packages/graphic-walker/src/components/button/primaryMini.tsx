import React from "react";
import { ButtonBaseProps } from "./base";

const PrimaryMiniButton: React.FC<ButtonBaseProps> = (props) => {
    const { text, onClick, disabled, className } = props;
    let btnClassName = "inline-block min-w-96 text-xs ml-2 pt-1 pb-1 pl-6 pr-6 border border-gray-800 bg-gray-800 text-white rounded-sm hover:bg-white dark:bg-zinc-900  border-gray-800 hover:text-gray-800 cursor-pointer disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:text-white"
    if (className) {
        btnClassName = btnClassName + " " + className;
    }
    return (
        <button
            className={btnClassName}
            onClick={onClick}
            disabled={disabled}
        >
            {text}
        </button>
    );
};

export default PrimaryMiniButton;
