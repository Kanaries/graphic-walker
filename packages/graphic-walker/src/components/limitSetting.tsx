import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounceValueBind } from '../hooks';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';

export default function LimitSetting(props: { value: number; setValue: (v: number) => void }) {
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });
    const [innerValue, setInnerValue] = useDebounceValueBind(props.value, (v) => props.setValue(v));
    const sliderValue = useMemo(() => (innerValue > 0 ? [innerValue] : [0]), [innerValue]);

    return (
        <div className="w-60 mt-2 p-2">
            <Slider
                min={1}
                max={50}
                step={1}
                name="limit"
                className="w-full"
                disabled={innerValue < 0}
                onValueChange={([v]) => setInnerValue(v)}
                value={sliderValue}
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
