/**
 * Price Breakdown Dialog React Module
 *
 * Entry point for the React-based Price Breakdown Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {PriceBreakdownDialog, PriceBreakdown} from './PriceBreakdownDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {pricingBreakdownApi} from '../../../services/pricingBreakdownApi';
import type {ToastService} from '../../../services/toastService';

const defaultToastService: ToastService = {
    showToast: (message, type) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

let toastService: ToastService = defaultToastService;

// API interface for making requests
interface ApiService {
    addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
    updatePriceBreakdown: (breakdown: PriceBreakdown) => Promise<void>;
    deletePriceBreakdown: (chargeId: number, jobId: number, isArchived: boolean) => Promise<void>;
    getSuggestedFuelCharge: (jobId: number, chargeAmount: number, isPrebook: boolean, isArchived: boolean) => Promise<{ fuelChargeAmount: number; fuelCostAmount: number }>;
}

// State management for the dialog
interface DialogState {
    open: boolean;
    priceBreakdowns: PriceBreakdown[];
    jobId: number;
    isPrebook: boolean;
    isArchived: boolean;
    isUsCustomer: boolean;
    readOnly: boolean;
    apiService: ApiService | null;
    resolve?: (value: number | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    priceBreakdowns: [],
    jobId: 0,
    isPrebook: false,
    isArchived: false,
    isUsCustomer: false,
    readOnly: false,
    apiService: null,
};

/**
 * Renders the dialog with current state
 */
function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.(null);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSave = (totalAmount: number) => {
        dialogState.open = false;
        dialogState.resolve?.(totalAmount);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleAddItem = async (item: Omit<PriceBreakdown, 'chargeId'>): Promise<number> => {
        if (!dialogState.apiService) throw new Error('API service not available');
        return dialogState.apiService.addPriceBreakdown(item);
    };

    const handleUpdateItem = async (item: PriceBreakdown): Promise<void> => {
        if (!dialogState.apiService) throw new Error('API service not available');
        return dialogState.apiService.updatePriceBreakdown(item);
    };

    const handleDeleteItem = async (chargeId: number, jobId: number, isArchived: boolean): Promise<void> => {
        if (!dialogState.apiService) throw new Error('API service not available');
        return dialogState.apiService.deletePriceBreakdown(chargeId, jobId, isArchived);
    };

    const handleGetSuggestedFuelCharge = async (chargeAmount: number) => {
        if (!dialogState.apiService) throw new Error('API service not available');
        return dialogState.apiService.getSuggestedFuelCharge(
            dialogState.jobId, chargeAmount, dialogState.isPrebook, dialogState.isArchived
        );
    };

    // Get theme dynamically based on customer region

    dialogRoot.render(islandTree(
        <PriceBreakdownDialog
            open={dialogState.open}
            priceBreakdowns={dialogState.priceBreakdowns}
            jobId={dialogState.jobId}
            isPrebook={dialogState.isPrebook}
            isArchived={dialogState.isArchived}
            isUsCustomer={dialogState.isUsCustomer}
            readOnly={dialogState.readOnly}
            onClose={handleClose}
            onSave={handleSave}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onGetSuggestedFuelCharge={handleGetSuggestedFuelCharge}
            showToast={toastService.showToast}
        />
    ));
}

export function setToastService(service: ToastService): void {
    toastService = service;
}

/**
 * Initialize the dialog root (called once)
 */
function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-price-breakdown-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
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
    apiService?: ApiService
): Promise<number | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            priceBreakdowns: [...priceBreakdowns], // Clone the array
            jobId,
            isPrebook,
            isArchived,
            isUsCustomer,
            readOnly,
            apiService: apiService ?? createDefaultApiService(),
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactPriceBreakdownDialog = {
    open: openPriceBreakdownDialog,
    setToastService,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const priceBreakdownDialogReactModule = window.angular!.module(
    'uDispatch.priceBreakdownDialogReact',
    []
);

// Register a service that wraps the React dialog (no longer depends on DispatchData)
priceBreakdownDialogReactModule.service('priceBreakdownDialogReactService', [
    () => ({
        /**
         * Opens the React price breakdown dialog
         */
        openPriceBreakdownDialog: (
            priceBreakdowns: PriceBreakdown[],
            jobId: number,
            isPrebook: boolean,
            isArchived: boolean = false,
            isUsCustomer: boolean = false,
            readOnly: boolean = false
        ) => openPriceBreakdownDialog(priceBreakdowns, jobId, isPrebook, isArchived, isUsCustomer, readOnly)
    })
]);

console.log('[PriceBreakdownDialogReact] Module registered');

export default priceBreakdownDialogReactModule;
