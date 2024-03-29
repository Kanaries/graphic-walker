import { useContext, useEffect, useRef } from 'react';
import spec from '../specs/student-chart.json';
import { GraphicWalker, VizSpecStore, grayTheme } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerInModal() {
    const ref = useRef<VizSpecStore>(null);
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    useEffect(() => {
        setTimeout(() => {
            if (ref.current) {
                ref.current.importCode(spec as never);
            }
        }, 0);
    }, []);
    return (
        <div
            className='bg-white dark:bg-gray-950'
            style={{
                position: 'fixed',
                left: 80,
                right: 80,
                top: 80,
                bottom: 80,
                borderRadius: 20,
                border: '1px solid gray',
                overflow: 'hidden',
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    padding: 20,
                    boxSizing: 'border-box',
                }}
            >
                <GraphicWalker uiTheme={grayTheme} fields={fields} data={dataSource} storeRef={ref} appearance={theme} />
            </div>
        </div>
    );
}
