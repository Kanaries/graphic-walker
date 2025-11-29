import { observer } from 'mobx-react-lite';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useVizStore } from '../../store';
import { isNotEmpty, parseErrorMessage } from '../../utils';
import { highlightField } from '../highlightField';
import { aggFuncs, reservedKeywords, sqlFunctions } from '../../lib/sql';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID } from '../../constants';
import { unstable_batchedUpdates } from 'react-dom';
import { Dialog, DialogContent } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const keywordRegex = new RegExp(`\\b(${Array.from(reservedKeywords).join('|')})\\b`, 'gi');
const bulitInRegex = new RegExp(`\\b(${Array.from(sqlFunctions).join('|')})(\\s*)\\(`, 'gi');
const aggBultinRegex = new RegExp(`\\b(${Array.from(aggFuncs).join('|')})(\\s*)\\(`, 'gi');

const stringRegex = /('[^']*'?)/g;

const ComputedFieldDialog: React.FC = observer(() => {
    const vizStore = useVizStore();
    const { editingComputedFieldFid } = vizStore;
    const [inputMode, setInputMode] = useState<'nlp' | 'sql'>('nlp');
    const [nlPrompt, setNlPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState<string>('');
    const [sql, setSql] = useState<string>('');
    const [error, setError] = useState<string>('');
    const ref = useRef<HTMLDivElement>(null);

    // List available fields for display
    const availableFields = useMemo(
        () =>
            vizStore.allFields
                .filter((f) => ![COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID].includes(f.fid))
                .map((f) => ({
                    name: f.name,
                    type: f.semanticType || f.analyticType  || 'unknown',
                })),
        [vizStore.allFields]
    );

    const SQLField = useMemo(() => {
        const fields = vizStore.allFields
            .filter((x) => ![COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID].includes(x.fid))
            .map((x) => x.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
            .join('|');
        const fieldRegex = fields.length > 0 ? new RegExp(`\\b(${fields})\\b`, 'gi') : null;
        return highlightField((sql: string) => {
            // highlight field
            if (fieldRegex) {
                sql = sql.replace(fieldRegex, '<span class="text-blue-700 dark:text-blue-600">$1</span>');
            }

            // highlight keyword
            sql = sql.replace(keywordRegex, '<span class="text-fuchsia-700 dark:text-fuchsia-600">$1</span>');

            // highlight function
            sql = sql.replace(bulitInRegex, '<span class="text-yellow-700 dark:text-yellow-600">$1</span>$2(');

            // highlight agg function
            sql = sql.replace(aggBultinRegex, '<span class="text-amber-700 dark:text-amber-600">$1</span>$2(');

            // highlight string
            sql = sql.replace(stringRegex, '<span class="text-green-700 dark:text-green-600">$1</span>');

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
                    setNlPrompt('');
                    setError('');
                    setInputMode('nlp');
                });
                ref.current && (ref.current.innerHTML = '');
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
                    setNlPrompt('');
                    setError('');
                    setInputMode('sql');
                });
                ref.current && (ref.current.innerHTML = sql.value);
            }
        }
    }, [editingComputedFieldFid, vizStore]);

    // Sync the contentEditable div when SQL state changes
    useEffect(() => {
        if (ref.current && inputMode === 'sql') {
            ref.current.textContent = sql;
        }
    }, [sql, inputMode]);

    if (!isNotEmpty(editingComputedFieldFid)) return null;

    // NLP "Generate SQL" handler
    const handleGenerateSql = async () => {
        setLoading(true);
        setError('');
        try {
            // Build schema info like you show in the UI
            const columnsText = availableFields.map((f) => `${f.name} (${f.type})`).join(', ');
            const grokPrompt = `
            You are a sql expert. The dataset has the following columns: ${columnsText}.
            User wants to: ${nlPrompt}

            Requirements:
            - Output ONLY a valid SQL expression for a computed field (no SELECT/FROM/explanation).
            - Use CASE WHEN ... THEN ... ELSE ... END if logic needed.
            - Protect against divide by zero.
            - Example: case when full_price > 0 then discounted_price / full_price else 0 end
            Now, give only the computed field SQL.
            `;
            // Call the Ollama NLP backend
            const res = await fetch('/api/ollama-text2sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: grokPrompt }),
            });
            const data = await res.json();

            if (data.sql) {
                setSql(data.sql);
                setInputMode('sql');
                // Update the contentEditable div content
                if (ref.current) {
                    ref.current.textContent = data.sql;
                }
            } else if (data.error) {
                // Enhanced error handling with specific error messages
                const errorMessage = data.details ? `${data.error}: ${data.details}` : data.error;
                setError(`Failed to generate SQL: ${errorMessage}`);
            } else {
                setError('No SQL generated.');
            }
        } catch (e) {
            console.error('SQL generation error:', e);
            setError('Failed to generate SQL. Please check if the Ollama service is running.');
        }
        setLoading(false);
    };

    return (
        <Dialog
            open={true}
            onOpenChange={() => {
                vizStore.setComputedFieldFid();
            }}
        >
            <DialogContent>
                <div className="flex flex-col space-y-2">
                    <div>
                        <div className="text-xl font-bold">{editingComputedFieldFid === '' ? 'Add Computed Field' : 'Edit Computed Field'}</div>
                        <span className="text-xs text-muted-foreground">
                            Computed fields guide:{' '}
                            <a
                                target="_blank"
                                className="underline text-primary"
                                href="https://github.com/Kanaries/graphic-walker/wiki/How-to-Create-Computed-field-in-Graphic-Walker"
                            >
                                read here
                            </a>
                        </span>
                    </div>
                    {/* MODE TOGGLE */}
                    <div className="flex gap-2 mt-2 mb-2">
                        <Button variant={inputMode === 'nlp' ? 'default' : 'outline'} onClick={() => setInputMode('nlp')}>
                            Natural Language
                        </Button>
                        <Button variant={inputMode === 'sql' ? 'default' : 'outline'} onClick={() => setInputMode('sql')}>
                            SQL
                        </Button>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-ml whitespace-nowrap">Name</label>
                        <Input
                            type="text"
                            value={name}
                            placeholder="Enter Field Name..."
                            onChange={(e) => {
                                setName(e.target.value);
                            }}
                        />
                        {/* NLP MODE WITH FIELD NAMES */}
                        {inputMode === 'nlp' && (
                            <>
                                {/* FIELD LIST FOR USER */}
                                <div className="mb-1 text-xs">
                                    <span className="font-bold">Available Fields:&nbsp;</span>
                                    {availableFields.length === 0 && <span className="italic text-muted-foreground">No fields detected.</span>}
                                    {availableFields.length > 0 && (
                                        <ul className="list-disc list-inside text-xs pl-2">
                                            {availableFields.map((f) => (
                                                <li key={f.name}>
                                                    <span className="font-mono">{f.name}</span>
                                                    <span className="text-gray-500"> (type: {f.type})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <label className="text-ml whitespace-nowrap">Describe computed field</label>
                                <Input
                                    value={nlPrompt}
                                    onChange={(e) => setNlPrompt(e.target.value)}
                                    placeholder="e.g. Calculate profit as revenue minus cost"
                                    disabled={loading}
                                />
                                <div>
                                    <Button onClick={handleGenerateSql} disabled={!nlPrompt || loading}>
                                        {loading ? 'Generating...' : 'Generate SQL'}
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* SQL MODE */}
                        {inputMode === 'sql' && (
                            <>
                                <label className="text-ml whitespace-nowrap">SQL</label>
                                <SQLField ref={ref} value={sql} onChange={setSql} placeholder="Enter SQL expression..." />
                            </>
                        )}
                    </div>
                    {error && <div className="text-xs text-red-500">{error}</div>}
                    <div className="flex justify-end space-x-2">
                        <Button
                            disabled={!sql || !name}
                            children={editingComputedFieldFid === '' ? 'Add' : 'Edit'}
                            onClick={() => {
                                try {
                                    vizStore.upsertComputedField(editingComputedFieldFid!, name, sql);
                                    vizStore.setComputedFieldFid();
                                } catch (e) {
                                    setError(parseErrorMessage(e));
                                }
                            }}
                        />
                        <Button variant="outline" children="Cancel" onClick={() => vizStore.setComputedFieldFid()} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});

export default ComputedFieldDialog;
