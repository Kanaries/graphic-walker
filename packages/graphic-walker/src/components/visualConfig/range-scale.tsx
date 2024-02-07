import React from 'react';
import { useTranslation } from 'react-i18next';
import { Slider } from '../../components/rangeslider';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function RangeScale(props: {
    text: string;
    maxRange: number;
    minRange: number;
    enableMaxDomain: boolean;
    enableMinDomain: boolean;
    enableRange: boolean;
    rangeMax: number;
    rangeMin: number;
    domainMax: number;
    domainMin: number;
    setEnableMinDomain: (v: boolean) => void;
    setEnableMaxDomain: (v: boolean) => void;
    setEnableRange: (v: boolean) => void;
    setDomainMin: (v: number) => void;
    setDomainMax: (v: number) => void;
    setRangeMin: (v: number) => void;
    setRangeMax: (v: number) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex space-x-6 my-2">
            <div className="flex flex-col space-y-2 items-start">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`min_domain_${props.text}`} checked={props.enableMinDomain} onCheckedChange={props.setEnableMinDomain} />
                    <Label htmlFor={`min_domain_${props.text}`}>{t('config.min_domain')}</Label>
                </div>
                <Input
                    value={props.domainMin}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) {
                            props.setDomainMin(v);
                        }
                    }}
                    type="number"
                    disabled={!props.enableMinDomain}
                />
            </div>
            <div className="flex flex-col space-y-2 items-start">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`max_domain_${props.text}`} checked={props.enableMaxDomain} onCheckedChange={props.setEnableMaxDomain} />
                    <Label htmlFor={`max_domain_${props.text}`}>{t('config.max_domain')}</Label>
                </div>
                <Input
                    value={props.domainMax}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) {
                            props.setDomainMax(v);
                        }
                    }}
                    type="number"
                    disabled={!props.enableMaxDomain}
                />
            </div>
            <div className="flex flex-col items-start w-48 space-y-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`range_${props.text}`} checked={props.enableRange} onCheckedChange={props.setEnableRange} />
                    <Label htmlFor={`range_${props.text}`}>{t('config.range')}</Label>
                </div>
                <div className="flex w-full flex-col space-y-2 pt-2">
                    <Slider
                        max={props.maxRange}
                        min={props.minRange}
                        value={[props.rangeMin, props.rangeMax]}
                        onValueChange={([min, max]) => {
                            props.setRangeMin(min);
                            props.setRangeMax(max);
                        }}
                        step={props.maxRange < 2 ? 0.01 : 1}
                    />
                    <div className="relative w-full h-4">
                        <div className="text-xs absolute left-0 text-foreground inset-y-0">{props.rangeMin}</div>
                        <div className="text-xs absolute right-0 text-foreground inset-y-0">{props.rangeMax}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
