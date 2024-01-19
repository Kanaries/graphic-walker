import { observer } from 'mobx-react-lite';
import Modal from './modal';
import { useCompututaion, useVizStore } from '../store';
import DataTable from './dataTable';
import React, { useMemo } from 'react';
import { IComputationFunction, IVisFilter } from '../interfaces';
import { addFilterForQuery, addTransformForQuery, processExpression } from '../utils/workflow';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../constants';
import { isNotEmpty } from '../utils';

const DataBoard = observer(function DataBoardModal() {
    const vizStore = useVizStore();
    const computation = useCompututaion();
    const { showDataBoard, selectedMarkObject, allFields, config } = vizStore;
    const filters = useMemo(() => {
        const entries: [string, string | number][] = Object.entries(selectedMarkObject).filter(
            (x): x is [string, string | number] => ![MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID].includes(x[0]) && isNotEmpty(x[1])
        );
        if (isNotEmpty(selectedMarkObject[MEA_KEY_ID]) && isNotEmpty(selectedMarkObject[MEA_VAL_ID])) {
            entries.push([selectedMarkObject[MEA_KEY_ID] as string, selectedMarkObject[MEA_VAL_ID]]);
        }
        return entries.map(([k, v]): IVisFilter => ({ fid: k, rule: { type: 'one of', value: [v] } }));
    }, [selectedMarkObject]);
    const computedFileds = useMemo(() => allFields.filter((x) => x.fid !== COUNT_FIELD_ID && x.computed && x.expression && x.aggName !== 'expr'), [allFields]);

    const filteredComputation = useMemo((): IComputationFunction => {
        return (query) =>
            computation(
                addTransformForQuery(
                    addFilterForQuery(query, filters),
                    computedFileds.map((x) => ({
                        expression: processExpression(x.expression!, allFields, config),
                        key: x.fid!,
                    }))
                )
            );
    }, [computation, filters, computedFileds, allFields, config]);

    const metas = useMemo(() => {
        return allFields.filter((x) => x.aggName !== 'expr').filter((x) => ![MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID].includes(x.fid));
    }, [allFields]);

    return (
        <Modal
            show={showDataBoard}
            onClose={() => {
                vizStore.setShowDataBoard(false);
            }}
        >
            <div className="mt-4">
                <DataTable size={100} computation={filteredComputation} metas={metas} disableFilter displayOffset={config.timezoneDisplayOffset} />
            </div>
        </Modal>
    );
});

export default DataBoard;
