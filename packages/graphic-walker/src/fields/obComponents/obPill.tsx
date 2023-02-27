import { BarsArrowDownIcon, BarsArrowUpIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { observer } from "mobx-react-lite";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DraggableProvided } from "@kanaries/react-beautiful-dnd";
import { COUNT_FIELD_ID } from "../../constants";
import { IDraggableStateKey } from "../../interfaces";
import { useGlobalStore } from "../../store";
import { Pill } from "../components";
import { AGGREGATOR_LIST } from "../fieldsContext";
import DropdownContext from "../../components/dropdownContext";

interface PillProps {
    provided: DraggableProvided;
    fIndex: number;
    dkey: IDraggableStateKey;
}
const OBPill: React.FC<PillProps> = (props) => {
    const { provided, dkey, fIndex } = props;
    const { vizStore } = useGlobalStore();
    const { visualConfig } = vizStore;
    const field = vizStore.draggableFieldState[dkey.id][fIndex];
    const { t } = useTranslation("translation", { keyPrefix: "constant.aggregator" });

    const aggregationOptions = useMemo(() => {
        return AGGREGATOR_LIST.map((op) => ({
            value: op,
            label: t(op),
        }));
    }, []);

    return (
        <Pill
            ref={provided.innerRef}
            colType={field.analyticType === "dimension" ? "discrete" : "continuous"}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
        >
            <span className="flex-1 truncate">{field.name}</span>&nbsp;
            {field.analyticType === "measure" && field.fid !== COUNT_FIELD_ID && visualConfig.defaultAggregated && (
                <DropdownContext
                    options={aggregationOptions}
                    onSelect={(value) => {
                        vizStore.setFieldAggregator(dkey.id, fIndex, value);
                    }}
                >
                    <span className="bg-transparent text-gray-200 dark:text-gray-700 float-right focus:outline-none focus:border-gray-500 dark:focus:border-gray-400 flex items-center ml-2">
                        {field.aggName || ""}
                        <ChevronUpDownIcon className="w-3" />
                    </span>
                </DropdownContext>
            )}
            {/* {field.analyticType === "measure" && field.fid !== COUNT_FIELD_ID && visualConfig.defaultAggregated && (
                <select
                    className="bg-transparent text-gray-700 float-right focus:outline-none focus:border-gray-500"
                    value={field.aggName || ""}
                    onChange={(e) => {
                        vizStore.setFieldAggregator(dkey.id, fIndex, e.target.value);
                    }}
                >
                    {AGGREGATOR_LIST.map((op) => (
                        <option className="inline" value={op} key={op}>
                            {t(op)}
                        </option>
                    ))}
                </select>
            )} */}
            {field.analyticType === "dimension" && field.sort === "ascending" && (
                <BarsArrowUpIcon className="float-right w-3" role="status" aria-label="Sorted in ascending order" />
            )}
            {field.analyticType === "dimension" && field.sort === "descending" && (
                <BarsArrowDownIcon className="float-right w-3" role="status" aria-label="Sorted in descending order" />
            )}
        </Pill>
    );
};

export default observer(OBPill);
