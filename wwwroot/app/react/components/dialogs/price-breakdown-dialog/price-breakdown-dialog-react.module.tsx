/**
 * Price Breakdown Dialog React Module
 *
 * Entry point for the React-based Price Breakdown Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {PriceBreakdownDialog, PriceBreakdown} from './PriceBreakdownDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {pricingBreakdownApi} from '../../../services/pricingBreakdownApi';
import angular from 'angular';

// API interface for making requests
interface ApiService {
    addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
    updatePriceBreakdown: (breakdown: PriceBreakdown) => Promise<void>;
    deletePriceBreakdown: (chargeId: number, jobId: number, isArchived: boolean) => Promise<void>;
}

// State management for the dialog
interface DialogState {
    open: boolean;
    priceBreakdowns: PriceBreakdown[];
    jobId: number;
    isPrebook: boolean;
    isArchived: boolean;
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

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <PriceBreakdownDialog
                    open={dialogState.open}
                    priceBreakdowns={dialogState.priceBreakdowns}
                    jobId={dialogState.jobId}
                    isPrebook={dialogState.isPrebook}
                    isArchived={dialogState.isArchived}
                    onClose={handleClose}
                    onSave={handleSave}
                    onAddItem={handleAddItem}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                />
            </ThemeProvider>
        </ReactQueryProvider>
    );
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
    };
}

/**
 * Opens the price breakdown dialog
 *
 * @param priceBreakdowns - Initial price breakdown items
 * @param jobId - The job ID
 * @param isPrebook - Whether this is a prebook job
 * @param isArchived - Whether this is an archived job
 * @param apiService - Optional API service for CRUD operations (uses default React service if not provided)
 * @returns Promise that resolves with the total amount, or null if cancelled
 */
export function openPriceBreakdownDialog(
    priceBreakdowns: PriceBreakdown[],
    jobId: number,
    isPrebook: boolean,
    isArchived: boolean,
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
            apiService: apiService ?? createDefaultApiService(),
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
(window as any).ReactPriceBreakdownDialog = {
    open: openPriceBreakdownDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const priceBreakdownDialogReactModule = (window as any).angular.module(
    'uDispatch.priceBreakdownDialogReact',
    []
);

// Register a service that wraps the React dialog (no longer depends on DispatchData)
priceBreakdownDialogReactModule.service('priceBreakdownDialogReactService', [
    () => ({
        /**
         * Opens the React price breakdown dialog
         * @param priceBreakdowns - Initial price breakdown items
         * @param jobId - The job ID
         * @param isPrebook - Whether this is a prebook job
         * @param isArchived - Whether this is an archived job
         * @returns Promise resolving to total amount or null if cancelled
         */
        openPriceBreakdownDialog: (
            priceBreakdowns: PriceBreakdown[],
            jobId: number,
            isPrebook: boolean,
            isArchived: boolean = false
        ) => openPriceBreakdownDialog(priceBreakdowns, jobId, isPrebook, isArchived)
    })
]);

console.log('[PriceBreakdownDialogReact] Module registered');

export default priceBreakdownDialogReactModule;
