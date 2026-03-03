/**
 * Accessorial Charges Dialog React Module
 *
 * Entry point for the React-based Accessorial Charges Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AccessorialChargesDialog } from './AccessorialChargesDialog';
import { AccessorialChargesJob, OpenAccessorialChargesDialogOptions } from './types';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';

interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface DialogState {
    open: boolean;
    job: AccessorialChargesJob | null;
    toastService: ToastService | null;
    resolve?: (value: boolean) => void;
}

class AccessorialChargesDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        job: null,
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;
        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-accessorial-charges-dialog-root';
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
                    <AccessorialChargesDialog
                        open={this.dialogState.open}
                        job={this.dialogState.job}
                        onClose={handleClose}
                        showToast={handleShowToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    async open(options: OpenAccessorialChargesDialogOptions): Promise<boolean> {
        const { job, toastService } = options;

        if (!job.id || !job.accessorialChargeGroupId) {
            console.debug('[AccessorialChargesDialog] Missing jobId or accessorialChargeGroupId');
            return false;
        }

        this.initializeDialogRoot();

        return new Promise(resolve => {
            this.dialogState = {
                open: true,
                job: options.job,
                toastService: toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const accessorialChargesDialogManager = new AccessorialChargesDialogManager();

export function openAccessorialChargesDialog(options: OpenAccessorialChargesDialogOptions): Promise<boolean> {
    return accessorialChargesDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactAccessorialChargesDialog = {
    open: openAccessorialChargesDialog,
};

// Create AngularJS module
const accessorialChargesDialogReactModule = (window as any).angular.module(
    'uDispatch.accessorialChargesDialogReact',
    []
);

console.log('[AccessorialChargesDialogReact] Module registered');

export default accessorialChargesDialogReactModule;
