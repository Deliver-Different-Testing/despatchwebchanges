/**
 * Edit Afterhours Dialog React Module
 *
 * Entry point for the React-based Edit Afterhours Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {EditAfterhoursDialog} from './EditAfterhoursDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {AfterHoursCourierSchedule} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';

// Toast service interface (still provided by AngularJS for UI consistency)
interface ToastService {
    showToast: ShowToastFn;
}

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

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <EditAfterhoursDialog
                    open={dialogState.open}
                    schedule={dialogState.schedule}
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
(window as any).ReactEditAfterhoursDialog = {
    open: openEditAfterhoursDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const editAfterhoursDialogReactModule = (window as any).angular.module(
    'uDispatch.editAfterhoursDialogReact',
    []
);

console.log('[EditAfterhoursDialogReact] Module registered');

export default editAfterhoursDialogReactModule;
