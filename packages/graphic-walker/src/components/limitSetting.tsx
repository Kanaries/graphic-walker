import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LimitSetting(props: { value: number; setValue: (v: number) => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    return (
        <div className=" mt-2">
            <input
                className="w-full h-2 bg-blue-100 appearance-none"
                type="range"
                name="limit"
                value={props.value > 0 ? props.value : 0}
                min="1"
                max="50"
                disabled={props.value < 0}
                step="1"
                onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) {
                        props.setValue(v);
                    }
                }}
            />
            <output className="text-sm ml-1" htmlFor="height">
                <input
                    type="checkbox"
                    className="h-4 w-4 mr-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                    checked={props.value > 0}
                    onChange={(e) => {
                        props.setValue(e.target.checked ? 30 : -1);
                    }}
                ></input>
                {`${t('limit')}${props.value > 0 ? `: ${props.value}` : ''}`}
            </output>
        </div>
    );
}
