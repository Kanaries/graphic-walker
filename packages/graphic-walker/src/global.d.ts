declare module '@kanaries/react-beautiful-dnd' {
    export const DOMProvider: import('react').Provider<{
        head: HTMLElement | ShadowRoot;
        body: HTMLElement | ShadowRoot;
    }>;
    export * from 'react-beautiful-dnd';
}
