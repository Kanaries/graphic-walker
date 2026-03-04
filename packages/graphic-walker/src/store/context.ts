import { ComputationContext, DatasetNamesContext } from '.';
import { composeContext } from '../utils/context';
import { portalContainerContext, themeContext, vegaThemeContext } from './theme';

export const VizAppContext = composeContext({ ComputationContext, themeContext, vegaThemeContext, portalContainerContext, DatasetNamesContext });
