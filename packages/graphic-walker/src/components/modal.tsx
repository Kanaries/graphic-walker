import React, { useRef } from "react";
import styled from "styled-components";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

const Background = styled.div({
    position: "fixed",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    backdropFilter: "blur(1px)",
    zIndex: 25535,
});

const Container = styled.div`
    width: 98%;
    @media (min-width: 600px) {
        width: 80%;
    }
    @media (min-width: 1100px) {
        width: 880px;
    }
    max-height: 800px;
    overflow: auto;
    > div.header {
        background-color: #f0f0f0;
        display: flex;
        padding: 12px;
        font-size: 14px;
        align-items: center;
        @media (prefers-color-scheme: dark) {
            background-color: #000;
        }
    }
    > div.container {
        padding: 0.5em 1em 1em 1em;
    }
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background-color: #fff;
    @media (prefers-color-scheme: dark) {
        background-color: #000;
    }
    /* box-shadow: 0px 0px 12px 3px rgba(0, 0, 0, 0.19); */
    border-radius: 4px;
    z-index: 999;
`;
interface ModalProps {
    onClose?: () => void;
    show?: boolean;
    title?: string;
}
const Modal: React.FC<ModalProps> = (props) => {
    const { onClose, title, show } = props;
    const prevMouseDownTimeRef = useRef(0);
    return (
        <Background
            // This is a safer replacement of onClick handler.
            // onClick also happens if the click event is begun by pressing mouse button
            // at a different element and then released when the mouse is moved on the target element.
            // This case is required to be prevented, especially disturbing when interacting
            // with a Slider component.
            className={"border border-gray-300 dark:border-gray-600 " + (show ? "block" : "hidden")}
            onMouseDown={() => (prevMouseDownTimeRef.current = Date.now())}
            onMouseOut={() => (prevMouseDownTimeRef.current = 0)}
            onMouseUp={() => {
                if (Date.now() - prevMouseDownTimeRef.current < 1000) {
                    onClose?.();
                }
            }}
        >
            <Container role="dialog" className="shadow-lg rounded-md border border-gray-100 dark:border-gray-800" onMouseDown={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-zinc-900 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={() => {
                        onClose?.();
                    }}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="px-6 pt-4 text-base font-semibold leading-6 text-gray-900 dark:text-gray-50">{title}</div>
                <div className="container">{props.children}</div>
            </Container>
        </Background>
    );
};

export default Modal;
