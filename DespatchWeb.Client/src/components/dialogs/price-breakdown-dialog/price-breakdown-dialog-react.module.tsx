import React from 'react';
import {PriceBreakdownDialog, PriceBreakdown} from './PriceBreakdownDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {pricingBreakdownApi} from '../../../api/pricingBreakdownApi';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

// API interface for making requests
interface ApiService {
    addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
    updatePriceBreakdown: (breakdown: PriceBreakdown) => Promise<void>;
    deletePriceBreakdown: (chargeId: number, jobId: number, isArchived: boolean) => Promise<void>;
    getSuggestedFuelCharge: (jobId: number, chargeAmount: number, isPrebook: boolean, isArchived: boolean) => Promise<{ fuelChargeAmount: number; fuelCostAmount: number }>;
}

interface PriceBreakdownPayload {
    priceBreakdowns: PriceBreakdown[];
    jobId: number;
    isPrebook: boolean;
    isArchived: boolean;
    isUsCustomer: boolean;
    readOnly: boolean;
    managedElsewhere?: {parentJobNumber: string; onNavigateToParent: () => void};
    partnerView: boolean;
    apiService: ApiService;
}

const host = createDialogHost<PriceBreakdownPayload, number | null>({
    containerId: 'react-price-breakdown-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <PriceBreakdownDialog
            open={open}
            priceBreakdowns={payload.priceBreakdowns}
            jobId={payload.jobId}
            isPrebook={payload.isPrebook}
            isArchived={payload.isArchived}
            isUsCustomer={payload.isUsCustomer}
            readOnly={payload.readOnly}
            managedElsewhere={payload.managedElsewhere}
            partnerView={payload.partnerView}
            onClose={() => close(null)}
            onSave={close}
            onAddItem={(item) => payload.apiService.addPriceBreakdown(item)}
            onUpdateItem={(item) => payload.apiService.updatePriceBreakdown(item)}
            onDeleteItem={(chargeId, jobId, isArchived) =>
                payload.apiService.deletePriceBreakdown(chargeId, jobId, isArchived)}
            onGetSuggestedFuelCharge={(chargeAmount) => payload.apiService.getSuggestedFuelCharge(
                payload.jobId, chargeAmount, payload.isPrebook, payload.isArchived
            )}
            showToast={showToast}
        />
    ),
});

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

/**
 * Creates the default API service using the React pricingBreakdownApi
 */
function createDefaultApiService(): ApiService {
    return {
        addPriceBreakdown: (breakdown) => pricingBreakdownApi.addPriceBreakdown(breakdown),
        updatePriceBreakdown: (breakdown) => pricingBreakdownApi.updatePriceBreakdown(breakdown),
        deletePriceBreakdown: (chargeId, jobId, isArchived) =>
            pricingBreakdownApi.deletePriceBreakdown({chargeId, jobId, isArchived}),
        getSuggestedFuelCharge: (jobId, chargeAmount, isPrebook, isArchived) =>
            pricingBreakdownApi.getSuggestedFuelCharge(jobId, chargeAmount, isPrebook, isArchived),
    };
}

/**
 * Opens the price breakdown dialogue
 */
export function openPriceBreakdownDialog(
    priceBreakdowns: PriceBreakdown[],
    jobId: number,
    isPrebook: boolean,
    isArchived: boolean,
    isUsCustomer: boolean = false,
    readOnly: boolean = false,
    managedElsewhere?: {parentJobNumber: string; onNavigateToParent: () => void},
    apiService?: ApiService,
    options?: {partnerView?: boolean}
): Promise<number | null> {
    return host.open({
        priceBreakdowns: [...priceBreakdowns], // Clone the array
        jobId,
        isPrebook,
        isArchived,
        isUsCustomer,
        readOnly,
        managedElsewhere,
        partnerView: options?.partnerView ?? false,
        apiService: apiService ?? createDefaultApiService(),
    });
}

export const reactPriceBreakdownDialog = {
    open: openPriceBreakdownDialog,
    setToastService,
};
