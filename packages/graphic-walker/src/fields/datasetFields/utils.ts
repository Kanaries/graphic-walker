import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useVizStore } from "../../store";
import type { IActionMenuItem } from "../../components/actionMenu/list";
import { COUNT_FIELD_ID, DATE_TIME_DRILL_LEVELS } from "../../constants";


const keepTrue = <T extends string | number | object | Function | symbol>(array: (T | 0 | null | false | undefined | void)[]): T[] => {
    return array.filter(Boolean) as T[];
};

export const useMenuActions = (channel: "dimensions" | "measures"): IActionMenuItem[][] => {
    const vizStore = useVizStore();
    const fields = vizStore.currentVis.encodings[channel];
    const { t } = useTranslation('translation', { keyPrefix: "field_menu" });

    return useMemo<IActionMenuItem[][]>(() => {
        return fields.map((f, index) => {
            const isDateTimeDrilled = f.expression?.op === 'dateTimeDrill';

            return keepTrue<IActionMenuItem>([
                channel === 'dimensions' && {
                    label: t('to_mea'),
                    onPress() {
                        vizStore.moveField("dimensions", index, "measures", vizStore.viewMeasures.length);
                    },
                },
                channel === 'measures' && {
                    label: t('to_dim'),
                    disabled: f.fid === COUNT_FIELD_ID,
                    onPress() {
                        vizStore.moveField("measures", index, "dimensions", vizStore.viewDimensions.length);
                    },
                },
                {
                    label: t('new_calc'),
                    disabled: f.semanticType === 'nominal' || f.semanticType === 'ordinal',
                    children: [
                        {
                            label: "Bin",
                            onPress() {
                                vizStore.createBinField(channel, index, "bin");
                            },
                        },
                        {
                            label: "Bin Count",
                            disabled: f.semanticType === 'nominal' || f.semanticType === 'ordinal',
                            onPress() {
                                vizStore.createBinField(channel, index, "binCount");
                            },
                        },
                        {
                            label: "Log10",
                            disabled: f.semanticType === 'nominal' || f.semanticType === 'ordinal',
                            onPress() {
                                vizStore.createLogField(channel, index, "log", 10);
                            },
                        },
                        {
                            label: "Log2",
                            disabled: f.semanticType === 'nominal' || f.semanticType === 'ordinal',
                            onPress() {
                                vizStore.createLogField(channel, index, "log", 2);
                            },
                        },
                        {
                            label:"Log(customize)",
                            disabled: f.semanticType === 'nominal' || f.semanticType === 'ordinal',
                            onPress(){
                                vizStore.setShowLogSettingPanel(true);
                                vizStore.setCreateField({channel:channel,index:index})
                            }
                        },
                        {
                            label:"Bin(customize)",
                            disabled: f.semanticType === 'nominal' || f.semanticType === 'ordinal',
                            onPress(){
                                vizStore.setShowBinSettingPanel(true);
                                vizStore.setCreateField({channel:channel,index:index});
                            }
                        },
                        
                    ],
                },
                (f.semanticType === 'temporal' || isDateTimeDrilled) && {
                    label: t('drill.name'),
                    children: DATE_TIME_DRILL_LEVELS.map(level => ({
                        label: t(`drill.levels.${level}`),
                        disabled: isDateTimeDrilled && f.expression?.params.find(p => p.type === 'value')?.value === level,
                        onPress() {
                            const originField = (isDateTimeDrilled ? vizStore.allFields.find(f => f.fid === f.expression?.params.find(p => p.type === 'field')?.value) : null) ?? f;
                            vizStore.createDateTimeDrilledField(channel, index, level, `${t(`drill.levels.${level}`)} (${originField.name || originField.fid})`);
                        },
                    })),
                },
            ]);
        });
    }, [channel, fields, vizStore, t]);
};
