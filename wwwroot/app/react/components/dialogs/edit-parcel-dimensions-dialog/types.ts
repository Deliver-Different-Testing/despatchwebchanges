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
    cubic?: number;
    dimensions: string;
    barcode?: string;
    itemTypes?: Array<{name: string; quantity: number}>;
}

/**
 * Props for the EditParcelDimensionsDialog component
 */
export interface EditParcelDimensionsDialogProps {
    open: boolean;
    parcels: ParcelDimensions[];
    jobId?: number;
    bulkJobId?: number;
    /** Human-facing job number, used to auto-fill barcodes as `{jobNumber}-N` when items are added. */
    jobNumber?: string | number;
    isUsCustomer: boolean;
    jobWeight?: number;
    /**
     * When true, dimensions/weight are entered once for the whole job (DimensionsType=2)
     * rather than per parcel — the weight total and "Match proportionally" scaling
     * sum row weights directly instead of multiplying by each row's quantity.
     */
    calculateDimsOncePerJob?: boolean;
    /**
     * When true, the dialog acts as a value-capture step only — no POST to
     * /job/UpdateJobPackages, no success toast — and resolves with the
     * captured parcels so the caller can hand them off to the partner-job
     * change-request dialog (Packages requires partner approval).
     */
    partnerMode?: boolean;
    /** When true the dialog opens in view-only mode: fields disabled, no Save. */
    readOnly?: boolean;
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
    jobNumber?: string | number;
    isUsCustomer: boolean;
    jobWeight?: number;
    calculateDimsOncePerJob?: boolean;
    partnerMode?: boolean;
    readOnly?: boolean;
}

/**
 * Result returned when the dialog is submitted
 */
export interface EditParcelDimensionsDialogResult {
    parcels: ParcelDimensions[];
    totalWeight: number;
    calculateDimsOncePerJob: boolean;
}
