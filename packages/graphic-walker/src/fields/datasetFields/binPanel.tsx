import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useVizStore } from '../../store';
import { useTranslation } from 'react-i18next';
import { ICreateField } from '../../interfaces';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';

const FieldScalePanel: React.FC = (props) => {
    const vizStore = useVizStore();
    const { showBinSettingPanel, setShowBinSettingPanel } = vizStore;
    const { t } = useTranslation();
    const [chosenOption, setChosenOption] = useState<'widths' | 'counts'>('widths');
    const [value, setValue] = useState<string>('');
    const options = ['widths', 'counts'];

    useEffect(() => {
        setChosenOption('widths');
        setValue('');
    }, [showBinSettingPanel]);

    return (
        <Dialog
            open={showBinSettingPanel}
            onOpenChange={() => {
                setShowBinSettingPanel(false);
            }}
        >
            <DialogContent className="!w-fit">
                <div className="flex flex-col justify-center items-start text-xs">
                    <h2 className="text-lg font-medium mb-2">{t('calc.bin_panel_title')}</h2>
                    <p className="font-normal text-muted-foreground">{t('calc.bin_panel_desc')}</p>
                    <RadioGroup
                        value={chosenOption}
                        onValueChange={(opt) => setChosenOption(opt as typeof chosenOption)}
                        className="mt-2 gap-1 flex flex-col justify-center items-start"
                    >
                        {options.map((option, index) => {
                            return (
                                <div key={index}>
                                    <div className="flex my-1" key={option}>
                                        <div className="align-top">
                                            <RadioGroupItem id={option} value={option} />
                                        </div>
                                        <div className="ml-3">
                                            <label htmlFor={option}>{t(`calc.bin_panel_option_${option}`)}</label>
                                        </div>
                                    </div>
                                    {chosenOption === option && (
                                        <div className="flex items-center space-x-2">
                                            <label className="text-ml whitespace-nowrap">{t(`calc.bin_panel_number`)}</label>
                                            <Input
                                                type="text"
                                                value={value}
                                                onChange={(e) => {
                                                    setValue(e.target.value);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </RadioGroup>
                </div>
                <DialogFooter className="mt-2">
                    <Button
                        children={t('actions.confirm')}
                        onClick={() => {
                            const field = vizStore.createField as ICreateField;
                            vizStore.createBinField(field.channel, field.index, chosenOption === 'widths' ? 'bin' : 'binCount', Number(value));
                            vizStore.setShowBinSettingPanel(false);
                            return;
                        }}
                    />
                    <Button
                        variant="outline"
                        children={t('actions.cancel')}
                        onClick={() => {
                            vizStore.setShowBinSettingPanel(false);
                            return;
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
export default observer(FieldScalePanel);
