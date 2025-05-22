import {IDispatchJob} from "../interfaces/job.interface";

export function isDeliveryJob(job: IDispatchJob): boolean {
    if (!job || !job.jobNo) return false;

    const jobNumber = job.jobNo;

    // Original logic - check if last character is '1' or '3'
    const lastChar = jobNumber.charAt(jobNumber.length - 1);
    if (lastChar === '1' || lastChar === '3') return true;

    // New logic - if the last character is not a digit, it's a delivery job
    return isNaN(parseInt(lastChar));
}
