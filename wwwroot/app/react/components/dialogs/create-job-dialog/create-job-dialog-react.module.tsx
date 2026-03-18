/**
 * Create Job Dialog React Module
 *
 * Entry point for the React-based Create Job Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {CreateJobDialog} from './CreateJobDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import type {ShowToastFn, ToastService} from '../../../services/toastService';

// State management for the dialog
interface DialogState {
    open: boolean;
    isUsTenant: boolean;
    toastService: ToastService | null;
    resolve?: (value: number | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
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

    const handleSubmit = (newJobId: number) => {
        dialogState.open = false;
        dialogState.resolve?.(newJobId);
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

    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <CreateJobDialog
                    open={dialogState.open}
                    isUsTenant={dialogState.isUsTenant}
                    onClose={handleClose}
                    onSubmit={handleSubmit}
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
    dialogContainer.id = 'react-create-job-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the create job dialog
 *
 * @param isUsTenant - Whether this is a US tenant
 * @param toastService - Toast service for showing notifications (optional)
 * @returns Promise that resolves with the new job ID, or null if canceled
 */
export function openCreateJobDialog(
    isUsTenant: boolean = false,
    toastService?: ToastService
): Promise<number | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            isUsTenant,
            toastService: toastService ?? null,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactCreateJobDialog = {
    open: openCreateJobDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const createJobDialogReactModule = window.angular!.module(
    'uDispatch.createJobDialogReact',
    []
);

console.log('[CreateJobDialogReact] Module registered');

export default createJobDialogReactModule;
