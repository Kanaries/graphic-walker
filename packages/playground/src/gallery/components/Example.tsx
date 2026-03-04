import React, { useContext, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/solid';
import { IChart, PureRenderer, GraphicWalker } from '@kanaries/graphic-walker';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { themeContext } from '../context';
import { GalleryItemOption } from './GalleryGroup';
import { specDict } from '../resources';
import { IDataSource, useFetch } from '../util';

function getResourceURL(type: 'datasets' | 'specs', name: string): string {
    if (type === 'specs') {
        return specDict[name];
    } else if (type === 'datasets') {
        return `https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/${name}.json`;
    } else {
        throw new Error(`Unknown fetch type: "${type}".`);
    }
}

interface ExampleProps {
    title: string;
    specName: string;
    datasetName: string;
}

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

function Dropdown({ showMode, setShowMode }: { showMode: 'preview' | 'editor'; setShowMode: (mode: 'preview' | 'editor') => void }) {
    return (
        <div className="absolute top-4 right-4 w-56 text-right z-10">
            <Menu as="div" className="relative inline-block text-left">
                <div>
                    <Menu.Button className="inline-flex w-full justify-center rounded-md px-4 py-2 text-sm font-medium bg-gray-950 text-white hover:bg-gray-800 dark:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75">
                        {showMode === 'preview' ? 'Preview' : 'Editor'}
                        <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                    </Menu.Button>
                </div>
                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 focus:outline-none">
                        <div className="px-1 py-1 ">
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => setShowMode('preview')}
                                        className={`${
                                            active ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-400'
                                        } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                    >
                                        Preview
                                    </button>
                                )}
                            </Menu.Item>
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => setShowMode('editor')}
                                        className={`${
                                            active ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-400'
                                        } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                    >
                                        Editor
                                    </button>
                                )}
                            </Menu.Item>
                        </div>
                    </Menu.Items>
                </Transition>
            </Menu>
        </div>
    );
}

function Example(props: ExampleProps) {
    const { title, specName, datasetName } = props;
    const { theme } = useContext(themeContext);
    const [showMode, setShowMode] = useState<'preview' | 'editor'>('preview');
    const datasetURL = getResourceURL('datasets', datasetName);
    const specsURL = getResourceURL('specs', specName);
    const { dataSource, fields } = useFetch<IDataSource>(datasetURL);
    const spec = useFetch<IChart[]>(specsURL);
    const chart = spec[0] as IChart;

    return (
        <div>
            <div className="flex gap-2 items-center">
                <Link to="..">
                    <button
                        type="button"
                        className="flex items-center justify-center rounded-md px-1 py-1 transition hover:bg-zinc-900/5 dark:text-white dark:hover:bg-white/5"
                    >
                        <ArrowUturnLeftIcon className="h-5 w-5" />
                    </button>
                </Link>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
            </div>

            <div className={classNames('relative', showMode === 'editor' ? 'mt-6 border dark:border-gray-600 rounded-md overflow-hidden' : '')}>
                <Dropdown showMode={showMode} setShowMode={setShowMode} />
                {showMode === 'preview' && (
                    <>
                        <PureRenderer
                            className="mt-6 border dark:border-gray-600 rounded-md overflow-hidden"
                            rawData={dataSource}
                            visualConfig={chart.config}
                            visualState={chart.encodings}
                            visualLayout={chart.layout}
                            appearance={theme}
                        />
                        <h2 className="mt-16 mb-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Graphic Walker JSON Specification</h2>
                        <SyntaxHighlighter language="tsx" style={a11yDark}>
                            {JSON.stringify(spec, null, 2)}
                        </SyntaxHighlighter>
                    </>
                )}

                {showMode === 'editor' && <GraphicWalker fields={fields} data={dataSource} chart={spec} appearance={theme} />}
            </div>
        </div>
    );
}

export default function ExampleWrapper(props: { options: GalleryItemOption }) {
    const { options } = props;
    return (
        <React.Suspense fallback={<p>Loading component...</p>}>
            <Example title={options.title} specName={options.id} datasetName={options.datasetName} />
        </React.Suspense>
    );
}
