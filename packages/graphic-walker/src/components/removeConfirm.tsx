import React from 'react';
import Modal from './modal';
import { observer } from 'mobx-react-lite';
import { useVizStore } from '../store';
import DefaultButton from './button/default';
import PrimaryButton from './button/primary';
import { useTranslation } from 'react-i18next';

const RemoveConfirm = observer(function RemoveConfirm() {
    const { t } = useTranslation();

    const viz = useVizStore();
    return (
        <Modal onClose={() => viz.closeRemoveConfirmModal()} show={viz.removeConfirmIdx !== null}>
            <div>
                <span className="block text-sm font-medium leading-6">{t('main.tablist.remove_confirm')}</span>
                <div className="mt-4 flex justify-end">
                    <DefaultButton
                        className="mr-2"
                        text={t('actions.cancel')}
                        onClick={() => {
                            viz.closeRemoveConfirmModal();
                        }}
                    />
                    <PrimaryButton
                        className="bg-red-600 hover:bg-red-700"
                        text={t('actions.confirm')}
                        onClick={() => {
                            viz.removeVisualization(viz.removeConfirmIdx!);
                            viz.closeRemoveConfirmModal();
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
});

export default RemoveConfirm;