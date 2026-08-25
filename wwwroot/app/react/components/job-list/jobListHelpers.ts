/**
 * Shared helpers used by both JobListPanel and JobListTable.
 */
import dayjs from 'dayjs';
import {JobStatus} from '../../../enums/job-status.enum';
import type {DispatchJob} from '../../interfaces/dispatchJob';
import {resolvedStatusId} from '../../utils/jobStatus';

/**
 * Re-exported rather than re-declared. The local copy had drifted — it was missing Void, so a voided
 * job had no name here and fell through every status check as an unrecognised id.
 */
export const JOB_STATUS = JobStatus;

// Cached "now" timestamp — refreshed at most once per second to avoid
// creating a new dayjs instance for every job in every helper call.
let _cachedNow: dayjs.Dayjs | null = null;
let _cachedNowTs = 0;

export function getNow(): dayjs.Dayjs {
    const ts = Date.now();
    if (!_cachedNow || ts - _cachedNowTs > 1000) {
        _cachedNow = dayjs();
        _cachedNowTs = ts;
    }
    return _cachedNow;
}

export function isUrgent(job: DispatchJob): boolean {
    if (!job.booked) return false;
    const now = getNow();
    const minutesUntilDelivery = dayjs(job.booked).diff(now, 'minutes');
    return minutesUntilDelivery <= 30 && minutesUntilDelivery > 0;
}

export function isDelivered(job: DispatchJob): boolean {
    return resolvedStatusId(job) === JOB_STATUS.Completed;
}

// "In transit" = assigned and being worked (dispatched through to in-transit),
// as opposed to "Active" (needs a courier) or "Done" (delivered).
const IN_TRANSIT_STATUSES: number[] = [
    JOB_STATUS.Dispatched,
    JOB_STATUS.Accepted,
    JOB_STATUS.PickedUp,
    JOB_STATUS.InTransit,
];

export function isInTransit(job: DispatchJob): boolean {
    return IN_TRANSIT_STATUSES.includes(resolvedStatusId(job));
}

export function needsDispatch(job: DispatchJob): boolean {
    if (job.assignedCourier) return false;
    if (isDelivered(job)) return false;
    if (resolvedStatusId(job) === JOB_STATUS.Void) return false;
    return !isInTransit(job);
}
