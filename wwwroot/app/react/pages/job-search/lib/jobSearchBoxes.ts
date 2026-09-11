/**
 * The Job Search page's panels.
 *
 * Canonical home is here rather than `components/jobSearch/enums/`, because
 * that folder goes with the AngularJS page while these identifiers outlive it —
 * they key the persisted layout and per-box visibility, so the string values
 * must not change. The AngularJS enum re-exports this.
 */
export enum JobSearchBoxes {
    SearchWidget = 'pickDate',
    JobList = 'jobList',
    BulkJobList = 'bulkJobList',
    JobDetail = 'jobDetail',
    ScanList = 'scanList',
    Map = 'map',
    DeliveryJourney = 'deliveryJourney',
}

export default JobSearchBoxes;
