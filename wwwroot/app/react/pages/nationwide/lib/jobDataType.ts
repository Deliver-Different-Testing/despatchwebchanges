/**
 * Which of the Nationwide page's three job lists a piece of work refers to.
 *
 * Canonical home is here rather than in `components/Nationwide/enums/`, because
 * that folder goes away with the AngularJS page in Phase 3 while the shared
 * modules and the React page outlive it. The AngularJS enum re-exports this.
 */
export enum JobDataType {
    NEW = 'new',
    POD = 'pod',
    REPRICE = 'reprice',
    ALL = 'all',
}

export default JobDataType;
