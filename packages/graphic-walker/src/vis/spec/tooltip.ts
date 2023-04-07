import { IViewField } from "../../interfaces";

export function addTooltipEncode (encoding: {[key: string]: any}, details: Readonly<IViewField[]> = []) {
    const encs = Object.keys(encoding).filter(ck => ck !== 'tooltip').map(ck => {
        return {
            field: encoding[ck].field,
            type: encoding[ck].type,
            title: encoding[ck].title
        }
    }).concat(details.map(f => ({
        field: f.fid,
        title: f.name,
        type: f.semanticType
    })))
    encoding.tooltip = encs
}