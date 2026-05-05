/**
 * Edit Parcel Dimensions Dialog Types
 */

import type {ShowToastFn} from '../../../services/toastService';

/**
 * Parcel dimensions - mirrors IParcelDimensions from job.interface.ts
 */
export interface ParcelDimensions {
    itemId?: number;
    itemName: string;
    height?: number;
    length?: number;
    depth?: number;
    weight?: number;
    dimensions: string;
    barcode?: string;
}

/**
 * Props for the EditParcelDimensionsDialog component
 */
export interface EditParcelDimensionsDialogProps {
    open: boolean;
    parcels: ParcelDimensions[];
    jobId?: number;
    bulkJobId?: number;
    isUsCustomer: boolean;
    jobWeight?: number;
    onClose: () => void;
    onSubmit: (result: EditParcelDimensionsDialogResult) => void;
    showToast: ShowToastFn;
}

/**
 * Options passed when opening the dialog from AngularJS
 */
export interface EditParcelDimensionsDialogOptions {
    parcels: ParcelDimensions[];
    jobId?: number;
    bulkJobId?: number;
    isUsCustomer: boolean;
    jobWeight?: number;
}

/**
 * Result returned when the dialog is submitted
 */
export interface EditParcelDimensionsDialogResult {
    parcels: ParcelDimensions[];
    totalWeight: number;
}
