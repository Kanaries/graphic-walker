import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVizStore } from '../../store';
import DefaultButton from '../button/default';
import PrimaryButton from '../button/primary';
import Modal from '../modal';
import { isNotEmpty, parseErrorMessage } from '../../utils';
import { highlightField } from '../highlightField';
import { aggFuncs, reservedKeywords, sqlFunctions } from '../../lib/sql';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID } from '../../constants';
import { unstable_batchedUpdates } from 'react-dom';

const keywordRegex = new RegExp(`\\b(${Array.from(reservedKeywords).join('|')})\\b`, 'gi');
const bulitInRegex = new RegExp(`\\b(${Array.from(sqlFunctions).join('|')})(\\s*)\\(`, 'gi');
const aggBultinRegex = new RegExp(`\\b(${Array.from(aggFuncs).join('|')})(\\s*)\\(`, 'gi');

const stringRegex = /('[^']*'?)/g;

const ComputedFieldDialog: React.FC = observer(() => {
    const vizStore = useVizStore();
    const { editingComputedFieldFid } = vizStore;
    const [name, setName] = useState<string>('');
    const [sql, setSql] = useState<string>('');
    const [error, setError] = useState<string>('');
    const ref = useRef<{ clear(): void; setValue(v: string): void }>(null);

    const SQLField = useMemo(() => {
        const fieldRegex = new RegExp(
            `\\b(${vizStore.allFields
                .filter((x) => ![COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID].includes(x.fid))
                .map((x) => x.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
                .join('|')})\\b`,
            'gi'
        );
        return highlightField((sql: string) => {
            // highlight keyword
            sql = sql.replace(keywordRegex, '<span class="text-fuchsia-700 dark:text-fuchsia-600">$1</span>');

            // highlight function
            sql = sql.replace(bulitInRegex, '<span class="text-yellow-700 dark:text-yellow-600">$1</span>$2(');

            // highlight agg function
            sql = sql.replace(aggBultinRegex, '<span class="text-amber-700 dark:text-amber-600">$1</span>$2(');

            // highlight string
            sql = sql.replace(stringRegex, '<span class="text-green-700 dark:text-green-600">$1</span>');

            // highlight field
            sql = sql.replace(fieldRegex, '<span class="text-blue-700 dark:text-blue-600">$1</span>');

            return sql;
        });
    }, [vizStore.allFields]);

    useEffect(() => {
        if (isNotEmpty(editingComputedFieldFid)) {
            if (editingComputedFieldFid === '') {
                let idx = 1;
                while (vizStore.allFields.find((x) => x.name === `Computed ${idx}`)) {
                    idx++;
                }
                unstable_batchedUpdates(() => {
                    setName(`Computed ${idx}`);
                    setSql('');
                    setError('');
                });
                ref.current?.clear();
            } else {
                const f = vizStore.allFields.find((x) => x.fid === editingComputedFieldFid);
                if (!f || !f.computed || f.expression?.op !== 'expr') {
                    vizStore.setComputedFieldFid('');
                    return;
                }
                const sql = f.expression.params.find((x) => x.type === 'sql');
                if (!sql) {
                    vizStore.setComputedFieldFid('');
                    return;
                }
                unstable_batchedUpdates(() => {
                    setName(f.name);
                    setSql(sql.value);
                    setError('');
                });
                ref.current?.setValue(sql.value);
            }
        }
    }, [editingComputedFieldFid, vizStore]);

    return (
        <Modal
            show={isNotEmpty(editingComputedFieldFid)}
            onClose={() => {
                vizStore.setComputedFieldFid();
            }}
        >
            <div className="flex flex-col space-y-2">
                <div>
                    <div className="text-xl font-bold">{editingComputedFieldFid === '' ? 'Add Computed Field' : 'Edit Computed Field'}</div>
                    <span className="text-xs text-gray-500">
                        Computed fields guide:{' '}
                        <a
                            target="_blank"
                            className="underline text-indigo-500"
                            href="https://github.com/Kanaries/graphic-walker/wiki/How-to-Create-Computed-field-in-Graphic-Walker"
                        >
                            read here
                        </a>
                    </span>
                </div>
                <div className="flex flex-col space-y-2">
                    <label className="text-ml whitespace-nowrap">Name</label>
                    <input
                        type="text"
                        className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                        }}
                    />
                    <label className="text-ml whitespace-nowrap">SQL</label>
                    <SQLField ref={ref} onChange={setSql} placeholder="Enter SQL..." />
                </div>
                {error && <div className="text-xs text-red-500">{error}</div>}
                <div className="flex justify-end space-x-2">
                    <PrimaryButton
                        text={editingComputedFieldFid === '' ? 'Add' : 'Edit'}
                        onClick={() => {
                            try {
                                vizStore.upsertComputedField(editingComputedFieldFid!, name, sql);
                                vizStore.setComputedFieldFid();
                            } catch (e) {
                                setError(parseErrorMessage(e));
                            }
                        }}
                    ></PrimaryButton>
                    <DefaultButton text="Cancel" onClick={() => vizStore.setComputedFieldFid()}></DefaultButton>
                </div>
            </div>
        </Modal>
    );
});

export default ComputedFieldDialog;
