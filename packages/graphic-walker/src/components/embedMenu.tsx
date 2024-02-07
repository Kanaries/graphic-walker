import { observer } from 'mobx-react-lite';
import { useVizStore } from '../store';
import ClickMenu from './clickMenu';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { GLOBAL_CONFIG } from '../config';
import { Transition } from '@headlessui/react';

export const VizEmbedMenu = observer(function VizEmbedMenu() {
    const vizStore = useVizStore();
    const { t } = useTranslation();
    const { vizEmbededMenu } = vizStore;
    return (
        <Transition
            appear
            show={vizEmbededMenu.show}
            className="absolute inset-0"
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
        >
            <ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
                {GLOBAL_CONFIG.EMBEDED_MENU_LIST.map((key) => {
                    switch (key) {
                        case 'data_interpretation':
                            return (
                                <div
                                    key={key}
                                    className="flex items-center whitespace-nowrap rounded-md transition-colors py-1 px-4 hover:bg-accent hover:text-accent-foreground cursor-pointer"
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
                                    className="flex items-center whitespace-nowrap rounded-md transition-colors py-1 px-4 hover:bg-accent hover:text-accent-foreground cursor-pointer"
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
        </Transition>
    );
});
