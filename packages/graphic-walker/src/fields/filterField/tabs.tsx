import { observer } from 'mobx-react-lite';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import type { IFieldStats, IFilterField, IFilterRule } from '../../interfaces';
import { useGlobalStore } from '../../store';
import PureTabs from '../../components/tabs/defaultTab';
import Slider from './slider';


export type RuleFormProps = {
    field: IFilterField;
    onChange: (rule: IFilterRule) => void;
};

const Container = styled.div({
    marginBlock: '1em',
    marginInline: '2em',

    '> .btn-grp': {
        display: 'flex',
        flexDirection: 'row',
        marginBlock: '0.4em 0.6em',

        '> *': {
            marginInlineStart: '0.6em',

            '&:first-child': {
                marginInlineStart: 0,
            },
        },
    },
});

export const Button = styled.button({
    '&:hover': {
        backgroundColor: 'rgba(243, 244, 246, 0.5)',
    },
    color: 'rgb(55, 65, 81)',
    boxShadow: '1px 1px 2px #0002, inset 2px 2px 4px #0001',
    paddingBlock: '0.2em',
    paddingInline: '0.5em',
    userSelect: 'none',
    cursor: 'pointer',
});

const Table = styled.div({
    display: 'grid',
    gridTemplateColumns: '4em auto max-content',
    maxHeight: '30vh',
    overflowY: 'scroll',
    '& > *': {
        marginBlock: '2px',
        paddingInline: '4px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        userSelect: 'none',
    },
    '& > input, & > *[for]': {
        cursor: 'pointer',
    },
});

const TabsContainer = styled.div({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'stretch',
});

const TabList = styled.div({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    overflow: 'hidden',
});

const TabHeader = styled.label({
    outline: 'none',
    userSelect: 'none',
    paddingBlock: '0.4em',
    paddingInline: '1em 2em',
    borderWidth: '1px',
    borderRadius: '4px 4px 0 0',
    position: 'relative',

    '&[aria-selected]': {
        borderBottomColor: '#0000',
        zIndex: 15,
    },
    '&[aria-selected=false]': {
        backgroundColor: '#f8f8f8',
        borderBottomColor: '#e2e2e2',
        cursor: 'pointer',
        zIndex: 14,
    },
});

const TabPanel = styled.div({});

const TabItem = styled.div({});

const useFieldStats = (fid: string, attributes: { values: boolean; range: boolean }): IFieldStats | null => {
    const { values, range } = attributes;
    const { vizStore, commonStore } = useGlobalStore();
    const { dataLoader } = vizStore;
    const { currentDataset } = commonStore;
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<IFieldStats | null>(null);

    useEffect(() => {
        setLoading(true);
        let isCancelled = false;
        dataLoader.statField(currentDataset, fid, { values, range }).then(stats => {
            if (isCancelled) {
                return;
            }
            setStats(stats);
            setLoading(false);
        }).catch(reason => {
            console.warn(reason);
            if (isCancelled) {
                return;
            }
            setStats(null);
            setLoading(false);
        });
        return () => {
            isCancelled = true;
        };
    }, [fid, values, range]);

    return loading ? null : stats;
};

export const FilterOneOfRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const { t } = useTranslation('translation', { keyPrefix: 'filters' });

    const stats = useFieldStats(field.fid, { values: true, range: false });
    const count = stats?.values;

    React.useEffect(() => {
        if (count && active && field.rule?.type !== 'one of') {
            onChange({
                type: 'one of',
                value: new Set<string | number>(count.map(item => item.value)),
            });
        }
    }, [active, onChange, field, count]);

    if (!stats) {
        return <>{'loading...'}</>;
    }

    return field.rule?.type === 'one of' ? (
        <Container>
            <Table>
                <label className="header">
                    {t('header.visibility')}
                </label>
                <label className="header">
                    {t('header.value')}
                </label>
                <label className="header">
                    {t('header.count')}
                </label>
            </Table>
            <Table>
                {
                    count?.map(({ value, count }, idx) => {
                        const id = `rule_checkbox_${idx}`;

                        return (
                            <React.Fragment key={idx}>
                                <input
                                    type="checkbox"
                                    checked={field.rule?.type === 'one of' && field.rule.value.has(value)}
                                    id={id}
                                    aria-describedby={`${id}_label`}
                                    title={String(value)}
                                    onChange={({ target: { checked } }) => {
                                        if (field.rule?.type !== 'one of') {
                                            return;
                                        }
                                        
                                        const rule: IFilterRule = {
                                            type: 'one of',
                                            value: new Set(field.rule.value)
                                        };

                                        if (checked) {
                                            rule.value.add(value);
                                        } else {
                                            rule.value.delete(value);
                                        }

                                        onChange(rule);
                                    }}
                                />
                                <label
                                    id={`${id}_label`}
                                    htmlFor={id}
                                    title={String(value)}
                                >
                                    {value}
                                </label>
                                <label
                                    htmlFor={id}
                                >
                                    {count}
                                </label>
                            </React.Fragment>
                        );
                    })
                }
            </Table>
            <Table className="text-gray-600">
                <label></label>
                <label>
                    {t('selected_keys', { count: field.rule.value.size })}
                </label>
                <label>
                    {[...field.rule.value].reduce<number>((sum, key) => {
                        const s = count?.find(which => which.value === key)?.count ?? 0;

                        return sum + s;
                    }, 0)}
                </label>
            </Table>
            <div className="btn-grp">
                <Button
                    onClick={() => {
                        if (count && field.rule?.type === 'one of') {
                            const curSet = field.rule.value;

                            onChange({
                                type: 'one of',
                                value: new Set<number | string>(
                                    curSet.size === count.length
                                        ? []
                                        : count.map(item => item.value)
                                ),
                            });
                        }
                    }}
                >
                    {
                        field.rule.value.size === count?.length
                            ? t('btn.unselect_all')
                            : t('btn.select_all')
                    }
                </Button>
                <Button
                    onClick={() => {
                        if (count && field.rule?.type === 'one of') {
                            const curSet = field.rule.value;

                            onChange({
                                type: 'one of',
                                value: new Set<number | string>(
                                    count.map(item => item.value).filter(key => !curSet.has(key))
                                ),
                            });
                        }
                    }}
                >
                    {t('btn.reverse')}
                </Button>
            </div>
        </Container>
    ) : null;
});

