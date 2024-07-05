import { useContext, useState } from 'react';
import spec from '../specs/student-chart.json';
import { GraphicWalker, grayTheme, IChart } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerInModal() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button className="bg-slate-900 text-white px-4 py-2 rounded m-4" onClick={() => setOpen(true)}>
                Open
            </button>
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backdropFilter: 'blur(10px)',
                        zIndex: 9999,
                    }}
                >
                    <div
                        className="bg-white dark:bg-gray-950"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                        style={{
                            position: 'absolute',
                            borderRadius: 20,
                            border: '1px solid gray',
                            left: 80,
                            right: 80,
                            top: 80,
                            bottom: 80,
                            overflow: 'auto',
                            padding: 20,
                            boxSizing: 'border-box',
                        }}
                    >
                        <GraphicWalker uiTheme={grayTheme} fields={fields} data={dataSource} chart={spec as IChart[]} appearance={theme} />
                    </div>
                </div>
            )}
        </div>
    );
}
