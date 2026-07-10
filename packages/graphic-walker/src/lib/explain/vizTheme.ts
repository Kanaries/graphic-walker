/**
 * Visual identity for evidence charts (Tableau-inspired):
 * neutral gray = context (all marks / in-range records),
 * one fixed accent = the selected mark / the spotlighted records.
 *
 * The accent is intentionally independent of the host chart theme — evidence
 * charts are analysis UI, not user visualizations, and a stable
 * gray-vs-accent contrast keeps their semantics readable on any theme.
 * Both colors are chosen to work on light and dark backgrounds.
 */

export const CONTEXT_COLOR = '#9aa4b2';
export const ACCENT_COLOR = '#3b82f6';

export const GROUP_SELECTED = 'Selected mark';
export const GROUP_CONTEXT = 'All other marks';

/** shared 2-entry color scale so every evidence chart reads the same way */
export const GROUP_COLOR_SCALE = {
    domain: [GROUP_SELECTED, GROUP_CONTEXT],
    range: [ACCENT_COLOR, CONTEXT_COLOR],
};

export const LEGEND_BOTTOM = { orient: 'bottom', title: null };
