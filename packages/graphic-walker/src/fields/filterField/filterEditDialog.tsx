import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { observer } from "mobx-react-lite";
import React from "react";
import { useTranslation } from "react-i18next";

import Modal from "../../components/modal";
import type { IFilterField, IFilterRule } from "../../interfaces";
import { useGlobalStore } from "../../store";
import Tabs, { RuleFormProps } from "./tabs";
import DefaultButton from "../../components/button/default";
import PrimaryButton from "../../components/button/primary";

const QuantitativeRuleForm: React.FC<RuleFormProps> = ({ dataset, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["range", "one of"]} dataset={dataset} />;
};

const NominalRuleForm: React.FC<RuleFormProps> = ({ dataset, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["one of"]} dataset={dataset} />;
};

const OrdinalRuleForm: React.FC<RuleFormProps> = ({ dataset, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["range", "one of"]} dataset={dataset} />;
};

const TemporalRuleForm: React.FC<RuleFormProps> = ({ dataset, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["one of", "temporal range"]} dataset={dataset} />;
};

const EmptyForm: React.FC<RuleFormProps> = () => <React.Fragment />;

const FilterEditDialog: React.FC = observer(() => {
    const { vizStore, commonStore } = useGlobalStore();
    const { editingFilterIdx, draggableFieldState } = vizStore;
    const { currentDataset } = commonStore;

    const { t } = useTranslation("translation", { keyPrefix: "filters" });

    const field = React.useMemo(() => {
        return editingFilterIdx !== null ? draggableFieldState.filters[editingFilterIdx] : null;
    }, [editingFilterIdx, draggableFieldState]);

    const [uncontrolledField, setUncontrolledField] = React.useState(field as IFilterField | null);
    const ufRef = React.useRef(uncontrolledField);
    ufRef.current = uncontrolledField;

    React.useEffect(() => {
        if (field !== ufRef.current) {
            setUncontrolledField(field);
        }
    }, [field]);

    const handleChange = React.useCallback(
        (r: IFilterRule) => {
            if (editingFilterIdx !== null) {
                setUncontrolledField(
                    (uf) =>
                        ({
                            ...uf,
                            rule: r,
                        } as IFilterField)
                );
            }
        },
        [editingFilterIdx]
    );

    const handleSubmit = React.useCallback(() => {
        if (editingFilterIdx !== null) {
            vizStore.writeFilter(editingFilterIdx, uncontrolledField?.rule ?? null);
        }

        vizStore.closeFilterEditing();
    }, [editingFilterIdx, uncontrolledField]);

    const Form = field
        ? ({
              quantitative: QuantitativeRuleForm,
              nominal: NominalRuleForm,
              ordinal: OrdinalRuleForm,
              temporal: TemporalRuleForm,
          }[field.semanticType] as React.FC<RuleFormProps>)
        : EmptyForm;

    return uncontrolledField ? (
        <Modal show={Boolean(uncontrolledField)} title={t("editing")} onClose={() => vizStore.closeFilterEditing()}>
            <div className="p-4">
                <h2 className="text-base font-semibold py-2 outline-none">{t("form.name")}</h2>
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-0.5 text-sm font-medium text-indigo-800">
                    {uncontrolledField.name}
                </span>
                <h3 className="text-base font-semibold py-2 outline-none">{t("form.rule")}</h3>
                <Form dataset={currentDataset} field={uncontrolledField} onChange={handleChange} />
                <div className="mt-4">
                    <PrimaryButton
                        onClick={handleSubmit}
                        text={t("btn.confirm")}
                    />
                    <DefaultButton
                        className="ml-2"
                        onClick={() => vizStore.closeFilterEditing()}
                        text={t("btn.cancel")}
                    />
                </div>
            </div>
        </Modal>
    ) : null;
});

export default FilterEditDialog;
