import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalStore } from '../../store';
import SmallModal from '../../components/smallModal';
import PrimaryButton from '../../components/button/primary';
import DefaultButton from '../../components/button/default';
import { useTranslation } from 'react-i18next';
import { ICreateField } from '../../interfaces';

const FieldScalePanel: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { showBinSettingPanel, setShowBinSettingPanel } = commonStore;
    const { t } = useTranslation();
    const [chosenOption, setChosenOption] = useState<'widths' | 'counts'>('widths');
    const [value, setValue] = useState<string>('');
    const options = ['widths', 'counts'];


    useEffect(() => {
      setChosenOption('widths');
      setValue('');
    },[showBinSettingPanel]);

    return (
      <SmallModal
      show={showBinSettingPanel}
      onClose={() => {
          commonStore.setShowBinSettingPanel(false);
      }}
  >
               <div className="flex flex-col justify-center items-start">
                    <h2 className="font-medium text-xl">Bins</h2>
                    <p className="font-normal">Set bin config for field</p>
                    <fieldset className="mt-2 gap-1 flex flex-col justify-center items-start">
                        {options.map((option,index) => {
                            return (
                              <div key={index}>
                                <div className="flex my-2" key={option}>
                                    <div className="align-top">
                                        <input
                                            type="radio"
                                            className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                                            id={option}
                                            checked={option === chosenOption}
                                            onChange={(e) => setChosenOption(option as typeof chosenOption)}
                                        />
                                    </div>
                                    <div className="ml-3">
                                        <label htmlFor={option}>{`Bin with equal ${option}`}</label>
                                    </div>
                                </div>
                                   {chosenOption === option && (<div className="flex items-center space-x-2">
                                   <label className="text-ml whitespace-nowrap">Bin number</label>
                                   <input
                                       type="text"
                                       className="block w-full text-gray-700 dark:text-gray-200 rounded-md border-0 py-1 px-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 "
                                       value={value}
                                       onChange={(e) => {
                                         setValue(e.target.value);
                                       }}
                                  />
                               </div>)}
                               </div>
                            );
                        })}

                     
                        <div className='mt-2'>
                        <PrimaryButton
                        // text={t("actions.confirm")}
                        className="mr-2 px-2 "
                        text="Confirm"
                        onClick={() => {
                          const field = commonStore.createField as ICreateField;
                          console.log(field,value);
                          vizStore.createBinField(field.channel, field.index, chosenOption === 'widths'?'bin':'binCount', Number(value));
                          commonStore.setShowBinSettingPanel(false);
                          return;
                        }}
                    />
                        <DefaultButton
                        text={t("actions.cancel")}
                        className="mr-2 px-2"
                        onClick={() => {
                          commonStore.setShowBinSettingPanel(false);
                          return;
                        }}
                    /></div>
                    </fieldset>
                </div>
      </SmallModal>
     
    );
};
export default observer(FieldScalePanel);
