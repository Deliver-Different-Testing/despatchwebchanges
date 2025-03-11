import {ActiveCourierViewModel} from "./courier.interface";

export interface JobListResponse {
    items: any[];             // Array of job items
    total: number;           // Total count of jobs
    page: number;            // Current page number
    limit: number;          // Page size limit
    undispatchedJobs: any[]; // Array of jobs without courier assignment
    activeCouriers: ActiveCourierViewModel[];  // List of active couriers
    allCouriers: ActiveCourierViewModel[];    // List of all couriers
}
