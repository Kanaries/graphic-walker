import { useContext, useRef } from 'react';
import { getComputation, IVisFilter, TableWalker } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    const tableRef = useRef<{ getFilters: () => IVisFilter[] }>(null);

    const downloadCSV = async () => {
        const filters = tableRef.current?.getFilters() ?? [];

        // or use a remote computation service
        // const computation = async (workflow) => fetch(endPoint, { body: JSON.stringify(workflow) }).then(resp => resp.json())
        const computation = getComputation(dataSource);

        const result = await computation({
            workflow: [
                { type: 'filter', filters },
                {
                    type: 'view',
                    query: [
                        {
                            op: 'raw',
                            fields: fields.map((x) => x.fid),
                        },
                    ],
                },
            ],
        });

        const header = fields.map((x) => x.name).join(',');
        const data = result
            .map((row) =>
                fields
                    .map((x) => row[x.fid] ?? '')
                    .map((x) => (typeof x === 'string' ? `"${x}"` : `${x}`))
                    .join(',')
            )
            .join('\n');
        const blob = new Blob([header + '\n' + data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Student.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={downloadCSV}
                className="h-9 px-4 py-2 w-fit m-2 bg-zinc-950 text-white shadow hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
                Export CSV
            </button>
            <TableWalker tableFilterRef={tableRef} fields={fields} data={dataSource} appearance={theme} pageSize={50} vizThemeConfig="g2" />
        </div>
    );
}
