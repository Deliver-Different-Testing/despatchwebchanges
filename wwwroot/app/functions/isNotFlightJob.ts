import {IDispatchJob} from "../interfaces/job.interface";

export function isNotFlightJob(job: IDispatchJob): boolean {
    if (!job || !job.jobNo) return false;

    const lastChar = job.jobNo.charAt(job.jobNo.length - 1);
    return lastChar === '1' || lastChar === '3';
}
