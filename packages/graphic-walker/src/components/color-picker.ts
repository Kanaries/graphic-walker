import styled from 'styled-components';
import { SketchPicker } from 'react-color';

export const StyledPicker = styled(SketchPicker)<{ noShadow?: boolean; noBorder?: boolean }>`
    --tw-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);
    box-shadow: ${({ noShadow }) =>
        noShadow ? 'none' : 'var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)'} !important;
    border-color: hsl(var(--border)) !important;
    border-width: ${({ noBorder }) => (noBorder ? '0' : '1px')} !important;
    background: hsl(var(--popover)) !important;
    color: hsl(var(--popover-foreground)) !important;
    .flexbox-fix {
        border-color: hsl(var(--border)) !important;
    }
    label {
        color: hsl(var(--popover-foreground)) !important;
    }
    input {
        box-shadow: none !important;
        border-radius: calc(var(--radius) - 2px) !important;
        border: 1px solid hsl(var(--input)) !important;
        background-color: transparent !important;
        width: 100% !important;
    }
`;
