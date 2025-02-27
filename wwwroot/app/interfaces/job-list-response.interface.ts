import {ActiveCourier} from "./courier.interface";

export interface JobListResponse {
    items: any[];             // Array of job items
    total: number;           // Total count of jobs
    page: number;            // Current page number
    limit: number;          // Page size limit
    undispatchedJobs: any[]; // Array of jobs without courier assignment
    activeCouriers: ActiveCourier[];  // List of active couriers
    allCouriers: ActiveCourier[];    // List of all couriers
}
