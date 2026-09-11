/**
 * The Job Search date-range presets.
 *
 * Canonical home is here rather than `components/jobSearch/enums/`; the values
 * are persisted with the operator's search criteria, so they must not change.
 */
export enum JobSearchDateRange {
    Fortnight = 'fortnight',
    Today = 'today',
    Month = 'month',
    Custom = 'custom',
}

export default JobSearchDateRange;
