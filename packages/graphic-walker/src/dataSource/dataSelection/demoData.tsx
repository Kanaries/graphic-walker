import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DemoDataAssets, PUBLIC_DATA_LIST, IPublicData } from '../config';
import { classNames } from '../../utils';
import Spinner from '../../components/spinner';
import { CommonStore } from '../../store/commonStore';

interface IDemoDataProps {
    commonStore: CommonStore;
}

const DemoData: React.FC<IDemoDataProps> = ({ commonStore }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'DataSource.dialog.public' });
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadDataset = async (data: IPublicData) => {
        if (loadingKey) return;
        setError(null);
        setLoadingKey(data.key);
        try {
            const response = await fetch(DemoDataAssets[data.key]);
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }
            const res = await response.json();
            commonStore.updateTempSTDDS({
                dataSource: res.dataSource,
                rawFields: res.fields.map((f) => ({
                    fid: f.fid,
                    name: f.name,
                    analyticType: f.analyticType,
                    semanticType: f.semanticType,
                    dataType: f.dataType || '?',
                })),
                name: data.title,
            });
        } catch (err) {
            console.error('Error fetching public data:', err);
            setError(t('fetch_error', { name: data.title }));
        } finally {
            setLoadingKey(null);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {error && (
                <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    {error}
                </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PUBLIC_DATA_LIST.map((data) => {
                    const isLoading = loadingKey === data.key;
                    return (
                        <button
                            key={data.key}
                            type="button"
                            disabled={loadingKey !== null && !isLoading}
                            aria-busy={isLoading}
                            onClick={() => loadDataset(data)}
                            className={classNames(
                                'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isLoading ? 'border-primary bg-accent' : 'hover:border-primary/50 hover:bg-accent',
                                'disabled:cursor-default disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent'
                            )}
                        >
                            <div className="flex w-full items-center gap-2">
                                <span className="text-lg leading-none" aria-hidden="true">
                                    {data.icon}
                                </span>
                                <span className="truncate font-medium text-foreground">{data.title}</span>
                                {isLoading && <Spinner className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                            </div>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{t(`datasets.${data.key}`)}</p>
                            {isLoading ? (
                                <p className="text-xs text-primary">{t('loading')}</p>
                            ) : (
                                data.rows !== undefined &&
                                data.columns !== undefined && (
                                    <p className="text-xs text-muted-foreground/70">
                                        {t('meta', { rows: data.rows.toLocaleString(), cols: data.columns })}
                                    </p>
                                )
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default observer(DemoData);
