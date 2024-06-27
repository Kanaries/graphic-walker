import React from 'react';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { IChart, PureRenderer } from '@kanaries/graphic-walker';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { IDataSource, promiseWrapper } from '../util';
import { useContext } from 'react';
import { themeContext } from '../context';
import { Link } from 'react-router-dom';
import { IGalleryItem } from './GalleryGroup';

interface ExampleProps {
    title: string,
    dataURL: string,
    specURL: string,
}

const cache: Map<string, () => unknown> = new Map();
function useFetch<T>(folder: "datasets" | "specs", name: string): T {
    const key = folder + '-' + name;
    if (!cache.has(key)) {
        cache.set(key, promiseWrapper(import(`../${folder}/${name}.json`).then(module => module.default)));
    }
    return cache.get(key)!() as T;
}

const BackButton = () =>
    <button type="button" className="flex items-center justify-center rounded-md px-1 py-1 transition hover:bg-zinc-900/5 dark:text-white dark:hover:bg-white/5">
        <ArrowUturnLeftIcon className="h-4 w-4"/>
    </button>;

function Example(props: ExampleProps) {
    const {
        title,
        dataURL,
        specURL,
    } = props;
    const { theme } = useContext(themeContext);
    const { dataSource } = useFetch<IDataSource>("datasets", dataURL);
    const spec = useFetch<IChart[]>("specs", specURL);
    const chart = spec[0] as IChart;

    return (
        <div>
            <div className="flex gap-2 items-center">
                <Link to={".."}><BackButton /></Link>
                <span className="text-xl font-bold text-black dark:text-white">{title}</span>
            </div>

            <PureRenderer
                className="my-6"
                rawData={dataSource} 
                visualConfig={chart.config}
                visualState={chart.encodings} 
                visualLayout={chart.layout} 
                appearance={theme}
            />
            <div className="text-lg font-bold text-black dark:text-white">Graphic Walker JSON Specification</div>
            <SyntaxHighlighter language="tsx" style={a11yDark}>
                {JSON.stringify(spec, null, 2)}
            </SyntaxHighlighter>
        </div>
    )
}

export default function ExampleWrapper(props: {
    options: IGalleryItem,
}) {
    const { options } = props; 
    return (
        <React.Suspense fallback={<p>Loading component...</p>}>
            <Example
                title={options.title}
                dataURL={options.datasetName || `../datasets/ds-${options.name}.json`}
                specURL={options.specName || `../specs/${options.name}.json`}
            />
        </React.Suspense>
    );
}
