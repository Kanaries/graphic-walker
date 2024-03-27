import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import React, { useState } from 'react';

export const EditNamePopover = (props: { children: React.ReactNode; desc: React.ReactNode; onSubmit: (newName: string) => void; defaultValue: string }) => {
    const [value, setValue] = useState(props.defaultValue);
    const [open, setOpen] = useState(false);
    return (
        <Popover
            open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (open) {
                    setValue(props.defaultValue);
                } else if (value !== props.defaultValue && value) {
                    props.onSubmit(value);
                }
            }}
        >
            <PopoverTrigger>{props.children}</PopoverTrigger>
            <PopoverContent>
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Edit name</h4>
                        <div className="text-sm text-muted-foreground">{props.desc}</div>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="width">Name</Label>
                            <Input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="col-span-2 h-8"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        value !== props.defaultValue && value && props.onSubmit(value);
                                        setOpen(false);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
