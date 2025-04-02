import {ActiveCourierViewModel} from "./courier.interface";
import {DispatchJob} from "./job.interface";

export interface JobListResponse {
    items: DispatchJob[];             // Array of job items
    undispatchedJobs: any[]; // Array of jobs without courier assignment
    activeCouriers: ActiveCourierViewModel[];  // List of active couriers
    allCouriers: ActiveCourierViewModel[];    // List of all couriers
}
