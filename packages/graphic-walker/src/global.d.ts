declare module '@kanaries/react-beautiful-dnd' {
    export const DOM: {
        setHead: (head: HTMLElement | ShadowRoot) => void;
        setBody: (body: HTMLElement | ShadowRoot) => void;
    };
    export * from 'react-beautiful-dnd';
}
