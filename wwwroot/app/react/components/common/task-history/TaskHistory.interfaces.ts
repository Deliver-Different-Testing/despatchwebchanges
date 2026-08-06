/**
 * Task History Interfaces
 *
 * Type definitions for the React TaskHistory component.
 */

import {Dayjs} from 'dayjs';

export enum DensityMode {
    Normal = 'normal',
    Dense = 'dense',
    UltraDense = 'ultra-dense'
}

export interface DeliveryHistoryConfig {
    showSummaryStats?: boolean;
    densityMode?: DensityMode;
}

export interface DeliveryJourney {
    id: string;
    jobId: number;
    title: string;
    icon: string;
    description: string;
    date: Dayjs;
    tags: string[];
    status: 'completed' | 'current' | 'todo' | 'pending' | 'waiting';
    notes: string;
    grandTotalAfter?: number | null;
    /** Staff member or courier who made the change; absent when unrecorded. */
    performedBy?: string | null;
    _dateStr?: string;
}

export interface DispatchServiceInterface {
    getDeliveryJourney(jobId: number): Promise<DeliveryJourney[]>;
}

export interface TaskHistoryProps {
    jobId?: number;
    config?: DeliveryHistoryConfig;
    onDeliveryEventClick?: (deliveryEvent: DeliveryJourney) => void;
    /** @deprecated Use without dispatchService — component now uses React Query internally */
    dispatchService?: DispatchServiceInterface;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
    showInfoToast?: (message: string) => void;
    isUsCustomer?: boolean;
}

export interface DeliveryJourneyDto {
    id: string;
    jobId: number;
    title: string;
    icon: string;
    description: string;
    date: string;
    tags: string[];
    status: string;
    notes: string;
    grandTotalAfter?: number | null;
    performedBy?: string | null;
}
// Backward compatibility aliases
export type IDeliveryHistoryConfig = DeliveryHistoryConfig;
export type IDeliveryJourney = DeliveryJourney;
export type IDeliveryJourneyDto = DeliveryJourneyDto;
