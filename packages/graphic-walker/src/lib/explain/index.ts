export * from './types';
export { explainMark, explainMarkAll } from './engine';
export { extremeValueExplainer } from './explainers/extremeValue';
export { uniqueMarkExplainer } from './explainers/uniqueMark';
export { contributingDimExplainer } from './explainers/contributingDim';
export { contributingMeasureExplainer } from './explainers/contributingMeasure';

import type { IExplainer } from './types';
import { extremeValueExplainer } from './explainers/extremeValue';
import { uniqueMarkExplainer } from './explainers/uniqueMark';
import { contributingDimExplainer } from './explainers/contributingDim';
import { contributingMeasureExplainer } from './explainers/contributingMeasure';

/**
 * Registered explainers in display-priority order:
 * data-quality evidence first, model-based evidence next,
 * exploratory clues last.
 */
export const defaultExplainers: IExplainer[] = [
    extremeValueExplainer,
    contributingDimExplainer,
    contributingMeasureExplainer,
    uniqueMarkExplainer,
];
