import DefaultButton from '../../components/button/default';
import PrimaryButton from '../../components/button/primary';
import Modal from '../../components/modal';
import React, { useState } from 'react';

export default function DataViewConfigModal(props: { value: string; onChange: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(props.value);

    return (
        <>
            <div className="flex items-center space-x-2 mb-2">
                <DefaultButton
                    text={props.value ? 'Reset Dataview' : 'Create Dataview'}
                    onClick={() => {
                        setOpen(true);
                        setInputValue(props.value);
                    }}
                />
                <span>{props.value}</span>
            </div>
            <Modal show={open} onClose={() => setOpen(false)}>
                <div className="flex flex-col space-y-2">
                    <div>
                        <label className="block text-xs text-gray-800 dark:text-gray-200 mb-1 font-bold">DataView SQL</label>
                        <input
                            type="text"
                            placeholder="Enter sql for dataview..."
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                            }}
                            className="text-xs w-full mr-2 p-2 rounded border border-gray-200 dark:border-gray-700 outline-none focus:outline-none focus:border-blue-500 placeholder:italic placeholder:text-slate-400 dark:bg-stone-900"
                        />
                    </div>
                    <div className="text-red-500 text-xs">Warning: Create/Reset dataview will reset all visualizations!</div>

                    <div className="flex space-x-2">
                        <PrimaryButton text="Confirm" onClick={() => {
                            props.onChange(inputValue);
                            setOpen(false);
                        }} />
                        <DefaultButton text="Cancel" onClick={() => setOpen(false)} />
                    </div>
                </div>
            </Modal>
        </>
    );
}
