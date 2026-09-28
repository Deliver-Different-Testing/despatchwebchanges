/**
 * The Job Search page's panels.
 *
 * These identifiers key the persisted layout and per-box visibility, so the
 * string values must not change.
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
