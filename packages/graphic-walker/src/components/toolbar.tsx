import React, { useState } from "react";
import styled from "styled-components";
const ToolbarDiv = styled.div`
    margin: 0.2em;
    background-color: #fff;
    .icon {
        width: 100%;
        height: 40px;
        display: flex;
        border-bottom: 1px solid #d9d9d9;
        div {
            width: 40px;
            height: 40px;
            margin-right: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            svg {
                width: 24px;
                height: 24px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
        }
    }
    .tu {
        border-left: 1px solid #eee;
        border-top: 1px solid #eee;
        border-right: 3px solid #f1f1f1;
        border-bottom: 3px solid #f1f1f1;
    }
    .ao {
        border-right: 1px solid #eee;
        border-bottom: 1px solid #eee;
        border-left: 3px solid #f1f1f1;
        border-top: 3px solid #f1f1f1;
    }
    .func {
        width: 100%;
        padding: 10px;
        border: 1px solid #d9d9d9;
        border-top: none;
    }
`;
interface IconTypes {
    key: string;
    iconName: () => JSX.Element;
    jsx: () => JSX.Element;
}
interface ToolBarProps {
    iconList: IconTypes[];
}

const toolbar: React.FC<ToolBarProps> = (props) => {
    const { iconList } = props;
    const [step, setStep] = useState<string | null>(null);
    return (
        <ToolbarDiv>
            <div className="icon">
                {iconList.map((item, index) => {
                    return (
                        <div
                            key={item.key}
                            className={`${step !== null && step === item.key ? "ao" : "tu"} cursor-pointer p-2`}
                            onClick={() => {
                                setStep(item.key);
                            }}
                        >
                            {item.iconName()}
                        </div>
                    );
                })}
            </div>
            {step !== null && (
                <div className="func">{iconList.filter((item, index) => item.key === step)[0].jsx()}</div>
            )}
        </ToolbarDiv>
    );
};

export default toolbar;
