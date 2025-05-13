import {IDispatchJob} from "../interfaces/job.interface";

export function isDeliveryJob(job: IDispatchJob): boolean {
    if (!job || !job.jobNo) return false;

    const jobNumber = job.jobNo;
    return jobNumber.charAt(jobNumber.length - 1) === '1' || jobNumber.charAt(jobNumber.length - 1) === '3';
}
