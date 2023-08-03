import { IViewField } from "../../interfaces";
import { getMeaAggKey } from "../../utils";

export function addTooltipEncode (encoding: {[key: string]: any}, details: Readonly<IViewField[]> = [], defaultAggregated = false) {
    const encs = Object.keys(encoding).filter(ck => ck !== 'tooltip').map(ck => {
        return {
            field: encoding[ck].field,
            type: encoding[ck].type,
            title: encoding[ck].title,
        }
    }).concat(details.map(f => ({
        field: defaultAggregated ? getMeaAggKey(f.fid, f.aggName) : f.fid,
        title: defaultAggregated && f.aggName ? `${f.aggName}(${f.name})` : f.name,
        type: f.semanticType,
    })))
    encoding.tooltip = encs
}