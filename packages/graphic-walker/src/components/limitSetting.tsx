import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounceValueBind } from '../hooks';

export default function LimitSetting(props: { value: number; setValue: (v: number) => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });
    const [innerValue, setInnerValue] = useDebounceValueBind(props.value, v => props.setValue(v));

    return (
        <div className=" mt-2">
            <input
                className="w-full h-2 bg-blue-100 appearance-none"
                type="range"
                name="limit"
                value={innerValue > 0 ? innerValue : 0}
                min="1"
                max="50"
                disabled={innerValue < 0}
                step="1"
                onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) {
                        setInnerValue(v);
                    }
                }}
            />
            <output className="text-sm ml-1" htmlFor="height">
                <input
                    type="checkbox"
                    className="h-4 w-4 mr-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                    checked={innerValue > 0}
                    onChange={(e) => {
                        setInnerValue(e.target.checked ? 30 : -1);
                    }}
                ></input>
                {`${t('limit')}${innerValue > 0 ? `: ${innerValue}` : ''}`}
            </output>
        </div>
    );
}
