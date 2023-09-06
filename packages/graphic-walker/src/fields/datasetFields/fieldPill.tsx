import styled from 'styled-components';

/**
 * react-beautiful-dnd v13.1.0 bug
 * https://github.com/atlassian/react-beautiful-dnd/issues/2361
 */
export const FieldPill = styled.div<{isDragging: boolean}>`
    transform: ${props => !props.isDragging && 'translate(0px, 0px) !important'};
    user-select: none;
    align-items: center;
    overflow: hidden;
    > *:not(span) {
        flex: 0 0 unset;
    }
    > span {
        flex: 1;
        display: inline-block;
        padding-inline: 0.1em;
        /* truncate */
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    :has([role="button"]:hover) {
        background-color: unset;
    }
`