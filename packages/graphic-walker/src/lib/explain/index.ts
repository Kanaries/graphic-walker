export * from './types';
export { explainMark, explainMarkAll } from './engine';
export { extremeValueExplainer } from './explainers/extremeValue';
export { uniqueMarkExplainer } from './explainers/uniqueMark';

import type { IExplainer } from './types';
import { extremeValueExplainer } from './explainers/extremeValue';
import { uniqueMarkExplainer } from './explainers/uniqueMark';

/**
 * Registered explainers in display-priority order:
 * data-quality evidence first, exploratory clues last.
 * (M2 adds contributing-dimension / contributing-measure between them.)
 */
export const defaultExplainers: IExplainer[] = [extremeValueExplainer, uniqueMarkExplainer];
