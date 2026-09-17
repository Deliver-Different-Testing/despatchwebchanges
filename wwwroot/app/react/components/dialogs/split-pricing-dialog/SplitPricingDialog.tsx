/**
 * Split Pricing Dialog
 *
 * Thin wrapper around the shared SplitPricingBreakdownDialog in split mode
 * (docs/pricing/job-splitting-price-breakdown.md §8 — "the same component" for the pre-split
 * preview and the post-split edit grid). All rendering, editing, and the Confirm & Split /
 * Cancel result shape live in SplitPricingBreakdownDialog; this file only maps the preview
 * props through, so `openSplitPricingDialog`/`splitJobFlow.ts`'s call contract is unchanged.
 */

import React from 'react';
import {SplitPricingBreakdownDialog, type SplitPricingResult} from '../split-pricing-breakdown-dialog/SplitPricingBreakdownDialog';
import type {SplitPricingPreview} from '../../../interfaces/splitJobs';

export type {SplitPricingResult};

export interface SplitPricingDialogProps {
    open: boolean;
    jobNo: string;
    preview: SplitPricingPreview;
    onClose: (result: SplitPricingResult) => void;
}

export const SplitPricingDialog: React.FC<SplitPricingDialogProps> = ({open, jobNo, preview, onClose}) => (
    <SplitPricingBreakdownDialog mode="split" open={open} jobNo={jobNo} preview={preview} onClose={onClose}/>
);

export default SplitPricingDialog;
