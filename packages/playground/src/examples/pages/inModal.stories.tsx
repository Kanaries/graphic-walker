import { useContext, useEffect, useRef } from 'react';
import spec from '../specs/student-chart.json';
import { GraphicWalker, VizSpecStore, grayTheme } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerInModal() {
    const ref = useRef<VizSpecStore>(null);
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://chspace.oss-cn-hongkong.aliyuncs.com/api/ds-students-service.json');

    useEffect(() => {
        setTimeout(() => {
            if (ref.current) {
                ref.current.importCode(spec as never);
            }
        }, 0);
    }, []);
    return (
        <div
            style={{
                position: 'fixed',
                left: 30,
                right: 30,
                top: 30,
                bottom: 30,
                borderRadius: 20,
                border: '1px solid gray',
                overflow: 'hidden',
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
                <GraphicWalker colorConfig={grayTheme} rawFields={fields} dataSource={dataSource} storeRef={ref} dark={theme} />
            </div>
        </div>
    );
}
