import { useContext } from 'react';
import { IDataQueryPayload, IDataQueryWorkflowStep, TableWalker, getComputation } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';

export default function GraphicWalkerComponent() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');

    const computation = getComputation(dataSource);

    const cleaned = dataSource.map((x) => ({ ...x, gender_cleaned: Math.random() > 0.9 ? 'cleaned' : Math.random() > 0.9 ? 'erased' : x.gender }));

    const cleanedComputation = getComputation(cleaned);
    const dropped = cleaned.filter((x) => x.gender_cleaned !== 'cleaned');

    const wrappedComputation = (payload: IDataQueryPayload) => {
        return computation({
            ...payload,
            workflow: ([] as IDataQueryWorkflowStep[])
                .concat([
                    {
                        type: 'transform',
                        transform: [
                            {
                                key: 'gender_cleaned',
                                expression: {
                                    op: 'expr',
                                    as: 'gender_cleaned',
                                    params: [{ type: 'sql', value: 'gender' }],
                                },
                            },
                        ],
                    },
                ])
                .concat(payload.workflow),
        });
    };

    const cleanedDroppedComputation = getComputation(dropped);

    return (
        <TableWalker
            fields={fields.flatMap((x) =>
                x.fid === 'gender'
                    ? [
                          { ...x, disable: true },
                          {
                              ...x,
                              fid: `${x.fid}_cleaned`,
                              name: x.name ?? x.fid,
                          },
                      ]
                    : [x]
            )}
            computation={cleanedComputation}
            cellStyle={(v, field, row, darkMode) => {
                if (row['gender_cleaned'] === 'cleaned') {
                    return { backgroundColor: darkMode ? '#991b1b' : '#fecaca' };
                }
                if (field.fid.endsWith('_cleaned') && `${v}` !== `${row[field.fid.replace('_cleaned', '')]}`) {
                    return { backgroundColor: darkMode ? '#a16207' : '#fef9c3' };
                }
                if (v === 'none') return { backgroundColor: darkMode ? '#a16207' : '#fef9c3' };
                return {};
            }}
            profilingComputation={[wrappedComputation, cleanedDroppedComputation]}
            appearance={theme}
            pageSize={50}
        />
    );
}
