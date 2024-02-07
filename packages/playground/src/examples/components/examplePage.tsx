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
            <div className="text-xl font-bold">{props.name}</div>
            {props.desc && <div className="text-xs mt-1">{props.desc}</div>}
            <React.Suspense fallback={<p>Loading component...</p>}>
                <div
                    style={{
                        width: '100%',
                        height: '80vh',
                        flexShrink: 0,
                        border: '1px solid gray',
                        marginTop: 24,
                        overflow: 'auto',
                        position: 'relative',
                        ...props.style,
                    }}
                >
                    {props.children}
                </div>
            </React.Suspense>

            <SyntaxHighlighter language="tsx" style={a11yDark}>
                {props.code}
            </SyntaxHighlighter>
        </div>
    );
}
