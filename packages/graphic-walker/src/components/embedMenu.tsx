import { observer } from 'mobx-react-lite';
import { useVizStore } from '../store';
import ClickMenu from './clickMenu';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { GLOBAL_CONFIG } from '../config';

export const VizEmbedMenu = observer(function VizEmbedMenu() {
    const vizStore = useVizStore();
    const { t } = useTranslation();
    const { vizEmbededMenu } = vizStore;
    if (!vizEmbededMenu.show) {
        return null;
    }
    return (
        <ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
            {GLOBAL_CONFIG.EMBEDED_MENU_LIST.map((key) => {
                switch (key) {
                    case 'data_interpretation':
                        return (
                            <div
                                key={key}
                                className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                    vizStore.closeEmbededMenu();
                                    vizStore.setShowInsightBoard(true);
                                }}
                            >
                                <span className="flex-1 pr-2">{t('App.labels.data_interpretation')}</span>
                                <LightBulbIcon className="ml-1 w-3 flex-grow-0 flex-shrink-0" />
                            </div>
                        );
                    case 'data_view':
                        return (
                            <div
                                key={key}
                                className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                    vizStore.closeEmbededMenu();
                                    vizStore.setShowDataBoard(true);
                                }}
                            >
                                <span className="flex-1 pr-2">{t('App.labels.data_view')}</span>
                            </div>
                        ); 
                    default:
                        const unexceptedKey: never = key;
                        console.error('Unknown item', unexceptedKey);
                        return null;
                }
            })}
        </ClickMenu>
    );
});
