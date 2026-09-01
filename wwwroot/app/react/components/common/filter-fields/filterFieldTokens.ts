/**
 * The chrome shared by the app's filter panels — job search's Search Criteria and
 * the overview's Quick Filters.
 *
 * Both are a single scrolling column of labelled criteria, so neither uses a
 * header bar per section: a `PanelHeader` names the panel once at the top, and
 * inside it each criterion is announced by a small uppercase label sitting
 * directly above its control. Section bars would out-shout the controls they
 * introduce, and there are six or more of them.
 *
 * Lived in `SearchCriteriaPanel` until the overview adopted the same vocabulary.
 */

/**
 * The label above a criterion. Small, uppercase and tracked out, so it reads as
 * a field name rather than a heading — it is quieter than the control it names.
 */
export const groupLabelProps = {
    fz: '0.625rem',
    fw: 500,
    c: 'dimmed',
    tt: 'uppercase',
    lh: 2.5,
    style: {letterSpacing: '0.08333em'},
} as const;

/**
 * A criterion's input. 34px rather than Mantine's `xs` default so a column of
 * six or more fields stays compact without the text shrinking to match.
 */
export const criteriaFieldProps = {
    size: 'xs',
    styles: {input: {height: 34, minHeight: 34, fontSize: '0.8125rem'}},
} as const;

/**
 * Every filter control stands this tall, so a row of them lines up whatever it
 * is made of — a Select, an Autocomplete, and a group of day buttons otherwise
 * settle at three different heights and the row reads as ragged. Matches
 * Mantine's `xs` input height, which is what the Selects already were.
 */
export const FILTER_CONTROL_HEIGHT = 30;

/** Gap between a criterion's label and its control. */
export const CRITERION_LABEL_GAP = 6;

/** Gap between one criterion and the next, and the panel's own padding. */
export const CRITERION_GAP = 16;
