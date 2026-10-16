/**
 * Which of the Nationwide page's three job lists a status change affects.
 *
 * Framework-free so the AngularJS controller and the React page share it.
 * Extracted from `STATUS_TO_LIST_MAP` (306) and the refresh-set derivation in
 * `handleStatusChange` (897).
 */

import {JobDataType} from './jobDataType';

/**
 * Job status id → the list it appears on.
 *
 * Only these three statuses surface on this page; anything else maps to nothing
 * and needs no refresh.
 */
export const STATUS_TO_LIST_MAP: Record<number, JobDataType[]> = {
    1: [JobDataType.NEW],
    3: [JobDataType.POD],
    4: [JobDataType.REPRICE],
};

/** The lists a single status feeds; empty when the status is not tracked here. */
export function listsForStatus(statusId: number): JobDataType[] {
    return STATUS_TO_LIST_MAP[statusId] ?? [];
}

/**
 * The lists to refresh after a job moves between statuses — the one it left and
 * the one it joined, de-duplicated.
 *
 * An empty result means nothing on this page changed, so the caller can skip
 * the refresh entirely.
 */
export function listsAffectedByStatusChange(
    previousStatusId: number,
    newStatusId: number,
): JobDataType[] {
    return Array.from(new Set([
        ...listsForStatus(previousStatusId),
        ...listsForStatus(newStatusId),
    ]));
}
