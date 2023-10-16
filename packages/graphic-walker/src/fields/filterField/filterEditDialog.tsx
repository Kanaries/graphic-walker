import { observer } from 'mobx-react-lite';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { toJS } from 'mobx';
import Modal from '../../components/modal';
import type { IFilterField, IFilterRule } from '../../interfaces';
import { useVizStore } from '../../store';
import Tabs, { RuleFormProps } from './tabs';
import DefaultButton from '../../components/button/default';
import PrimaryButton from '../../components/button/primary';
import DropdownSelect from '../../components/dropdownSelect';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../../constants';

const QuantitativeRuleForm: React.FC<RuleFormProps> = ({ rawFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={['range', 'one of']} rawFields={rawFields} />;
};

const NominalRuleForm: React.FC<RuleFormProps> = ({ rawFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={['one of']} rawFields={rawFields} />;
};

const OrdinalRuleForm: React.FC<RuleFormProps> = ({ rawFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={['range', 'one of']} rawFields={rawFields} />;
};

const TemporalRuleForm: React.FC<RuleFormProps> = ({ rawFields, field, onChange }) => {
    return <Tabs field={field} onChange={onChange} tabs={['temporal range', 'one of']} rawFields={rawFields} />;
};

const EmptyForm: React.FC<RuleFormProps> = () => <React.Fragment />;

const FilterEditDialog: React.FC = observer(() => {
    const vizStore = useVizStore();
    const { editingFilterIdx, viewFilters, dimensions, measures, meta, allFields } = vizStore;

    const { t } = useTranslation('translation', { keyPrefix: 'filters' });

    const field = React.useMemo(() => {
        return editingFilterIdx !== null ? viewFilters[editingFilterIdx] : null;
    }, [editingFilterIdx, viewFilters]);

    const [uncontrolledField, setUncontrolledField] = React.useState(field as IFilterField | null);
    const ufRef = React.useRef(uncontrolledField);
    ufRef.current = uncontrolledField;

    React.useEffect(() => {
        if (field !== ufRef.current) {
            setUncontrolledField(field as IFilterField);
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
    }, [editingFilterIdx, uncontrolledField?.rule, vizStore]);

    const allFieldOptions = React.useMemo(() => {
        return allFields.filter(x => ![COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID].includes(x.fid)).map((d) => ({
            label: d.name,
            value: d.fid,
        }));
    }, [allFields]);

    const handleSelectFilterField = (fieldKey) => {
        const existingFilterIdx = viewFilters.findIndex((field) => field.fid === fieldKey);
        if (existingFilterIdx >= 0) {
            vizStore.setFilterEditing(existingFilterIdx);
        } else {
            const sourceKey = dimensions.find((field) => field.fid === fieldKey) ? 'dimensions' : 'measures';
            const sourceIndex =
                sourceKey === 'dimensions'
                    ? dimensions.findIndex((field) => field.fid === fieldKey)
                    : measures.findIndex((field) => field.fid === fieldKey);
            if (editingFilterIdx !== null) {
                vizStore.modFilter(editingFilterIdx, sourceKey, sourceIndex);
            }
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
        <Modal show={Boolean(uncontrolledField)} title={t('editing')} onClose={() => vizStore.closeFilterEditing()}>
            <div className="px-4 py-1">
                <div className="py-1">{t('form.name')}</div>
                <DropdownSelect
                    buttonClassName="w-96"
                    className="mb-2"
                    options={allFieldOptions}
                    selectedKey={uncontrolledField.fid}
                    onSelect={handleSelectFilterField}
                />
                <Form rawFields={meta} field={uncontrolledField} onChange={handleChange} />
                <div className="mt-4">
                    <PrimaryButton onClick={handleSubmit} text={t('btn.confirm')} />
                    <DefaultButton className="ml-2" onClick={() => vizStore.closeFilterEditing()} text={t('btn.cancel')} />
                </div>
            </div>
        </Modal>
    ) : null;
});

export default FilterEditDialog;
