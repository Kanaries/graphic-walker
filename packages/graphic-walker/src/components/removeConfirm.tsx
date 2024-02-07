import React from 'react';
import { observer } from 'mobx-react-lite';
import { useVizStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';

const RemoveConfirm = observer(function RemoveConfirm() {
    const { t } = useTranslation();

    const viz = useVizStore();
    return (
        <Dialog onOpenChange={() => viz.closeRemoveConfirmModal()} open={viz.removeConfirmIdx !== null}>
            <DialogContent>
                <DialogHeader>{t('main.tablist.remove_confirm')}</DialogHeader>
                <DialogFooter className="mt-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            viz.closeRemoveConfirmModal();
                        }}
                    >
                        {t('actions.cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            viz.removeVisualization(viz.removeConfirmIdx!);
                            viz.closeRemoveConfirmModal();
                        }}
                    >
                        {t('actions.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

export default RemoveConfirm;
