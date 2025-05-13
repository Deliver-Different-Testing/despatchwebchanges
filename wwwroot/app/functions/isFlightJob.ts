import {IDispatchJob} from "../interfaces/job.interface";

export function isFlightJob(job: IDispatchJob): boolean {
    if (!job || !job.jobNo) return false;

    const jobNumber = job.jobNo;
    return jobNumber.charAt(jobNumber.length - 1) === '2';
}
