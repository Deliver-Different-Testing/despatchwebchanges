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
import {getTheme} from '../../../react/theme/muiTheme';
import DispatchCoreService from "../../../services/dispatch-core.service";

// API interface for making requests
interface ApiService {
    addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
    updatePriceBreakdown: (breakdown: PriceBreakdown) => Promise<void>;
    deletePriceBreakdown: (chargeId: number, jobId: number) => Promise<void>;
}

// State management for the dialog
interface DialogState {
    open: boolean;
    priceBreakdowns: PriceBreakdown[];
    jobId: number;
    isPrebook: boolean;
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

    const handleDeleteItem = async (chargeId: number, jobId: number): Promise<void> => {
        if (!dialogState.apiService) throw new Error('API service not available');
        return dialogState.apiService.deletePriceBreakdown(chargeId, jobId);
    };

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    dialogRoot.render(
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <PriceBreakdownDialog
                open={dialogState.open}
                priceBreakdowns={dialogState.priceBreakdowns}
                jobId={dialogState.jobId}
                isPrebook={dialogState.isPrebook}
                onClose={handleClose}
                onSave={handleSave}
                onAddItem={handleAddItem}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
            />
        </ThemeProvider>
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
 * Opens the price breakdown dialog
 *
 * @param priceBreakdowns - Initial price breakdown items
 * @param jobId - The job ID
 * @param isPrebook - Whether this is a prebook job
 * @param apiService - API service for CRUD operations
 * @returns Promise that resolves with the total amount, or null if cancelled
 */
export function openPriceBreakdownDialog(
    priceBreakdowns: PriceBreakdown[],
    jobId: number,
    isPrebook: boolean,
    apiService: ApiService
): Promise<number | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            priceBreakdowns: [...priceBreakdowns], // Clone the array
            jobId,
            isPrebook,
            apiService,
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

// Register a service that wraps the React dialog
priceBreakdownDialogReactModule.service('priceBreakdownDialogReactService', [
    'DispatchData',
    (DispatchData: DispatchCoreService) => ({
        /**
         * Opens the React price breakdown dialog
         * @param priceBreakdowns - Initial price breakdown items
         * @param jobId - The job ID
         * @param isPrebook - Whether this is a prebook job
         * @returns Promise resolving to total amount or null if cancelled
         */
        openPriceBreakdownDialog: (
            priceBreakdowns: PriceBreakdown[],
            jobId: number,
            isPrebook: boolean
        ) => {
            // Create API service wrapper using AngularJS DispatchData
            const apiService: ApiService = {
                addPriceBreakdown: (breakdown) => DispatchData.addPriceBreakdown(breakdown as PriceBreakdown),
                updatePriceBreakdown: (breakdown) => DispatchData.updatePriceBreakdown(breakdown),
                deletePriceBreakdown: (chargeId, jId) => DispatchData.deletePriceBreakdown(chargeId, jId),
            };

            return openPriceBreakdownDialog(priceBreakdowns, jobId, isPrebook, apiService);
        }
    })
]);

console.log('[PriceBreakdownDialogReact] Module registered');

export default priceBreakdownDialogReactModule;
