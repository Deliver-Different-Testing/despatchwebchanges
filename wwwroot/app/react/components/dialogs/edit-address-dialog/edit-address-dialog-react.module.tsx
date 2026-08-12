/**
 * Edit Address Dialog React Module
 *
 * Entry point for the React-based Edit Address Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {EditAddressDialog} from './EditAddressDialog';
import {EditAddressDialogViewModel} from '../../../interfaces';
import type {ShowToastFn, ToastService} from '../../../services/toastService';
import {AddressType} from '../../../../enums/address-type.enum';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';

// State management for the dialog
interface DialogState {
    open: boolean;
    addressDetails: EditAddressDialogViewModel | null;
    title: string;
    submitLabel: string;
    showContactInfo: boolean;
    isUsTenant: boolean;
    addressType?: AddressType;
    readOnly: boolean;
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
    readOnly: false,
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
    dialogRoot.render(islandTree(
        <MuiThemeIsland>
        <EditAddressDialog
            open={dialogState.open}
            addressDetails={dialogState.addressDetails}
            title={dialogState.title}
            submitLabel={dialogState.submitLabel}
            showContactInfo={dialogState.showContactInfo}
            isUsTenant={dialogState.isUsTenant}
            addressType={dialogState.addressType}
            readOnly={dialogState.readOnly}
            onClose={handleClose}
            onSave={handleSave}
            showToast={handleShowToast}
        />

        </MuiThemeIsland>

    ));
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
 * @param addressType - 'pickup' or 'delivery'; controls the map pin colour
 * @returns Promise that resolves with the updated address, or null if canceled
 */
export function openEditAddressDialog(
    addressDetails: EditAddressDialogViewModel | null,
    title: string = 'Edit Address',
    submitLabel: string = 'Save',
    showContactInfo: boolean = false,
    isUsTenant: boolean = false,
    toastService?: ToastService,
    addressType?: AddressType,
    readOnly: boolean = false,
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
            addressType,
            readOnly,
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
