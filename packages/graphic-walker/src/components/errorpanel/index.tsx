import { observer } from 'mobx-react-lite';
import { useVizStore } from '../../store';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';

function formatErrorMessage(msg: string): string {
    if (!msg || typeof msg !== 'string') return '';
    if (msg === '[object Event]' || msg.startsWith('[object ')) return '';
    return msg;
}

export default observer(function ErrorPanel() {
    const vizStore = useVizStore();
    const { t } = useTranslation('translation', { keyPrefix: 'error_panel' });
    const closeModal = () => {
        vizStore.updateShowErrorResolutionPanel(0);
        return;
    };
    switch (vizStore.showErrorResolutionPanel) {
        case 0:
            return null;
        case 500:
            return (
                <Dialog open={true} onOpenChange={closeModal}>
                    <DialogContent className="!w-fit" aria-describedby={undefined}>
                        <div className="flex flex-col justify-center items-start">
                            <h2 className="font-medium text-xl my-2">{t('oops')}</h2>
                            <p className="font-normal my-2">{t('chart_too_large')}</p>
                            <p className="font-normal my-2">
                                {t('option1')}
                                <a
                                    className="mx-2 cursor-pointer font-semibold text-primary"
                                    onClick={() => {
                                        vizStore.setVisualLayout('size', { mode: 'fixed', width: 800, height: 600 });
                                        closeModal();
                                    }}
                                >
                                    {t('set_now')}
                                </a>
                            </p>
                            <p className="font-normal my-2">
                                {t('option2')}
                                <a
                                    className="mx-2 cursor-pointer font-semibold text-primary"
                                    onClick={() => {
                                        vizStore.setVisualLayout('useSvg', true);
                                        closeModal();
                                    }}
                                >
                                    {t('set_now')}
                                </a>
                            </p>
                            <p className="font-normal my-2">{t('option3')}</p>
                            <fieldset className="mt-2 gap-1 flex flex-col justify-center items-end w-full">
                                <div className="mt-2">
                                    <Button variant="outline" children={t('close')} className="mr-2" onClick={closeModal} />
                                </div>
                            </fieldset>
                        </div>
                    </DialogContent>
                </Dialog>
            );
        case 501:
            return (
                <Dialog open={true} onOpenChange={closeModal}>
                    <DialogContent aria-describedby={undefined}>
                        <div className="flex flex-col justify-center items-start">
                            <h2 className="font-medium text-xl my-2">{t('oops')}</h2>
                            <p className="font-normal my-2">{t('computation_error')}</p>
                            <p className="font-normal my-2">{formatErrorMessage(vizStore.lastErrorMessage) || t('unknown_error')}</p>

                            <fieldset className="mt-2 gap-1 flex flex-col justify-center items-end w-full">
                                <div className="mt-2">
                                    <Button variant="outline" children={t('close')} className="mr-2" onClick={closeModal} />
                                </div>
                            </fieldset>
                        </div>
                    </DialogContent>
                </Dialog>
            );
        case 502:
            return (
                <Dialog open={true} onOpenChange={closeModal}>
                    <DialogContent aria-describedby={undefined}>
                        <div className="flex flex-col justify-center items-start">
                            <h2 className="font-medium text-xl my-2">{t('oops')}</h2>
                            <p className="font-normal my-2">{t('askviz_error')}</p>
                            <p className="font-normal my-2">{formatErrorMessage(vizStore.lastErrorMessage) || t('unknown_error')}</p>

                            <fieldset className="mt-2 gap-1 flex flex-col justify-center items-end w-full">
                                <div className="mt-2">
                                    <Button variant="outline" children={t('close')} className="mr-2" onClick={closeModal} />
                                </div>
                            </fieldset>
                        </div>
                    </DialogContent>
                </Dialog>
            );
    }
    return null;
});
