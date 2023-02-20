import { DraggableProvided } from "react-beautiful-dnd";

function getElementBoxInfo(ele: HTMLElement) {
    const style = window.getComputedStyle(ele);
    const borderLeft = parseInt(style.borderLeftWidth);
    const paddingLeft = parseInt(style.paddingLeft);
    const marginLeft = parseInt(style.marginLeft);
    const borderTop = parseInt(style.borderTopWidth);
    const paddingTop = parseInt(style.paddingTop);
    const marginTop = parseInt(style.marginTop);
    return {
        borderLeft,
        paddingLeft,
        marginLeft,
        borderTop,
        paddingTop,
        marginTop,
        style
    };
}

export function fixDraggableOffset(provided: DraggableProvided, containerDOM: HTMLElement | undefined | null) {
    if (typeof containerDOM === 'undefined' || containerDOM === null) return;
    const containerRect = containerDOM.getBoundingClientRect();
    const offset = { x: containerRect.left, y: containerRect.top };
    let parent: HTMLElement | null = containerDOM.parentElement;
    while (parent !== null) {
        const box = getElementBoxInfo(parent);
        const {
            borderLeft: parentBorderLeft,
            paddingLeft: parentPaddingLeft,
            marginLeft: parentMarginLeft,
            borderTop: parentBorderTop,
            paddingTop: parentPaddingTop,
            marginTop: parentMarginTop,
            style
        } = box;
        offset.x -= ( parentBorderLeft + parentPaddingLeft + parentMarginLeft);
        offset.y -= (parentBorderTop + parentPaddingTop + parentMarginTop);
        if (style.position === 'absolute' || style.position === 'fixed') {

            break;
        }
        
        parent = parent.parentElement;
    }
    const root = document.documentElement;
    const scrollTop = (window.pageYOffset || root.scrollTop) - (root.clientTop || 0);
    const scrollLeft = (window.pageXOffset || root.scrollLeft) - (root.clientLeft || 0);
    offset.y += scrollTop;
    offset.x += scrollLeft;
    //@ts-ignore
    const x = (provided.draggableProps.style.left! ?? 0) - offset.x;
    //@ts-ignore
    const y = (provided.draggableProps.style.top! ?? 0) - offset.y
    // TODO: Fix the offset error when there is a layer has padding between fixed layer and provided.draggableProps.style ele. 
    // the error seems to be 16px which is the pill's height
    // provided.draggableProps.style.height;// - 2 - 2 - 1 - 1;

    // @ts-ignore
    provided.draggableProps.style.left = x;
    // @ts-ignore
    provided.draggableProps.style.top = y;
}