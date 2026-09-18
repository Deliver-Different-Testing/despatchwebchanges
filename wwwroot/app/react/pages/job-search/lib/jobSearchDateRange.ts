/**
 * The Job Search date-range presets.
 *
 * The values are persisted with the operator's search criteria, so they must
 * not change.
 */
export enum JobSearchDateRange {
    Fortnight = 'fortnight',
    Today = 'today',
    Month = 'month',
    Custom = 'custom',
}

export default JobSearchDateRange;
