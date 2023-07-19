import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';


const ShowMessageAnimation = keyframes`
    0% {
        max-width: 0;
    }
    100% {
        max-width: 33%;
    }
`;

const HideMessageAnimation = keyframes`
    0% {
        max-width: 33%;
    }
    100% {
        max-width: 0;
    }
`;

const Text = styled.div<{ stage: 'enter' | 'normal' | 'exit' }>`
    animation-name: ${({ stage }) => stage === 'enter' ? ShowMessageAnimation : stage === 'exit' ? HideMessageAnimation : 'none'};
    animation-duration: ${({ stage }) => stage === 'enter' ? '0.8s' : stage === 'exit' ? '3s' : '0'};
    animation-timing-function: linear;
    animation-fill-mode: forwards;
    :hover {
        animation-name: ${ShowMessageAnimation};
    }
`;

interface IMessageProps {}

export interface IMessageHandle {
    show: (message: string) => void;
    clear: () => void;
}

const Message = forwardRef<IMessageHandle, IMessageProps>(function Message ({}, ref) {
    const [errorMessage, setErrorMessage] = useState<null | string>(null);
    const [aniStage, setAniStage] = useState<'enter' | 'normal' | 'exit'>('normal');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(ref, () => ({
        show(message) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            setErrorMessage(message);
            setAniStage('enter');
        },
        clear() {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            setAniStage('enter');
        },
    }), []);

    if (errorMessage === null) {
        return null;
    }

    const handleAnimationEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        if (aniStage === 'enter') {
            setAniStage('normal');
            timerRef.current = setTimeout(() => {
                setAniStage('exit');
            }, 4_000);
        } else if (aniStage === 'exit') {
            setErrorMessage(null);
            setAniStage('normal');
        }
    };

    const handleMouseEnter = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setAniStage('normal');
    };

    const handleMouseLeave = () => {
        if (aniStage !== 'normal') {
            return;
        }
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setAniStage('normal');
        timerRef.current = setTimeout(() => {
            setAniStage('exit');
        }, 8_000);
    };

    return (
        <>
            <Text
                className="inline-block truncate text-red-500 border-y border-gray-200 dark:border-gray-700"
                stage={aniStage}
                onAnimationEnd={handleAnimationEnd}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <span className="px-2">{errorMessage}</span>
            </Text>
            <div
                className="flex-none h-full flex items-center justify-center px-1.5 text-red-500 overflow-hidden border-y border-gray-200 dark:border-gray-700"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <ExclamationCircleIcon className="w-6 h-6 bg-inherit" stroke="currentColor" fill="none" strokeWidth={1.5} aria-hidden />
            </div>
        </>
    );
});


export default Message;
