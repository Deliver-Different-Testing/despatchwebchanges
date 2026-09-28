/**
 * The Dispatch page's panels.
 *
 * Canonical home is here rather than `components/home/enums/`, because that
 * folder goes with the AngularJS page while these identifiers outlive it — they
 * key the persisted layout and per-box visibility, so the string values must
 * not change. The AngularJS enum re-exports this.
 */
export enum DispatchBoxes {
    JobsList = 'list',
    JobDetail = 'detail',
    CurrentWork = 'currentWork',
    Supports = 'supports',
    DriverLocations = 'driverLocations',
    Map = 'map',
    OverviewDeliveries = 'overviewDeliveries',
    OpenJobs = 'openJobs',
}

export default DispatchBoxes;
