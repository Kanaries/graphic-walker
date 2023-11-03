import { observer } from 'mobx-react-lite';
import Modal from './modal';
import { useCompututaion, useVizStore } from '../store';
import DataTable from './dataTable';
import React, { useMemo } from 'react';
import { IComputationFunction, IVisFilter } from '../interfaces';
import { addFilterForQuery, addTransformForQuery } from '../utils/workflow';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../constants';

const DataBoard = observer(function DataBoardModal() {
    const vizStore = useVizStore();
    const computation = useCompututaion();
    const { showDataBoard, selectedMarkObject, allFields } = vizStore;
    const filters = useMemo(() => {
        const entries: [string, string | number][] = Object.entries(selectedMarkObject).filter(
            (x): x is [string, string | number] => ![MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID].includes(x[0]) && x[1] !== undefined
        );
        if (selectedMarkObject[MEA_KEY_ID] !== undefined && selectedMarkObject[MEA_VAL_ID] !== undefined) {
            entries.push([selectedMarkObject[MEA_KEY_ID] as string, selectedMarkObject[MEA_VAL_ID]]);
        }
        return entries.map(([k, v]): IVisFilter => ({ fid: k, rule: { type: 'one of', value: [v] } }));
    }, [selectedMarkObject]);
    const computedFileds = useMemo(() => allFields.filter((x) => x.computed && x.expression), [allFields]);

    const filteredComputation = useMemo((): IComputationFunction => {
        return (query) =>
            computation(
                addTransformForQuery(
                    addFilterForQuery(query, filters),
                    computedFileds.map((x) => ({
                        expression: x.expression!,
                        key: x.fid!,
                    }))
                )
            );
    }, [computation, filters, computedFileds]);

    const metas = useMemo(() => {
        return allFields.filter((x) => ![MEA_KEY_ID, MEA_VAL_ID, COUNT_FIELD_ID].includes(x.fid));
    }, [allFields]);

    return (
        <Modal
            show={showDataBoard}
            onClose={() => {
                vizStore.setShowDataBoard(false);
            }}
        >
            <div className="mt-4">
                <DataTable size={100} computation={filteredComputation} metas={metas} disableFilter />
            </div>
        </Modal>
    );
});

export default DataBoard;
