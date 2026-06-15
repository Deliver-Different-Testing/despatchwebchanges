/**
 * Job-related interfaces for React components
 */

import {AddressViewModel} from './address';

export interface Suggestion {
    id: number;
    text: string;
}

export interface CreateJobRequest {
    clientId: number;
    deliverToContact: string;
    podName: string;
    pickUpAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
    date: string;
    fromContactName: string;
    refA: string;
    refB: string;
    deliveryNotes: string;
    pickupNotes: string;
    jobNotes: string;
    van: boolean;
    truck: boolean;
    pedal: boolean;
    attention: boolean;
    vanOk: boolean;
    reprice: boolean;
    void: boolean;
    done: boolean;
    charge: number;
    fromLat: number;
    fromLong: number;
    toLat: number;
    toLong: number;
    speedId: number;
    vehicleId: number;
    weightKg: number | null;
    weightLb: number | null;
}

export interface RelatedJobDto {
    id: number;
    text: string;
    selected: boolean;
    isBulkJob?: boolean;
    isArchived?: boolean;
}

export interface VoidJobRequest {
    jobId: number;
    voidSingleJobOnly: boolean;
    voidReason?: string;
    selectedJobIds?: number[];
}

export interface VoidBulkJobRequest {
    bulkJobId: number;
    voidSingleJobOnly: boolean;
    voidReason?: string;
    selectedJobIds?: number[];
}

export interface VoidJobDialogJob {
    id: number;
    jobNo: string;
    isBulkJob: boolean;
    isArchived?: boolean;
}

export interface VoidJobResult {
    success: boolean;
    voidedCount: number;
}

export interface RelatedJob {
    id: number;
    text: string;
    selected: boolean;
    isBulkJob?: boolean;
    isArchived?: boolean;
}
