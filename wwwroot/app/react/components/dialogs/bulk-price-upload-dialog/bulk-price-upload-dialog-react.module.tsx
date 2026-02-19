/**
 * Bulk Price Upload Dialog React Module
 *
 * Entry point for the React-based Bulk Price Upload Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BulkPriceUploadDialog } from './BulkPriceUploadDialog';
import { OpenBulkPriceUploadDialogOptions, PricingMode, BulkPricePreviewResponse } from './types';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { bulkPriceApi } from '../../../services/bulkPriceApi';

interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface DialogState {
    open: boolean;
    toastService: ToastService | null;
    resolve?: (value: boolean) => void;
}

/**
 * Bulk Price Upload Dialog Manager Class
 * Manages the lifecycle and state of the Bulk Price Upload Dialog.
 */
class BulkPriceUploadDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-bulk-price-upload-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.(false);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleSubmit = async (
            file: File,
            mode: PricingMode
        ): Promise<BulkPricePreviewResponse> => {
            const response = await bulkPriceApi.applyBulkPriceUpdate(file, mode);

            // On success, resolve true but don't close yet (user will click Done)
            // The dialog will show results first
            return response;
        };

        const handleShowToast = (message: string, type: 'success' | 'warning' | 'error') => {
            if (!this.dialogState.toastService) {
                console.log(`[Toast ${type}]: ${message}`);
                return;
            }
            this.dialogState.toastService.showToast(message, type);
        };

        const currentTheme = getTheme();

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <BulkPriceUploadDialog
                        open={this.dialogState.open}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        showToast={handleShowToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    async open(options: OpenBulkPriceUploadDialogOptions): Promise<boolean> {
        const { toastService } = options;

        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                toastService: toastService ?? null,
                resolve: (value: boolean) => {
                    resolve(value);
                },
            };
            this.renderDialog();
        });
    }
}

const bulkPriceUploadDialogManager = new BulkPriceUploadDialogManager();

export function openBulkPriceUploadDialog(options: OpenBulkPriceUploadDialogOptions): Promise<boolean> {
    return bulkPriceUploadDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactBulkPriceUploadDialog = {
    open: openBulkPriceUploadDialog,
};

// Create AngularJS module
const bulkPriceUploadDialogReactModule = (window as any).angular.module(
    'uDispatch.bulkPriceUploadDialogReact',
    []
);

console.log('[BulkPriceUploadDialogReact] Module registered');

export default bulkPriceUploadDialogReactModule;
