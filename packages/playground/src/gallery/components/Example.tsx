import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { IChart, PureRenderer } from '@kanaries/graphic-walker';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { themeContext } from '../context';
import { IGalleryItem } from './GalleryGroup';
import { specDict } from '../resources';
import { IDataSource, useFetch } from '../util';

function getResourceURL(type: "datasets" | "specs", name: string): string {
    if (type === "specs") {
        return specDict.get(name)!;
    } else if (type === "datasets") {
        return `https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/${name}.json`;
    } else {
        throw new Error(`Unknown fetch type: "${type}".`);
    }
}

const BackButton = () =>
    <button type="button" className="flex items-center justify-center rounded-md px-1 py-1 transition hover:bg-zinc-900/5 dark:text-white dark:hover:bg-white/5">
        <ArrowUturnLeftIcon className="h-4 w-4"/>
    </button>;

interface ExampleProps {
    title: string,
    specName: string,
    datasetName: string,
}

function Example(props: ExampleProps) {
    const {
        title,
        specName,
        datasetName,
    } = props;
    const { theme } = useContext(themeContext);
    const datasetURL = getResourceURL("datasets", datasetName);
    const specsURL = getResourceURL("specs", specName);
    const { dataSource } = useFetch<IDataSource>(datasetURL);
    const spec = useFetch<IChart[]>(specsURL);
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
                specName={options.name}
                datasetName={options.datasetName}
            />
        </React.Suspense>
    );
}
