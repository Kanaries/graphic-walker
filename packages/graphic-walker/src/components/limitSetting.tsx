import React from 'react';
import { useTranslation } from 'react-i18next';
import { createStreamedValueBindHook } from '../hooks';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import debounce from 'lodash-es/debounce';

const useDebounceValueBind  = createStreamedValueBindHook((f) => debounce(f, 600));

export default function LimitSetting(props: { value: number; setValue: (v: number) => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });
    const [enable, setEnable] = React.useState(props.value > 0);
    const [innerValue, setInnerValue] = useDebounceValueBind(props.value <= 0 ? 100: props.value, (v) => enable && props.setValue(v));

    return (
        <div className="w-60 mt-2 p-2">
            <Input
                className='h-8'
                type='number'
                min={0}
                step={10}
                value={innerValue}
                disabled={!enable}
                onChange={(e) => setInnerValue(parseInt(e.target.value))}
            />
            <div className="ml-1 mt-3 flex items-center">
                <Checkbox
                    className="mr-1"
                    checked={enable}
                    onCheckedChange={(v) => {
                        setEnable(!!v);
                        v ? props.setValue(innerValue) : props.setValue(0);
                    }}
                ></Checkbox>
                { t('limit') }
            </div>
        </div>
    );
}
