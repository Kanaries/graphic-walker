import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useVizStore } from '../../store';
import { useTranslation } from 'react-i18next';
import { ICreateField } from '../../interfaces';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const RenamePanel: React.FC = (props) => {
    const vizStore = useVizStore();
    const { showRenamePanel, createField, currentEncodings } = vizStore;
    const { t } = useTranslation();
    const [value, setValue] = useState<string>('');

    useEffect(() => {
        if (createField) {
            setValue(currentEncodings[createField.channel]?.[createField.index]?.name ?? '');
        }
    }, [showRenamePanel]);

    return (
        <Dialog open={showRenamePanel} onOpenChange={() => vizStore.setShowRenamePanel(false)}>
            <DialogContent className="!w-fit">
                <div className="flex flex-col justify-center items-start text-xs">
                    <h2 className="text-lg font-medium mb-2">Rename Field</h2>
                    <p className="font-normal text-muted-foreground">This action will rename this field's name in the chart.</p>
                    <div className="flex items-center space-x-2 mt-2">
                        <label className="text-ml whitespace-nowrap">New Name</label>
                        <Input
                            type="text"
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                            }}
                        />
                    </div>
                </div>
                <DialogFooter className="mt-2">
                    <Button
                        children={t('actions.confirm')}
                        onClick={() => {
                            const field = vizStore.createField as ICreateField;
                            vizStore.renameFieldInChart(field.channel, field.index, value);
                            vizStore.setShowRenamePanel(false);
                            return;
                        }}
                    />
                    <Button
                        variant="outline"
                        children={t('actions.cancel')}
                        onClick={() => {
                            vizStore.setShowRenamePanel(false);
                            return;
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
export default observer(RenamePanel);
