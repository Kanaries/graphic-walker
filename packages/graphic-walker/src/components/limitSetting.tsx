import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createUseDebounceValueBind } from '../hooks';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';

export default function LimitSetting(props: { value: number; setValue: (v: number) => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });
    const [innerValue, setInnerValue] = createUseDebounceValueBind(600)(props.value, (v) => props.setValue(v));
    const inputValue = useMemo(() => (innerValue > 0 ? innerValue : 0), [innerValue]);

    return (
        <div className="w-60 mt-2 p-2">
            <Input
                className='h-8'
                type='number'
                min={0}
                step={10}
                value={inputValue}
                onChange={(e) => setInnerValue(parseInt(e.target.value))}
            />
            <div className="ml-1 mt-3 flex items-center">
                <Checkbox
                    className="mr-1"
                    checked={innerValue > 0}
                    onCheckedChange={(v) => {
                        setInnerValue(v ? 30 : -1);
                    }}
                ></Checkbox>
                {`${t('limit')}${innerValue > 0 ? `: ${innerValue}` : ''}`}
            </div>
        </div>
    );
}
