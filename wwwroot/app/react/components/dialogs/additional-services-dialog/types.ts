/**
 * Additional Services Dialog Types
 *
 * TypeScript interfaces for the Additional Services Dialog component.
 */

import type {ShowToastFn} from '../../../services/toastService';

/**
 * Represents a single additional service item from the API.
 * Maps to ClientItemsViewModel from the backend.
 */
export interface AdditionalService {
    itemId: number;
    clientId: number;
    name: string;
    description: string;
    perItem: boolean;
    rate: number;
    onlyVan: boolean;
    selected: boolean;
}

/**
 * Job data required for the Additional Services Dialog.
 */
export interface AdditionalServicesJob {
    id: number;
    clientId: number;
    speedId: number;
    items: number;
    speedName: string;
}

/**
 * Props for the AdditionalServicesDialog component.
 */
export interface AdditionalServicesDialogProps {
    open: boolean;
    job: AdditionalServicesJob | null;
    onClose: () => void;
    onSubmit: (serviceIds: number[], totalCost: number) => Promise<void>;
    onLoadServices: () => Promise<AdditionalService[]>;
    onCalculateTotal: (selectedServices: AdditionalService[]) => Promise<number>;
    showToast: ShowToastFn;
}

/**
 * Result returned when dialog submits successfully.
 */
export interface AdditionalServicesResult {
    serviceIds: number[];
    totalCost: number;
}

/**
 * Options for opening the Additional Services Dialog.
 */
export interface OpenAdditionalServicesDialogOptions {
    job: AdditionalServicesJob;
    toastService?: {
        showToast: ShowToastFn;
    };
}

/**
 * Paginated response from the API.
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
}
