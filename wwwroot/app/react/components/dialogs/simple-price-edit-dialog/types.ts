/**
 * Simple Price Edit Dialog Types
 */

import type {ShowToastFn} from '../../../services/toastService';

export type PricingMode = 'recalculate' | 'base' | 'gross';

export interface PriceEditResult {
    mode: PricingMode;
    amount: number;
}

export interface ChildJobPrice {
    jobId: number;
    jobNumber: string;
    charge: number;
    isPrebook: boolean;
    isBulkJob: boolean;
}

export interface ChildPriceUpdate {
    jobId: number;
    isPrebook: boolean;
    isBulkJob: boolean;
    newPrice: number;
}

/**
 * Props for the SimplePriceEditDialog component
 */
export interface SimplePriceEditDialogProps {
    open: boolean;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
    isBulk?: boolean;
    hideRecalculate?: boolean;
    childJobs?: ChildJobPrice[];
    onClose: () => void;
    onSubmit: (mode: PricingMode, amount: number, childUpdates: ChildPriceUpdate[]) => Promise<number>;
    showToast: ShowToastFn;
}

/**
 * Options passed when opening the dialog from AngularJS
 */
export interface SimplePriceEditDialogOptions {
    jobId: number;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
    isBulk?: boolean;
    hideRecalculate?: boolean;
}
