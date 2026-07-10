import React from 'react';
import { useTranslation } from 'react-i18next';
import { Slider } from '../../components/rangeslider';
import { Label } from '../ui/label';
import { NumberInput } from '../ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

function OverrideRow(props: {
    id: string;
    title: React.ReactNode;
    description: React.ReactNode;
    enabled: boolean;
    onEnabledChange: (v: boolean) => void;
    children?: React.ReactNode;
}) {
    return (
        <div className="p-4">
            <div className="flex justify-between items-center gap-4">
                <div>
                    <Label htmlFor={props.id} className="text-xs font-medium leading-6 cursor-pointer">
                        {props.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">{props.description}</p>
                </div>
                <Switch id={props.id} checked={props.enabled} onCheckedChange={props.onEnabledChange} />
            </div>
            {props.enabled && props.children && <div className="mt-3">{props.children}</div>}
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
        <>
            <OverrideRow
                id={`type_${props.text}`}
                title={t('config.type')}
                description={t('config.scale_type_desc')}
                enabled={props.enableType}
                onEnabledChange={props.setEnableType}
            >
                <Select value={props.type} onValueChange={props.setType}>
                    <SelectTrigger className="w-40">
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
            </OverrideRow>
            <OverrideRow
                id={`min_domain_${props.text}`}
                title={t('config.min_domain')}
                description={t('config.min_domain_desc')}
                enabled={props.enableMinDomain}
                onEnabledChange={props.setEnableMinDomain}
            >
                <NumberInput
                    className="w-40"
                    value={props.domainMin}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) {
                            props.setDomainMin(v);
                        }
                    }}
                    type="number"
                />
            </OverrideRow>
            <OverrideRow
                id={`max_domain_${props.text}`}
                title={t('config.max_domain')}
                description={t('config.max_domain_desc')}
                enabled={props.enableMaxDomain}
                onEnabledChange={props.setEnableMaxDomain}
            >
                <NumberInput
                    className="w-40"
                    value={props.domainMax}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) {
                            props.setDomainMax(v);
                        }
                    }}
                    type="number"
                />
            </OverrideRow>
        </>
    );
}

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
        <>
            <DomainScale {...props} />
            <OverrideRow
                id={`range_${props.text}`}
                title={t('config.range')}
                description={t('config.range_desc')}
                enabled={props.enableRange}
                onEnabledChange={props.setEnableRange}
            >
                <div className="flex max-w-md flex-col space-y-2 pt-2">
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
            </OverrideRow>
        </>
    );
}
