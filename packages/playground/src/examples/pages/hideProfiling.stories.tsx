import { useContext, useState } from 'react';
import { GraphicWalker, TableWalker } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    const [tab, setTab] = useState('chart');
    const [hideProfiling, setHideProfiling] = useState(true);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                <button className="bg-slate-900 text-white px-4 py-2 rounded m-4" onClick={() => setHideProfiling(!hideProfiling)}>
                    Toggle Profiling {hideProfiling ? 'On' : 'Off'}
                </button>
                <button
                    className={tab === 'chart' ? 'bg-slate-900 text-white px-4 py-2 rounded m-4' : 'bg-gray-200 text-gray-800 px-4 py-2 rounded m-4'}
                    onClick={() => setTab('chart')}
                >
                    Graphic Walker
                </button>
                <button
                    className={tab === 'table' ? 'bg-slate-900 text-white px-4 py-2 rounded m-4' : 'bg-gray-200 text-gray-800 px-4 py-2 rounded m-4'}
                    onClick={() => setTab('table')}
                >
                    Table
                </button>
            </div>
            {tab === 'chart' ? (
                <GraphicWalker hideProfiling={hideProfiling} fields={fields} data={dataSource} appearance={theme} vizThemeConfig="g2" />
            ) : (
                <TableWalker hideProfiling={hideProfiling} fields={fields} data={dataSource} appearance={theme} />
            )}
        </div>
    );
}
