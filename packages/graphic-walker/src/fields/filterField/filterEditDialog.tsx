import { observer } from 'mobx-react-lite';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { IAggregator, IComputationFunction, IFilterField, IFilterRule, IMutField } from '../../interfaces';
import { ComputationContext, useCompututaion, useVizStore } from '../../store';
import Tabs, { RuleFormProps } from './tabs';
import DropdownSelect, { IDropdownSelectOption } from '../../components/dropdownSelect';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { GLOBAL_CONFIG } from '../../config';
import { toWorkflow } from '../../utils/workflow';
import { useRefControledState } from '../../hooks';
import { getFilterMeaAggKey, getMeaAggKey } from '../../utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const aggregationList = GLOBAL_CONFIG.AGGREGATOR_LIST.map(
    (x): IDropdownSelectOption => ({
        label: x,
        value: x,
    })
).concat([{ label: '-', value: '_none' }]);

const QuantitativeRuleForm: React.FC<RuleFormProps> = ({ allFields, field, onChange, displayOffset }) => {
    return <Tabs field={field} onChange={onChange} tabs={['range', 'one of']} allFields={allFields} displayOffset={displayOffset} />;
};

const NominalRuleForm: React.FC<RuleFormProps> = ({ allFields, field, onChange, displayOffset }) => {
    return <Tabs field={field} onChange={onChange} tabs={['one of']} allFields={allFields} displayOffset={displayOffset} />;
};

const OrdinalRuleForm: React.FC<RuleFormProps> = ({ allFields, field, onChange, displayOffset }) => {
    return <Tabs field={field} onChange={onChange} tabs={['one of']} allFields={allFields} displayOffset={displayOffset} />;
};

const TemporalRuleForm: React.FC<RuleFormProps> = ({ allFields, field, onChange, displayOffset }) => {
    return <Tabs field={field} onChange={onChange} tabs={['temporal range', 'one of']} allFields={allFields} displayOffset={displayOffset} />;
};

const EmptyForm: React.FC<RuleFormProps> = () => <React.Fragment />;

export const PureFilterEditDialog = (props: {
    viewFilters: IFilterField[];
    options: { label: string; value: string }[];
    meta: IMutField[];
    editingFilterIdx: number | null;
    displayOffset?: number;
    onSelectFilter: (field: string) => void;
    onWriteFilter: (index: number, rule: IFilterRule | null) => void;
    onSelectAgg?: (index: number, aggName: IAggregator | null) => void;
    onClose: () => void;
}) => {
    const { editingFilterIdx, viewFilters, meta, options, onSelectFilter, onWriteFilter, onClose, onSelectAgg } = props;
    const { t } = useTranslation('translation', { keyPrefix: 'filters' });
    const field = React.useMemo(() => {
        return editingFilterIdx !== null ? viewFilters[editingFilterIdx] : null;
    }, [editingFilterIdx, viewFilters]);

    const [uncontrolledField, setUncontrolledField] = useRefControledState<IFilterField | null>(field);
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
            onWriteFilter(editingFilterIdx, uncontrolledField?.rule ?? null);
        }

        onClose();
    }, [editingFilterIdx, uncontrolledField?.rule, onWriteFilter]);

    const Form = field
        ? ({
              quantitative: QuantitativeRuleForm,
              nominal: NominalRuleForm,
              ordinal: OrdinalRuleForm,
              temporal: TemporalRuleForm,
          }[field.semanticType] as React.FC<RuleFormProps>)
        : EmptyForm;

    return uncontrolledField ? (
        <Dialog open={Boolean(uncontrolledField)} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('editing')}</DialogTitle>
                </DialogHeader>
                <div className="pt-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="py-1">{t('form.name')}</div>
                            <DropdownSelect
                                buttonClassName="w-96"
                                className="mb-2"
                                options={options}
                                selectedKey={uncontrolledField.fid}
                                onSelect={onSelectFilter}
                            />
                        </div>
                        {onSelectAgg && editingFilterIdx !== null && uncontrolledField.analyticType === 'measure' && (
                            <div>
                                <div className="py-1">{t('form.aggregation')}</div>
                                <DropdownSelect
                                    buttonClassName="w-96"
                                    className="mb-2"
                                    options={aggregationList}
                                    selectedKey={uncontrolledField.enableAgg ? uncontrolledField.aggName ?? '' : ''}
                                    onSelect={(v) => onSelectAgg(editingFilterIdx, v === '' ? null : (v as IAggregator))}
                                />
                            </div>
                        )}
                    </div>
                    <Form
                        allFields={meta}
                        key={getFilterMeaAggKey(uncontrolledField)}
                        field={uncontrolledField}
                        onChange={handleChange}
                        displayOffset={props.displayOffset}
                    />
                    <DialogFooter>
                        <Button onClick={handleSubmit} children={t('btn.confirm')} />
                        <Button variant="outline" onClick={onClose} children={t('btn.cancel')} />
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    ) : null;
};

