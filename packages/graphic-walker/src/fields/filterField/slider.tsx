import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Slider as RangeSlider } from '@/components/rangeslider';
import { Input } from '@/components/ui/input';
const SliderContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
    padding-block: 1em;

    > .output {
        display: flex;
        justify-content: space-between;
        margin-top: 1em;

        > output {
            width: 100%;
        }

        > output:first-child {
            margin-right: 0.5em;
        }

        > output:last-child {
            margin-left: 0.5em;
        }
    }
`;

interface ValueInputProps {
    min: number;
    max: number;
    value: number;
    resetValue: number;
    onChange: (value: number) => void;
    step?: number;
}

const ValueInput: React.FC<ValueInputProps> = (props) => {
    const { min, max, value, step, resetValue, onChange } = props;
    const [innerValue, setInnerValue] = useState(`${value ?? resetValue}`);

    const handleSubmitValue = () => {
        const v = Number(innerValue);
        if (!isNaN(v) && v <= max && v >= min) {
            onChange(v);
        } else {
            onChange(resetValue);
            setInnerValue(`${resetValue}`);
        }
    };

    useEffect(() => {
        setInnerValue(`${value ?? resetValue}`);
    }, [value]);

    return (
        <Input
            type="number"
            min={min}
            max={max}
            step={step}
            value={innerValue}
            onChange={(e) => setInnerValue(e.target.value)}
            onBlur={handleSubmitValue}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleSubmitValue();
                }
            }}
        />
    );
};

interface SliderProps {
    min: number;
    max: number;
    value: [number | null, number | null];
    onChange: (value: [number, number]) => void;
}

const Slider: React.FC<SliderProps> = React.memo(function Slider({ min, max, value, onChange }) {
    const { t } = useTranslation();

    // step to last digit, e.g. 0.7 => 0.1
    const stepDigit = 10 ** Math.floor(Math.log10((max - min) / 100));

    return (
        <SliderContainer>
            <RangeSlider value={[value[0] ?? min, value[1] ?? max]} min={min} max={max} step={stepDigit} onValueChange={([min, max]) => onChange([min, max])} />
            <div className="output">
                <output htmlFor="slider:min">
                    <div className="my-1">{t('filters.range.start_value')}</div>
                    {
                        <ValueInput
                            min={min}
                            max={value[1] ?? max}
                            value={value[0] ?? min}
                            step={stepDigit}
                            resetValue={min}
                            onChange={(newValue) => onChange([newValue, value[1] ?? max])}
                        />
                    }
                </output>
                <output htmlFor="slider:max">
                    <div className="my-1">{t('filters.range.end_value')}</div>
                    {
                        <ValueInput
                            min={value[0] ?? min}
                            max={max}
                            value={value[1] ?? max}
                            step={stepDigit}
                            resetValue={max}
                            onChange={(newValue) => onChange([value[0] ?? min, newValue])}
                        />
                    }
                </output>
            </div>
        </SliderContainer>
    );
});

export default Slider;
