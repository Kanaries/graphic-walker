import { observer } from "mobx-react-lite";
import React from "react";
import { useTranslation } from "react-i18next";
import { toJS } from 'mobx';
import Modal from "../../components/modal";
import type { IFilterField, IFilterRule } from "../../interfaces";
import { useGlobalStore } from "../../store";
import Tabs, { RuleFormProps } from "./tabs";
import DefaultButton from "../../components/button/default";
import PrimaryButton from "../../components/button/primary";
import DropdownSelect from "../../components/dropdownSelect";

const QuantitativeRuleForm: React.FC<RuleFormProps> = ({ dataset, allFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["range", "one of"]} dataset={dataset} allFields={allFields} />;
};

const NominalRuleForm: React.FC<RuleFormProps> = ({ dataset, allFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["one of"]} dataset={dataset} allFields={allFields} />;
};

const OrdinalRuleForm: React.FC<RuleFormProps> = ({ dataset, allFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["range", "one of"]} dataset={dataset} allFields={allFields} />;
};

const TemporalRuleForm: React.FC<RuleFormProps> = ({ dataset, allFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={["temporal range", "one of"]} dataset={dataset} allFields={allFields} />;
};

const EmptyForm: React.FC<RuleFormProps> = () => <React.Fragment />;

const FilterEditDialog: React.FC = observer(() => {
    const { vizStore, commonStore } = useGlobalStore();
    const { editingFilterIdx, draggableFieldState, viewDimensions, viewMeasures } = vizStore;
    const { currentDataset } = commonStore;

    const allFields = React.useMemo(() => [...viewDimensions, ...viewMeasures], [viewDimensions, viewMeasures]);

    const { t } = useTranslation("translation", { keyPrefix: "filters" });

    const field = React.useMemo(() => {
        return editingFilterIdx !== null ? draggableFieldState.filters[editingFilterIdx] : null;
    }, [editingFilterIdx, draggableFieldState]);

    const [uncontrolledField, setUncontrolledField] = React.useState(field as IFilterField | null);
    const ufRef = React.useRef(uncontrolledField);
    ufRef.current = uncontrolledField;

    React.useEffect(() => {
        if (field !== ufRef.current) {
            setUncontrolledField(toJS(field) );
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

    const allFieldOptions = React.useMemo(() => {
        return [...draggableFieldState.dimensions, ...draggableFieldState.measures].map((d) => ({
            label: d.name, 
            value: d.fid,
        }));
    }, [draggableFieldState]);

    const handleSelectFilterField = (fieldKey) => {
        const existingFilterIdx = draggableFieldState.filters.findIndex((field) => field.fid === fieldKey)
        if (existingFilterIdx >= 0) {
            vizStore.setFilterEditing(existingFilterIdx);
        } else {
            const sourceKey = draggableFieldState.dimensions.find((field) => field.fid === fieldKey) 
                ? "dimensions" 
                : "measures"
            const sourceIndex = sourceKey === "dimensions"
                ? draggableFieldState.dimensions.findIndex((field) => field.fid === fieldKey)
                : draggableFieldState.measures.findIndex((field) => field.fid === fieldKey);
            vizStore.moveField(sourceKey, sourceIndex, "filters", 0);
        }
    };

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
            <div className="px-4 py-1">
                <div className="py-1">{t("form.name")}</div>
                <DropdownSelect
                    buttonClassName="w-96"
                    className="mb-2"
                    options={allFieldOptions}
                    selectedKey={uncontrolledField.fid}
                    onSelect={handleSelectFilterField}
                />
                <Form dataset={currentDataset} allFields={allFields} field={uncontrolledField} onChange={handleChange} />
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
