import React from 'react';

export function ConfigItemContainer(props: { children?: React.ReactNode; className?: string }) {
    return <div className="border p-4 m-4 rounded-lg">{props.children}</div>;
}

export function ConfigItemContent(props: { children?: React.ReactNode }) {
    return <div className="border-t mt-4 pt-4">{props.children}</div>;
}

export function ConfigItemHeader(props: { children?: React.ReactNode }) {
    return <div className="text-xs text-muted-foreground font-medium">{props.children}</div>;
}

export function ConfigItemTitle(props: { children?: React.ReactNode }) {
    return <h2 className="text-xl text-foreground font-medium">{props.children}</h2>;
}
