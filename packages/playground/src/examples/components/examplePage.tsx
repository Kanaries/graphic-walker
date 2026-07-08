import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function Example(props: {
    style?: React.CSSProperties;
    name: string;
    desc?: string;
    code: string;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}) {
    return (
        <div className="flex flex-col text-gray-900 dark:text-white">
            <h1 className="text-2xl font-bold tracking-tight">{props.name}</h1>
            {props.desc && <p className="mt-1.5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">{props.desc}</p>}
            <React.Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading component...</p>}>
                <div
                    className="mt-6 w-full shrink-0 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    style={{ height: '80vh', position: 'relative', ...props.style }}
                >
                    {props.children}
                </div>
            </React.Suspense>

            <details open className="mt-6">
                <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                    Source code
                </summary>
                <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <SyntaxHighlighter language="tsx" style={a11yDark} customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem' }}>
                        {props.code}
                    </SyntaxHighlighter>
                </div>
            </details>
        </div>
    );
}
