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

// ── Priority column ──────────────────────────────────────────────────

// Late flags are computed server-side and land on the raw status, so these read
// `statusId` rather than the resolved id — the resolver folds both into "in transit".
export function isLateForPickup(job: DispatchJob): boolean {
    return job.statusId === JOB_STATUS.LatePickup;
}

export function isLateForDelivery(job: DispatchJob): boolean {
    return job.statusId === JOB_STATUS.LateDelivery;
}

export function isChilledJob(job: DispatchJob): boolean {
    if (!job.vehicle?.text) return false;
    const vehicleName = job.vehicle.text.toLowerCase();
    return vehicleName.includes('chilled') || vehicleName.includes('frozen');
}

export function isMultiPartJob(job: DispatchJob): boolean {
    return !!(job.isParentOrSingle && job._groupChildren && job._groupChildren.length > 0);
}

/**
 * The priority column's branches, in precedence order — job type first, then
 * attention, then status. This array IS the order: `getPriorityIndicator` picks
 * the row's marker from `priorityKey`, and the column sorts on `priorityRank`,
 * so what an operator sees grouped is what a priority sort groups.
 */
export const PRIORITY_ORDER = [
    'flight', 'chilled', 'multiPart', 'partner', 'latePickup', 'lateDelivery',
    'urgent', 'inTransit', 'done', 'active', 'none',
] as const;

export type PriorityKey = typeof PRIORITY_ORDER[number];

export function priorityKey(job: DispatchJob): PriorityKey {
    if (job.toAirportId || job.fromAirportId) return 'flight';
    if (isChilledJob(job)) return 'chilled';
    if (isMultiPartJob(job)) return 'multiPart';
    if (job.isPartnerJob) return 'partner';
    if (isLateForPickup(job)) return 'latePickup';
    if (isLateForDelivery(job)) return 'lateDelivery';
    if (isUrgent(job)) return 'urgent';
    if (isInTransit(job)) return 'inTransit';
    if (isDelivered(job)) return 'done';
    if (needsDispatch(job)) return 'active';
    return 'none';
}

export function priorityRank(job: DispatchJob): number {
    return PRIORITY_ORDER.indexOf(priorityKey(job));
}
