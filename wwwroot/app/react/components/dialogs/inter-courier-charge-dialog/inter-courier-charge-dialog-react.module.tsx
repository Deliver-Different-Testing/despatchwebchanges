/**
 * Inter-Courier Charge Dialog React Module
 *
 * Entry point for the React-based Inter-Courier Charge Dialog.
 * Exposes a function to open the dialog from DispatchPage or AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {InterCourierChargeDialog} from './InterCourierChargeDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import type {ShowToastFn, ToastService} from '../../../services/toastService';

interface DialogState {
    open: boolean;
    toastService: ToastService | null;
    resolve?: (value: void) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    toastService: null,
};

function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.();
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleShowToast: ShowToastFn = (message, type) => {
        if (!dialogState.toastService) {
            console.log(`[Toast ${type}]: ${message}`);
            return;
        }
        dialogState.toastService.showToast(message, type);
    };

    dialogRoot.render(islandTree(
        <InterCourierChargeDialog
            open={dialogState.open}
            onClose={handleClose}
            showToast={handleShowToast}
        />
    ));
}

function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-inter-courier-charge-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the inter-courier charge dialog.
 *
 * @param toastService - Toast service for showing notifications (optional)
 * @returns Promise that resolves when the dialog is closed
 */
export function openInterCourierChargeDialog(toastService?: ToastService): Promise<void> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            toastService: toastService ?? null,
            resolve,
        };
        renderDialog();
    });
}
