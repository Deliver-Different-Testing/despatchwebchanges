/**
 * Edit Afterhours Dialog React Module
 *
 * Entry point for the React-based Edit Afterhours Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {EditAfterhoursDialog} from './EditAfterhoursDialog';
import {DfrntMantineProvider} from '../../../theme/DfrntMantineProvider';
import {AfterHoursCourierSchedule} from '../../../interfaces';
import type {ShowToastFn, ToastService} from '../../../services/toastService';

// State management for the dialog
interface DialogState {
    open: boolean;
    schedule: AfterHoursCourierSchedule | null;
    isUsTenant: boolean;
    toastService: ToastService | null;
    resolve?: (value: AfterHoursCourierSchedule | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    schedule: null,
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

    const handleSave = (schedule: AfterHoursCourierSchedule) => {
        dialogState.open = false;
        dialogState.resolve?.(schedule);
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

    dialogRoot.render(
        <DfrntMantineProvider>
            <EditAfterhoursDialog
                open={dialogState.open}
                schedule={dialogState.schedule}
                isUsTenant={dialogState.isUsTenant}
                onClose={handleClose}
                onSave={handleSave}
                showToast={handleShowToast}
            />
        </DfrntMantineProvider>
    );
}

/**
 * Initialize the dialog root (called once)
 */
function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-edit-afterhours-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the edit afterhours dialog
 *
 * @param schedule - The schedule to edit, or null/empty for new schedule
 * @param isUsTenant - Whether this is a US tenant (affects timezone display)
 * @param toastService - Toast service for showing notifications (optional, for AngularJS integration)
 * @returns Promise that resolves with the updated schedule, or null if canceled
 */
export function openEditAfterhoursDialog(
    schedule: AfterHoursCourierSchedule | null,
    isUsTenant: boolean,
    toastService?: ToastService
): Promise<AfterHoursCourierSchedule | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            schedule,
            isUsTenant,
            toastService: toastService ?? null,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactEditAfterhoursDialog = {
    open: openEditAfterhoursDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const editAfterhoursDialogReactModule = window.angular!.module(
    'uDispatch.editAfterhoursDialogReact',
    []
);

console.log('[EditAfterhoursDialogReact] Module registered');

export default editAfterhoursDialogReactModule;
