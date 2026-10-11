/**
 * The Nationwide page's seven panels.
 *
 * These identifiers key the persisted layout and per-box visibility, so the
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
