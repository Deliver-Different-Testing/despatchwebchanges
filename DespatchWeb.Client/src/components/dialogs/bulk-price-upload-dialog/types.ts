/**
 * Bulk Price Upload Dialog Types
 *
 * TypeScript interfaces for the Bulk Price Upload Dialog component.
 */

import type {ShowToastFn} from '../../../services/toastService';

export type PricingMode = 'recalculate' | 'base' | 'gross';
export type DialogState = 'upload' | 'mode-select' | 'loading' | 'result';

export interface BulkPricePreviewRow {
    jobId: number;
    jobNo: string;
    field: string;
    oldAmount: number;
    newAmount: number;
    isPrebook: boolean;
    skipped?: boolean;
    error?: string;
}

export interface BulkPricePreviewResponse {
    rows: BulkPricePreviewRow[];
    /** Jobs whose price was actually updated. */
    totalJobs: number;
    /** Jobs from the file that could not be updated (not found, locked, or unsupported in this mode). */
    skippedJobs: number;
    totalOldAmount: number;
    totalNewAmount: number;
}

export interface BulkPriceUploadDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (file: File, mode: PricingMode) => Promise<BulkPricePreviewResponse>;
    showToast: ShowToastFn;
}

export interface OpenBulkPriceUploadDialogOptions {
    toastService?: {
        showToast: ShowToastFn;
    };
}
