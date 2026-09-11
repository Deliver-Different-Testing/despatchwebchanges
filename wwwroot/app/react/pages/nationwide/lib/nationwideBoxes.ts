/**
 * The Nationwide page's seven panels.
 *
 * Canonical home is here rather than `components/Nationwide/enums/`, because
 * that folder goes with the AngularJS page in Phase 3 while these identifiers
 * outlive it — they key the persisted layout and per-box visibility, so the
 * string values must not change.
 */
export enum NationwideBoxes {
    NewJobs = 'jobsList',
    PodJobs = 'jobsListPOD',
    RepriceJobs = 'jobsListReprice',
    Tasks = 'tasksList',
    Map = 'map',
    FlightAgents = 'flightAgentDataTable',
    JobDetail = 'jobDetail',
}

export default NationwideBoxes;
