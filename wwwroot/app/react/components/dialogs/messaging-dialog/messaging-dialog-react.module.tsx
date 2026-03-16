/**
 * Messaging Dialog React Module
 *
 * Entry point for the React-based Messaging Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { MessagingDialog } from './MessagingDialog';
import { OpenMessagingDialogOptions, ToastService } from './types';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import type { ShowToastFn } from '../../../services/toastService';

// Get current staff info from global variables
declare const ContactID: number;
declare const FullName: string;
declare const TimeZone: string;

interface DialogState {
    open: boolean;
    toastService: ToastService | null;
    resolve?: (value: void) => void;
}

/**
 * Messaging Dialog Manager Class
 * Manages the lifecycle and state of the Messaging Dialog.
 */
class MessagingDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-messaging-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.();
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleShowToast: ShowToastFn = (message, type) => {
            if (!this.dialogState.toastService) {
                console.log(`[Toast ${type}]: ${message}`);
                return;
            }
            this.dialogState.toastService.showToast(message, type);
        };

        const currentTheme = getTheme();

        // Get current staff info
        const currentStaffId = typeof ContactID !== 'undefined' ? ContactID : 0;
        const currentStaffName = typeof FullName !== 'undefined' ? FullName : 'Unknown';
        const timeZone = typeof TimeZone !== 'undefined' ? TimeZone : 'UTC';

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <MessagingDialog
                        open={this.dialogState.open}
                        onClose={handleClose}
                        showToast={handleShowToast}
                        currentStaffId={currentStaffId}
                        currentStaffName={currentStaffName}
                        timeZone={timeZone}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    async open(options?: OpenMessagingDialogOptions): Promise<void> {
        // Validate current staff
        const currentStaffId = typeof ContactID !== 'undefined' ? ContactID : 0;
        if (!currentStaffId) {
            console.error('[MessagingDialog] Unable to determine current staff member');
            options?.toastService?.showToast('Unable to determine current staff member', 'error');
            return;
        }

        // Proceed to open dialog
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                toastService: options?.toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const messagingDialogManager = new MessagingDialogManager();

export function openMessagingDialog(options?: OpenMessagingDialogOptions): Promise<void> {
    return messagingDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactMessagingDialog = {
    open: openMessagingDialog,
};

// Create AngularJS module
const messagingDialogReactModule = (window as any).angular.module(
    'uDispatch.messagingDialogReact',
    []
);

console.log('[MessagingDialogReact] Module registered');

export default messagingDialogReactModule;
