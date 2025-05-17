import React, { useCallback, useState } from 'react';
import { FileReader } from '@kanaries/web-data-loader';
import { IRow } from '../../interfaces';
import Table from '../table';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import DropdownSelect from '../../components/dropdownSelect';
import { charsetOptions } from './config';
import { jsonReader } from './utils';
import { CommonStore } from '../../store/commonStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Dropzone from 'react-dropzone';

interface ICSVData {
    commonStore: CommonStore;
}
const CSVData: React.FC<ICSVData> = ({ commonStore }) => {
    const { tmpDSName, tmpDataSource, tmpDSRawFields } = commonStore;
    const [encoding, setEncoding] = useState<string>('utf-8');

    const onSubmitData = useCallback(() => {
        commonStore.commitTempDS();
    }, [commonStore]);

    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.file' });
    const fileLoaded = tmpDataSource.length > 0 && tmpDSRawFields.length > 0;

    const onFileDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (file) {
                const name = file.name.toLowerCase();
                const ext = name.endsWith('.json') ? 'json' : 'csv';
                if (ext === 'csv') {
                    FileReader.csvReader({
                        file,
                        config: { type: 'reservoirSampling', size: Infinity },
                        onLoading: () => {},
                        encoding,
                    }).then((data) => {
                        commonStore.updateTempDS(data as IRow[]);
                    });
                } else {
                    jsonReader(file).then((data) => {
                        commonStore.updateTempDS(data as IRow[]);
                    });
                }
            }
        },
        [commonStore, encoding]
    );

    return (
        <div className="min-h-[300px]">
            {!fileLoaded && (
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                        />
                    </svg>
                    <h3 className="mt-2 text-sm font-semibold text-foreground">{t('choose_file')}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t('get_start_desc')}</p>
                </div>
            )}
            {!fileLoaded && (
                <div className="my-1">
                    <div className="flex flex-col items-center gap-1 w-fit mx-auto">
                        <div className="flex w-full">
                            <Dropzone onDrop={onFileDrop} multiple={false}>
                                {({ getRootProps, getInputProps, isDragActive }) => (
                                    <div
                                        {...getRootProps()}
                                        className={`mr-2 flex items-center justify-center rounded border border-dashed h-10 px-4 cursor-pointer text-sm ${isDragActive ? 'bg-accent/20' : ''}`}
                                    >
                                        <input {...getInputProps({ accept: '.csv,.json' })} />
                                        {t('open')}
                                    </div>
                                )}
                            </Dropzone>
                            <div className="relative flex-grow">
                                <DropdownSelect
                                    className="w-full"
                                    options={charsetOptions}
                                    selectedKey={encoding}
                                    onSelect={(k) => {
                                        setEncoding(k);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {fileLoaded && (
                <div className="mb-2 mt-6">
                    <label className="block text-xs text-secondary-foreground mb-1 font-bold">{t('dataset_name')}</label>
                    <div className="flex space-x-2">
                        <Input
                            type="text"
                            placeholder={t('dataset_name')}
                            value={tmpDSName}
                            onChange={(e) => {
                                commonStore.updateTempName(e.target.value);
                            }}
                            className="text-xs placeholder:italic w-36"
                        />
                        <Button
                            disabled={tmpDataSource.length === 0}
                            onClick={() => {
                                onSubmitData();
                            }}
                        >
                            {t('submit')}
                        </Button>
                    </div>
                </div>
            )}
            {fileLoaded && <Table commonStore={commonStore} />}
        </div>
    );
};

export default observer(CSVData);
