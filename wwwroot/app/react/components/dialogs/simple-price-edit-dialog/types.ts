/**
 * Simple Price Edit Dialog Types
 */

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
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
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
