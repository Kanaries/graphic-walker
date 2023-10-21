// File name: gog represents the Grammar of Graphics  (theory by Wilkinson)
import { DraggableFieldState, IAnalyticType, ISemanticType } from "../interfaces";

type SpitialEncodings = Pick<DraggableFieldState, 'columns' | 'rows'> | Pick<DraggableFieldState, 'latitude' | 'longitude'>
type DraggableFieldValues = DraggableFieldState[Exclude<keyof DraggableFieldState, 'filters'>];
// LR = Lint Rules
const LR = {
    /**
     * measures should appear after dimensions, for we do not apply cross operator on measures.
     * @param fields 
     * @returns 
     */
    measureAfterDimension(fields: DraggableFieldValues): DraggableFieldValues {
        return fields.filter(f => f.analyticType === 'dimension').concat(fields.filter(f => f.analyticType === 'measure'));
    },
    // due to renderer, we set a limit of var can be applied to cross operator in GoG.
    crossLimit(maxLimit: number) {
        return function (fields: DraggableFieldValues): DraggableFieldValues {
            let dimCounter = 0;
            return fields.reduce<DraggableFieldValues>((acc, currField) => {
                if (currField.analyticType === 'dimension' && dimCounter < maxLimit) {
                    acc.push(currField);
                    dimCounter++;
                }
                if (currField.analyticType === 'measure') {
                    acc.push(currField);
                }
                return acc;
            }, [] as DraggableFieldValues);
        }
    },
    forceAnalyticType (analyticType: IAnalyticType) {
        return function (fields: DraggableFieldValues): DraggableFieldValues {
            return fields.map(f => ({
                ...f,
                analyticType
            }))
        }
    },
    forceSemanticType (semanticType: ISemanticType) {
        return function (fields: DraggableFieldValues): DraggableFieldValues {
            return fields.map(f => ({
                ...f,
                semanticType
            }))
        }
    },
}
type Operator<T> = (value: T) => T;
function applyOperations<T>(initialValue: T, operators: Operator<T>[]): T {
    return operators.reduce((currentValue, operator) => operator(currentValue), initialValue);
}

/**
 * Algebra lint is the lint fix encoding settings in algebra stage in the grammar of graphics.
 * graphic-walker calculates the algebra on spitial channels (axises) (for now, rows, columns)
 * This steps mainly decide how the sql is generated.
 * @param encodings 
 * @returns 
 */
export function algebraLint <T extends SpitialEncodings | DraggableFieldValues>(encodings: T): T {
    if (Array.isArray(encodings)) {
        return LR.measureAfterDimension(encodings) as T
    }
    if ('rows' in encodings && 'columns' in encodings && (encodings.rows.length > 0 || encodings.columns.length > 0)) {
        return {
            ...encodings,
            rows: applyOperations(encodings.rows, [LR.measureAfterDimension, LR.crossLimit(2)]),
            columns: applyOperations(encodings.columns, [LR.measureAfterDimension, LR.crossLimit(2)])
        };
    }  else if ('latitude' in encodings && 'longitude' in encodings && (encodings.latitude.length > 0 || encodings.longitude.length > 0)) {
        return {
            ...encodings,
            latitude: applyOperations(encodings.latitude, [
                LR.forceAnalyticType('dimension'),
                LR.forceSemanticType('quantitative'),
                LR.crossLimit(1)
            ]),
            longitude: applyOperations(encodings.longitude, [
                LR.forceAnalyticType('dimension'),
                LR.forceSemanticType('quantitative'),
                LR.crossLimit(1)
            ])
        };
    }
    return encodings;
}