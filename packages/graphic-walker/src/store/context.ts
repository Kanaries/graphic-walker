import { ComputationContext } from '.';
import { composeContext } from '../utils/context';
import { themeContext, vegaThemeContext } from './theme';

export const VizAppContext = composeContext({ ComputationContext, themeContext, vegaThemeContext });
