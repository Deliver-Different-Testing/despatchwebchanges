/**
 * Edit Address Dialog React Module
 *
 * Entry point for the React-based Edit Address Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {EditAddressDialog} from './EditAddressDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {EditAddressDialogViewModel} from '../../../interfaces';
import type {ShowToastFn, ToastService} from '../../../services/toastService';

// State management for the dialog
interface DialogState {
    open: boolean;
    addressDetails: EditAddressDialogViewModel | null;
    title: string;
    submitLabel: string;
    showContactInfo: boolean;
    isUsTenant: boolean;
    toastService: ToastService | null;
    resolve?: (value: EditAddressDialogViewModel | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    addressDetails: null,
    title: 'Edit Address',
    submitLabel: 'Save',
    showContactInfo: false,
    isUsTenant: false,
    toastService: null,
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

    const handleSave = (address: EditAddressDialogViewModel) => {
        dialogState.open = false;
        dialogState.resolve?.(address);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleShowToast: ShowToastFn = (message, type) => {
        if (!dialogState.toastService) {
            // Fallback to console if toast service not available
            console.log(`[Toast ${type}]: ${message}`);
            return;
        }
        dialogState.toastService.showToast(message, type);
    };

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <EditAddressDialog
                    open={dialogState.open}
                    addressDetails={dialogState.addressDetails}
                    title={dialogState.title}
                    submitLabel={dialogState.submitLabel}
                    showContactInfo={dialogState.showContactInfo}
                    isUsTenant={dialogState.isUsTenant}
                    onClose={handleClose}
                    onSave={handleSave}
                    showToast={handleShowToast}
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
    dialogContainer.id = 'react-edit-address-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the edit address dialog
 *
 * @param addressDetails - The address to edit, or null for new address
 * @param title - Dialog title (default: 'Edit Address')
 * @param submitLabel - Submit button label (default: 'Save')
 * @param showContactInfo - Whether to show shipment details card
 * @param isUsTenant - Whether this is a US tenant (affects address format)
 * @param toastService - Toast service for showing notifications (optional)
 * @returns Promise that resolves with the updated address, or null if canceled
 */
export function openEditAddressDialog(
    addressDetails: EditAddressDialogViewModel | null,
    title: string = 'Edit Address',
    submitLabel: string = 'Save',
    showContactInfo: boolean = false,
    isUsTenant: boolean = false,
    toastService?: ToastService
): Promise<EditAddressDialogViewModel | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            addressDetails,
            title,
            submitLabel,
            showContactInfo,
            isUsTenant,
            toastService: toastService ?? null,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactEditAddressDialog = {
    open: openEditAddressDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const editAddressDialogReactModule = window.angular!.module(
    'uDispatch.editAddressDialogReact',
    []
);

console.log('[EditAddressDialogReact] Module registered');

export default editAddressDialogReactModule;