export const FilterTemporalRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const stats = useFieldStats(field.fid, { values: false, range: true });
    const range = stats?.range;

    React.useEffect(() => {
        if (range && active && field.rule?.type !== 'temporal range') {
            onChange({
                type: 'temporal range',
                value: range,
            });
        }
    }, [onChange, field, range, active]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'temporal range',
            value,
        });
    }, []);

    if (!range) {
        return <>{'loading...'}</>;
    }

    return field.rule?.type === 'temporal range' ? (
        <Container>
            <Slider
                min={range[0]}
                max={range[1]}
                value={field.rule.value}
                onChange={handleChange}
                isDateTime
            />
        </Container>
    ) : null;
});

export const FilterRangeRule: React.FC<RuleFormProps & { active: boolean }> = observer(({
    active,
    field,
    onChange,
}) => {
    const stats = useFieldStats(field.fid, { values: false, range: true });
    const range = stats?.range;

    React.useEffect(() => {
        if (range && active && field.rule?.type !== 'range') {
            onChange({
                type: 'range',
                value: range,
            });
        }
    }, [onChange, field, range, active]);

    const handleChange = React.useCallback((value: readonly [number, number]) => {
        onChange({
            type: 'range',
            value,
        });
    }, []);

    if (!range) {
        return <>{'loading...'}</>;
    }

    return field.rule?.type === 'range' ? (
        <Container>
            <Slider
                min={range[0]}
                max={range[1]}
                value={field.rule.value}
                onChange={handleChange}
            />
        </Container>
    ) : null;
});

const filterTabs: Record<IFilterRule['type'], React.FC<RuleFormProps & { active: boolean }>> = {
    'one of': FilterOneOfRule,
    'range': FilterRangeRule,
    'temporal range': FilterTemporalRangeRule,
};

export interface TabsProps extends RuleFormProps {
    tabs: IFilterRule['type'][];
}

const Tabs: React.FC<TabsProps> = observer(({ field, onChange, tabs }) => {
    const { vizStore } = useGlobalStore();
    const { draggableFieldState } = vizStore;

    const { t } = useTranslation('translation', { keyPrefix: 'constant.filter_type' });

    const [which, setWhich] = React.useState(field.rule?.type ?? tabs[0]!);

    return (
        <TabsContainer>
            <PureTabs
                selectedKey={which}
                tabs={tabs.map(tab => ({
                    key: tab,
                    label: t(tab.replaceAll(/ /g, '_')),
                }))}
                onSelected={sk => {
                    setWhich(sk as typeof which);
                }}
            />
            <TabPanel>
                {
                    tabs.map((tab, i) => {
                        const Component = filterTabs[tab];

                        return draggableFieldState === null ? null : (
                            <TabItem
                                key={i}
                                id={`filter-panel-${tab.replaceAll(/ /g, '_')}`}
                                aria-labelledby={`filter-tab-${tab.replaceAll(/ /g, '_')}`}
                                role="tabpanel"
                                hidden={which !== tab}
                                tabIndex={0}
                            >
                                <Component
                                    field={field}
                                    onChange={onChange}
                                    active={which === tab}
                                />
                            </TabItem>
                        );
                    })
                }
            </TabPanel>
        </TabsContainer>
    );
});


export default Tabs;
