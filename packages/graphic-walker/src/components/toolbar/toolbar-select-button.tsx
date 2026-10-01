import React, { memo } from 'react';
import { IToolbarItem, IToolbarProps } from './toolbar-item';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ToolbarItemContainer } from './container';
import { produce } from 'immer';
export interface ToolbarSelectButtonItem<T extends string = string> extends IToolbarItem {
    options: {
        key: T;
        icon: (
            props: React.SVGProps<SVGSVGElement> & {
                title?: string | undefined;
                titleId?: string | undefined;
            }
        ) => React.ReactNode;
        label: string;
        /** @default false */
        disabled?: boolean;
    }[];
    value: T;
    onSelect: (value: T) => void;
}

const ToolbarSelectButton = memo<IToolbarProps<ToolbarSelectButtonItem>>(function ToolbarSelectButton(props) {
    const { item, openedKey, setOpenedKey } = props;
    const { key, icon: Icon, disabled, options, value, onSelect, styles } = item;
    const id = `${key}::button`;

    const opened = openedKey === id;

    const currentOption = options.find((opt) => opt.key === value);
    // the button shows the selected option itself; the item icon is the fallback when nothing matches
    const ButtonIcon = currentOption?.icon ?? Icon;

    return (
        <DropdownMenu modal={false} open={opened} onOpenChange={(open) => (open ? setOpenedKey(id) : setOpenedKey(''))}>
            <ToolbarItemContainer
                {...props}
                item={produce(props.item, (draft) => {
                    if (currentOption) {
                        draft.label = `${draft.label}: ${currentOption.label}`;
                    }
                })}
            >
                <DropdownMenuTrigger disabled={disabled} asChild>
                    <Button className="relative" disabled={disabled} variant="none" size="toolbar">
                        <ButtonIcon className="w-[18px] h-[18px]" style={styles?.icon} />
                        <span
                            aria-hidden
                            className="absolute right-[3px] bottom-[3px] border-l-4 border-b-4 border-l-transparent border-b-current opacity-50"
                        />
                    </Button>
                </DropdownMenuTrigger>
            </ToolbarItemContainer>
            <DropdownMenuContent onCloseAutoFocus={e => e.preventDefault()}>
                <DropdownMenuRadioGroup value={value} onValueChange={onSelect}>
                    {options.map((option) => {
                        const OptionIcon = option.icon;
                        return (
                            <DropdownMenuRadioItem key={option.key} value={option.key} className="gap-2">
                                <OptionIcon className="w-[18px] h-[18px]" />
                                {option.label}
                            </DropdownMenuRadioItem>
                        );
                    })}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
});

export default ToolbarSelectButton;
