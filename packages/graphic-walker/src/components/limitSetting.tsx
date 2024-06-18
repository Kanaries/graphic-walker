import React from 'react';
import { useTranslation } from 'react-i18next';
import { createStreamedValueBindHook } from '../hooks';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import debounce from 'lodash-es/debounce';

const useDebounceValueBind  = createStreamedValueBindHook((f) => debounce(f, 600));

export default function LimitSetting(props: { value: number; setValue: (v: number) => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });
    const [innerValue, setInnerValue] = useDebounceValueBind(props.value, (v) => props.setValue(v));

    return (
        <div className="w-60 mt-2 p-2">
            <Input
                className='h-8'
                type='number'
                min={0}
                step={10}
                value={innerValue}
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
