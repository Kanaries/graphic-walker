import React, { useRef, useCallback, useState } from 'react';
import { FileReader } from '@kanaries/web-data-loader';
import { ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { IRow } from '../../interfaces';
import DropdownSelect from '../../components/dropdownSelect';
import Spinner from '../../components/spinner';
import { classNames } from '../../utils';
import { charsetOptions } from './config';
import { jsonReader } from './utils';
import { CommonStore } from '../../store/commonStore';

interface IFileUploadProps {
    commonStore: CommonStore;
}

const FileUpload: React.FC<IFileUploadProps> = ({ commonStore }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const dragCountRef = useRef(0);
    const [dragOver, setDragOver] = useState(false);
    const [parsingFile, setParsingFile] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [encoding, setEncoding] = useState<string>('utf-8');

    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.file' });

    const loadFile = useCallback(
        (file: File) => {
            const name = file.name;
            const lowerName = name.toLowerCase();
            const isJSON = lowerName.endsWith('.json');
            const isCSV = lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt');
            if (!isJSON && !isCSV) {
                setError(t('unsupported', { file: name }));
                return;
            }
            setError(null);
            setParsingFile(name);
            const parsed: Promise<unknown> = isJSON
                ? jsonReader(file)
                : (FileReader.csvReader({
                      file,
                      config: { type: 'reservoirSampling', size: Infinity },
                      onLoading: () => {},
                      encoding,
                  }) as Promise<unknown>);
            parsed
                .then((data) => {
                    if (!Array.isArray(data) || data.length === 0) {
                        throw new Error('empty data');
                    }
                    commonStore.updateTempDS(data as IRow[]);
                    commonStore.updateTempName(name.replace(/\.(csv|tsv|txt|json)$/i, ''));
                })
                .catch(() => {
                    setError(t('read_error', { file: name }));
                })
                .finally(() => {
                    setParsingFile(null);
                });
        },
        [commonStore, encoding, t]
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            dragCountRef.current = 0;
            setDragOver(false);
            if (parsingFile) return;
            const file = e.dataTransfer.files?.[0];
            if (file) {
                loadFile(file);
            }
        },
        [loadFile, parsingFile]
    );

    const openFilePicker = useCallback(() => {
        if (!parsingFile && fileRef.current) {
            fileRef.current.click();
        }
    }, [parsingFile]);

    return (
        <div className="flex flex-col gap-2">
            <input
                style={{ display: 'none' }}
                type="file"
                ref={fileRef}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        loadFile(file);
                    }
                    e.target.value = '';
                }}
                accept=".csv,.tsv,.txt,.json"
            />
            <div
                role="button"
                tabIndex={0}
                aria-label={t('drop_title')}
                className={classNames(
                    'flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-6 py-10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    parsingFile ? 'cursor-wait' : 'cursor-pointer',
                    dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-accent/50'
                )}
                onClick={openFilePicker}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFilePicker();
                    }
                }}
                onDragEnter={(e) => {
                    e.preventDefault();
                    dragCountRef.current += 1;
                    setDragOver(true);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    dragCountRef.current -= 1;
                    if (dragCountRef.current <= 0) {
                        dragCountRef.current = 0;
                        setDragOver(false);
                    }
                }}
                onDrop={onDrop}
            >
                {parsingFile ? (
                    <>
                        <Spinner className="h-8 w-8 text-primary" />
                        <p className="mt-2 font-medium text-foreground">{t('parsing', { file: parsingFile })}</p>
                    </>
                ) : (
                    <>
                        <ArrowUpTrayIcon className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 font-medium text-foreground">{t('drop_title')}</p>
                        <p className="text-xs text-muted-foreground">{t('drop_desc')}</p>
                    </>
                )}
            </div>
            <div className="flex items-start justify-between gap-4">
                {error ? (
                    <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                        <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                        {error}
                    </p>
                ) : (
                    <span />
                )}
                <div className="flex shrink-0 items-center gap-2">
                    <label className="text-xs text-muted-foreground">{t('charset')}</label>
                    <DropdownSelect
                        className="text-xs !h-7"
                        options={charsetOptions}
                        selectedKey={encoding}
                        onSelect={setEncoding}
                    />
                </div>
            </div>
        </div>
    );
};

export default observer(FileUpload);
