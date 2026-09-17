/**
 * Split Pricing Breakdown Dialog React Module
 *
 * Entry point for the React-based Split Pricing Breakdown Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {SplitPricingBreakdownDialog} from './SplitPricingBreakdownDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {pricingBreakdownApi} from '../../../services/pricingBreakdownApi';
import {splitPriceBreakdownApi} from '../../../services/splitPriceBreakdownApi';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';
import type {SplitPriceBreakdown, UpdateSplitPricingBreakdownRequest} from '../../../interfaces/splitJobs';

interface ApiService {
    save: (request: UpdateSplitPricingBreakdownRequest) => Promise<void>;
    addItem: (jobId: number, name: string, revenue: number) => Promise<SplitPriceBreakdown>;
    deleteItem: (jobId: number, pricingBreakdownId: number) => Promise<SplitPriceBreakdown>;
}

interface SplitPricingBreakdownPayload {
    breakdown: SplitPriceBreakdown;
    apiService: ApiService;
}

async function refetchOrThrow(jobId: number): Promise<SplitPriceBreakdown> {
    const refreshed = await splitPriceBreakdownApi.getSplitPricingBreakdown(jobId);
    if (!refreshed) {
        throw new Error('This job is no longer a split parent with an editable breakdown.');
    }
    return refreshed;
}

const host = createDialogHost<SplitPricingBreakdownPayload, null>({
    containerId: 'react-split-pricing-breakdown-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <SplitPricingBreakdownDialog
            mode="edit"
            open={open}
            breakdown={payload.breakdown}
            onClose={() => close(null)}
            onSave={(request) => payload.apiService.save(request)}
            onAddItem={(name, revenue) => payload.apiService.addItem(payload.breakdown.jobId, name, revenue)}
            onDeleteItem={(pricingBreakdownId) =>
                payload.apiService.deleteItem(payload.breakdown.jobId, pricingBreakdownId)}
            showToast={showToast}
        />
    ),
});

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

function createDefaultApiService(): ApiService {
    return {
        save: (request) => splitPriceBreakdownApi.updateSplitPricingBreakdown(request),
        addItem: async (jobId, name, revenue) => {
            await pricingBreakdownApi.addPriceBreakdown({name, amount: revenue, childJobId: jobId});
            return refetchOrThrow(jobId);
        },
        deleteItem: async (jobId, pricingBreakdownId) => {
            await pricingBreakdownApi.deletePriceBreakdown({chargeId: pricingBreakdownId, jobId, isArchived: false});
            return refetchOrThrow(jobId);
        },
    };
}

export function openSplitPricingBreakdownDialog(
    breakdown: SplitPriceBreakdown,
    apiService?: ApiService,
): Promise<null> {
    return host.open({
        breakdown,
        apiService: apiService ?? createDefaultApiService(),
    });
}

// Expose globally for AngularJS access
window.ReactSplitPricingBreakdownDialog = {
    open: openSplitPricingBreakdownDialog,
    setToastService,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const splitPricingBreakdownDialogReactModule = window.angular!.module(
    'uDispatch.splitPricingBreakdownDialogReact',
    [],
);

splitPricingBreakdownDialogReactModule.service('splitPricingBreakdownDialogReactService', [
    () => ({
        openSplitPricingBreakdownDialog: (breakdown: SplitPriceBreakdown) =>
            openSplitPricingBreakdownDialog(breakdown),
    }),
]);

console.log('[SplitPricingBreakdownDialogReact] Module registered');

export default splitPricingBreakdownDialogReactModule;
