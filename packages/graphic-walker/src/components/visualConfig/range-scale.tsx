import React from 'react';
import { useTranslation } from 'react-i18next';
import { Slider } from '../../components/rangeslider';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { NumberInput } from '../ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function RangeScale(props: {
    text: string;
    maxRange: number;
    minRange: number;
    enableMaxDomain: boolean;
    enableMinDomain: boolean;
    enableRange: boolean;
    enableType: boolean;
    rangeMax: number;
    rangeMin: number;
    domainMax: number;
    domainMin: number;
    type: 'linear' | 'log' | 'pow' | 'sqrt' | 'symlog';
    setEnableMinDomain: (v: boolean) => void;
    setEnableMaxDomain: (v: boolean) => void;
    setEnableRange: (v: boolean) => void;
    setEnableType: (v: boolean) => void;
    setDomainMin: (v: number) => void;
    setDomainMax: (v: number) => void;
    setRangeMin: (v: number) => void;
    setRangeMax: (v: number) => void;
    setType: (v: 'linear' | 'log' | 'pow' | 'sqrt' | 'symlog') => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex md:flex-row flex-col gap-6 my-2">
            <div className="flex flex-col space-y-2 items-start">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`type_${props.text}`} checked={props.enableType} onCheckedChange={props.setEnableType} />
                    <Label htmlFor={`type_${props.text}`}>{t('config.type')}</Label>
                </div>
                <Select value={props.type} disabled={!props.enableType} onValueChange={props.setType}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="linear">Linear</SelectItem>
                        <SelectItem value="log">Log</SelectItem>
                        <SelectItem value="pow">Pow</SelectItem>
                        <SelectItem value="sqrt">Sqrt</SelectItem>
                        <SelectItem value="symlog">Symlog</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col space-y-2 items-start">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`min_domain_${props.text}`} checked={props.enableMinDomain} onCheckedChange={props.setEnableMinDomain} />
                    <Label htmlFor={`min_domain_${props.text}`}>{t('config.min_domain')}</Label>
                </div>
                <NumberInput
                    className="w-32"
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
                <NumberInput
                    className="w-32"
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
                        disabled={!props.enableRange}
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

export function DomainScale(props: {
    text: string;
    enableMaxDomain: boolean;
    enableMinDomain: boolean;
    enableType: boolean;
    domainMax: number;
    domainMin: number;
    type: 'linear' | 'log' | 'pow' | 'sqrt' | 'symlog';
    setEnableMinDomain: (v: boolean) => void;
    setEnableMaxDomain: (v: boolean) => void;
    setEnableType: (v: boolean) => void;
    setDomainMin: (v: number) => void;
    setDomainMax: (v: number) => void;
    setType: (v: 'linear' | 'log' | 'pow' | 'sqrt' | 'symlog') => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex md:flex-row flex-col gap-6 my-2">
            <div className="flex flex-col space-y-2 items-start">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`type_${props.text}`} checked={props.enableType} onCheckedChange={props.setEnableType} />
                    <Label htmlFor={`type_${props.text}`}>{t('config.type')}</Label>
                </div>
                <Select value={props.type} disabled={!props.enableType} onValueChange={props.setType}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="linear">Linear</SelectItem>
                        <SelectItem value="log">Log</SelectItem>
                        <SelectItem value="pow">Pow</SelectItem>
                        <SelectItem value="sqrt">Sqrt</SelectItem>
                        <SelectItem value="symlog">Symlog</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col space-y-2 items-start">
                <div className="flex items-center space-x-2">
                    <Checkbox id={`min_domain_${props.text}`} checked={props.enableMinDomain} onCheckedChange={props.setEnableMinDomain} />
                    <Label htmlFor={`min_domain_${props.text}`}>{t('config.min_domain')}</Label>
                </div>
                <NumberInput
                    className="w-32"
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
                <NumberInput
                    className="w-32"
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
        </div>
    );
}
