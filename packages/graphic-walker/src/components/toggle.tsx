import React from 'react';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label?: string;
}

export default function Toggle(props: ToggleProps) {
    const { enabled, onChange, label } = props;

    return (
        <div className="flex items-center space-x-2">
            <Switch id={label} checked={enabled} onCheckedChange={onChange} />
            <Label htmlFor={label}>{label}</Label>
        </div>
    );
}
