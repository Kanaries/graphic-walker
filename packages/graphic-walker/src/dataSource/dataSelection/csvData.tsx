import React, { useRef, useCallback, useState } from 'react';
import { FileReader } from '@kanaries/web-data-loader';
import { IRow } from '../../interfaces';
import Table from '../table';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import DropdownSelect from '../../components/dropdownSelect';
import { SUPPORTED_FILE_TYPES, charsetOptions } from './config';
import { classNames } from '../../utils';
import { RadioGroup } from '@headlessui/react';
import { jsonReader } from './utils';
import { CommonStore } from '../../store/commonStore';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ICSVData {
    commonStore: CommonStore;
}
const CSVData: React.FC<ICSVData> = ({ commonStore }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const { tmpDSName, tmpDataSource, tmpDSRawFields } = commonStore;
    const [encoding, setEncoding] = useState<string>('utf-8');
    const [fileType, setFileType] = useState<string>('csv');

    const onSubmitData = useCallback(() => {
        commonStore.commitTempDS();
    }, [commonStore]);

    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.file' });
    const fileLoaded = tmpDataSource.length > 0 && tmpDSRawFields.length > 0;

    const fileUpload = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files !== null) {
                const file = files[0];
                if (fileType === 'csv') {
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
        [commonStore, fileType, encoding]
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
            <input style={{ display: 'none' }} type="file" ref={fileRef} onChange={fileUpload} />
            {!fileLoaded && (
                <div className="my-1">
                    <div className="flex flex-col items-center gap-1 w-fit mx-auto">
                        <div className="w-full">
                            <RadioGroup value={fileType} onChange={setFileType} className="mt-2">
                                <RadioGroup.Label className="sr-only"> Choose a memory option </RadioGroup.Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {SUPPORTED_FILE_TYPES.map((option) => (
                                        <RadioGroup.Option
                                            key={option.value}
                                            value={option.value}
                                            className={({ checked }) =>
                                                classNames(
                                                    buttonVariants({
                                                        variant: checked ? 'default' : 'outline',
                                                        className: checked ? 'border-transparent' : '',
                                                    }),
                                                    'cursor-pointer px-8 border'
                                                )
                                            }
                                        >
                                            <RadioGroup.Label as="span">{option.label}</RadioGroup.Label>
                                        </RadioGroup.Option>
                                    ))}
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="flex w-full">
                            <Button
                                className="mr-2"
                                variant="outline"
                                onClick={() => {
                                    if (fileRef.current) {
                                        fileRef.current.click();
                                    }
                                }}
                            >
                                {t('open')}
                            </Button>
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
