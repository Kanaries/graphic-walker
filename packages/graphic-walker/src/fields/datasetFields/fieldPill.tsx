import styled from 'styled-components';

export const FieldPill = styled.div<{isDragging: boolean}>`
    /* transform: ${props => !props.isDragging && 'translate(0px, 0px) !important'}; */
    user-select: none;
    cursor: ${({ isDragging }) => isDragging ? 'grabbing' : 'grab'};
`