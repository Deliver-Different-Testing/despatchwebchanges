/**
 * Types for the Recurring Log panel.
 *
 * Mirrors the backend RecurringJourneyDto (Models/Dto/RecurringJourneyDto.cs).
 * Status is serialized as a string by JsonStringEnumConverter so the union
 * stays narrow on the frontend.
 *
 * Note: the user-visible label for this surface is "Recurring Log" — the
 * "DeliveryJourney" naming is kept on the wire to mirror the backend.
 */

import type {Dayjs} from 'dayjs';

export type RecurringJourneyStatus = 'Pending' | 'InProgress' | 'Completed' | 'Voided';

export interface RecurringJourneyBreakdown {
    total: number;
    completed: number;
    voided: number;
    pending: number;
}

export interface RecurringJourneyChild {
    jobId: number;
    jobNumber: string;
}

export interface RecurringJourneyPodDto {
    time: string;       // ISO string
    signedBy: string | null;
}

export interface RecurringJourneyPod {
    time: Dayjs;
    signedBy: string | null;
}

export interface RecurringJourneyRunDto {
    parentJobId: number;
    parentJobNumber: string;
    serviceDate: string;     // ISO string
    status: RecurringJourneyStatus;
    miles: number | null;
    pod: RecurringJourneyPodDto | null;
    children: RecurringJourneyChild[];
}

export interface RecurringJourneyRun {
    parentJobId: number;
    parentJobNumber: string;
    serviceDate: Dayjs;
    status: RecurringJourneyStatus;
    miles: number | null;
    pod: RecurringJourneyPod | null;
    children: RecurringJourneyChild[];
}

export interface RecurringJourneyDto {
    breakdown: RecurringJourneyBreakdown;
    runs: RecurringJourneyRunDto[];
}

export interface RecurringJourney {
    breakdown: RecurringJourneyBreakdown;
    runs: RecurringJourneyRun[];
}
