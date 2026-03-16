/**
 * Simple Price Edit Dialog Types
 */

import type {ShowToastFn} from '../../../services/toastService';

export type PricingMode = 'recalculate' | 'base' | 'gross';

export interface PriceEditResult {
    mode: PricingMode;
    amount: number;
}

/**
 * Props for the SimplePriceEditDialog component
 */
export interface SimplePriceEditDialogProps {
    open: boolean;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
    onClose: () => void;
    onSubmit: (mode: PricingMode, amount: number) => Promise<number>;
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
}
