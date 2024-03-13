import { ISemanticType } from "../../interfaces";

/**
 *
 * @param subViewFieldsSemanticTypes subViewFieldsSemanticTypes.length <= 2, subView means the single view visualization in facet system, we only need to consider the semantic types of the fields in the subView
 * @returns geom(mark) type
 */
export function autoMark(subViewFieldsSemanticTypes: ISemanticType[]): string {
    if (subViewFieldsSemanticTypes.length < 2) {
        if (subViewFieldsSemanticTypes[0] === "temporal" || subViewFieldsSemanticTypes[0] === 'quantitative') return "tick";
        return "bar";
    }
    const couter: Map<ISemanticType, number> = new Map();
    (["nominal", "ordinal", "quantitative", "temporal"] as ISemanticType[]).forEach((s) => {
        couter.set(s, 0);
    });
    for (let st of subViewFieldsSemanticTypes) {
        couter.set(st, couter.get(st)! + 1);
    }
    if (couter.get("nominal") === 1 || couter.get("ordinal") === 1) {
        return "bar";
    }
    if (couter.get("temporal") === 1 && couter.get("quantitative") === 1) {
        return "line";
    }
    if (couter.get("quantitative") === 2) {
        return "point";
    }
    return "point";
}