const FilterEditDialog: React.FC = observer(() => {
    const vizStore = useVizStore();
    const { editingFilterIdx, viewFilters, dimensions, measures, meta, allFields, viewDimensions, config } = vizStore;
    const { timezoneDisplayOffset } = config;

    const computation = useCompututaion();

    const originalField =
        editingFilterIdx !== null
            ? viewFilters[editingFilterIdx]?.enableAgg
                ? allFields.find((x) => x.fid === viewFilters[editingFilterIdx].fid)
                : undefined
            : undefined;
    const filterAggName =
        editingFilterIdx !== null ? (viewFilters[editingFilterIdx]?.enableAgg ? viewFilters[editingFilterIdx].aggName : undefined) : undefined;

    const transformedComputation = useMemo((): IComputationFunction => {
        if (originalField && viewDimensions.length > 0) {
            const preWorkflow = toWorkflow(
                [],
                allFields,
                viewDimensions,
                [{ ...originalField, aggName: filterAggName }],
                true,
                'none',
                [],
                undefined,
                timezoneDisplayOffset
            ).map((x) => {
                if (x.type === 'view') {
                    return {
                        ...x,
                        query: x.query.map((q) => {
                            if (q.op === 'aggregate') {
                                return { ...q, measures: q.measures.map((m) => ({ ...m, asFieldKey: m.field })) };
                            }
                            return q;
                        }),
                    };
                }
                return x;
            });
            return (query) =>
                computation({
                    ...query,
                    workflow: preWorkflow.concat(query.workflow.filter((x) => x.type !== 'transform')),
                });
        } else {
            return computation;
        }
    }, [computation, viewDimensions, originalField, filterAggName]);

    const handelClose = React.useCallback(() => vizStore.closeFilterEditing(), [vizStore]);

    const handleWriteFilter = React.useCallback(
        (index: number, rule: IFilterRule | null) => {
            if (index !== null) {
                vizStore.writeFilter(index, rule ?? null);
            }
        },
        [vizStore]
    );

    const handleSelectFilterField = (fieldKey) => {
        const existingFilterIdx = viewFilters.findIndex((field) => field.fid === fieldKey);
        if (existingFilterIdx >= 0) {
            vizStore.setFilterEditing(existingFilterIdx);
        } else {
            const sourceKey = dimensions.find((field) => field.fid === fieldKey) ? 'dimensions' : 'measures';
            const sourceIndex =
                sourceKey === 'dimensions' ? dimensions.findIndex((field) => field.fid === fieldKey) : measures.findIndex((field) => field.fid === fieldKey);
            if (editingFilterIdx !== null) {
                vizStore.modFilter(editingFilterIdx, sourceKey, sourceIndex);
            }
        }
    };

    const allFieldOptions = React.useMemo(() => {
        return allFields
            .filter((x) => ![COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID].includes(x.fid))
            .map((d) => ({
                label: d.name,
                value: d.fid,
            }));
    }, [allFields]);

    const handleChangeAgg = (index: number, agg: IAggregator | null) => {
        vizStore.setFilterAggregator(index, agg ?? '');
    };

    return (
        <ComputationContext.Provider value={transformedComputation}>
            <PureFilterEditDialog
                options={allFieldOptions}
                editingFilterIdx={editingFilterIdx}
                displayOffset={timezoneDisplayOffset}
                meta={meta}
                onClose={handelClose}
                onSelectFilter={handleSelectFilterField}
                onWriteFilter={handleWriteFilter}
                viewFilters={viewFilters}
                onSelectAgg={handleChangeAgg}
            />
        </ComputationContext.Provider>
    );
});

export default FilterEditDialog;
