import { observer } from 'mobx-react-lite';
import { DatasetNamesContext, useCompututaion, useVizStore } from '../store';
import DataTable from './dataTable';
import React, { useContext, useMemo } from 'react';
import { IComputationFunction, IJoinWorkflowStep, IViewField, IVisFilter } from '../interfaces';
import { addFilterForQuery, addJoinForQuery, addTransformForQuery, changeDatasetForQuery, processExpression } from '../utils/workflow';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../constants';
import { deduper, getFieldIdentifier, isNotEmpty } from '../utils';
import { Dialog, DialogContent } from './ui/dialog';
import { computed, toJS } from 'mobx';

const DataBoard = observer(function DataBoardModal() {
    const vizStore = useVizStore();
    const computation = useCompututaion();
    const {
        showDataBoard,
        selectedMarkObject,
        allFields,
        config,
        multiViewInfo,
        viewFilters,
        workflow: { workflow },
    } = vizStore;

    const datasetNames = useContext(DatasetNamesContext);

    const joinWorkflow = useMemo(() => workflow.filter((x): x is IJoinWorkflowStep => x.type === 'join'), [workflow]);
    const viewDatasets = useMemo(
        () =>
            deduper(
                joinWorkflow.flatMap((s) =>
                    s.foreigns.flatMap((f) => {
                        return f.keys.map((x) => ({
                            dataset: x.dataset,
                            as: x.as,
                        }));
                    })
                ),
                (x) => x.as
            ),
        [joinWorkflow]
    );
    const meta: IViewField[] = useMemo(
        () =>
            viewDatasets.length > 0
                ? viewDatasets
                      .flatMap(({ dataset, as }) =>
                          allFields
                              .filter((x) => x.dataset === dataset)
                              .map(
                                  (f): IViewField => ({
                                      ...f,
                                      basename: f.name,
                                      path: [datasetNames?.[dataset] ?? dataset, ...(f.path ?? [f.fid])],
                                      fid: `${as}.${f.fid}`,
                                  })
                              )
                      )
                      .concat(allFields.filter((x) => !x.dataset))
                : allFields,
        [viewDatasets, allFields]
    );

    const filters = useMemo(
        () =>
            computed(() => {
                const mark = toJS(selectedMarkObject);
                const entries: [string, any][] = Object.entries(mark).filter(
                    (x): x is [string, any] => ![MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID].includes(x[0]) && isNotEmpty(x[1])
                );
                if (isNotEmpty(mark[MEA_KEY_ID]) && isNotEmpty(mark[MEA_VAL_ID])) {
                    entries.push([mark[MEA_KEY_ID] as string, mark[MEA_VAL_ID]]);
                }
                return entries.map(([k, v]): IVisFilter => ({ fid: k, rule: { type: 'one of', value: [v] } }));
            }),
        [selectedMarkObject]
    ).get();

    const computedFileds = useMemo(
        () =>
            Object.values(multiViewInfo.views)
                .flat()
                .filter((x) => x.fid !== COUNT_FIELD_ID && x.computed && x.expression && x.aggName !== 'expr'),
        [allFields]
    );

    const filteredComputation = useMemo((): IComputationFunction => {
        return (query) =>
            computation(
                changeDatasetForQuery(
                    addJoinForQuery(
                        addTransformForQuery(
                            addFilterForQuery(
                                query,
                                viewFilters
                                    .map((f) => ({ fid: f.fid, rule: f.rule }))
                                    .filter((x): x is IVisFilter => !!x.rule)
                                    .concat(filters)
                            ),
                            computedFileds.map((x) => ({
                                expression: processExpression(x.expression!, allFields, {
                                    timezoneDisplayOffset: config.timezoneDisplayOffset,
                                    transformFid: multiViewInfo.processFid(x.joinPath),
                                }),
                                key: getFieldIdentifier(x),
                            }))
                        ),
                        joinWorkflow
                    ),
                    deduper(
                        viewDatasets.map((x) => x.dataset),
                        (x) => x
                    )
                )
            );
    }, [computation, filters, computedFileds, allFields, config]);

    const metas = useMemo(() => {
        return meta.filter((x) => x.aggName !== 'expr').filter((x) => ![MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID].includes(x.fid));
    }, [meta]);

    return (
        <Dialog
            open={showDataBoard}
            onOpenChange={() => {
                vizStore.setShowDataBoard(false);
            }}
        >
            <DialogContent>
                <div className="mt-4">
                    <DataTable size={100} computation={filteredComputation} metas={metas} disableFilter displayOffset={config.timezoneDisplayOffset} />
                </div>
            </DialogContent>
        </Dialog>
    );
});

export default DataBoard;
