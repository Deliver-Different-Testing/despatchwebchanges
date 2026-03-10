/**
 * Select Dialog React Module
 *
 * Entry point for the React-based Select Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';

import { SelectDialog } from './SelectDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { SelectDialogResult, SelectDialogOptions, SelectDialogItem } from './types';

/** Warning message displayed when changing a job's Status field */
const STATUS_WARNING_MESSAGE =
    'Warning: You are about to change the status of a job. Different statuses trigger different notifications and automated workflows. ' +
    'While this change can be reversed, it may impact multiple systems and stakeholders. Please ensure you\'re selecting the correct status.';

interface DialogState {
    open: boolean;
    title: string;
    fieldName: string;
    items: SelectDialogItem[];
    initialValue?: string | number | null;
    warningMessage?: string;
    showCheckbox: boolean;
    checkboxLabel: string;
    resolve?: (result: SelectDialogResult | null) => void;
}

/**
 * Toast service interface for showing notifications
 */
interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

// Default toast service that logs to console
const defaultToastService: ToastService = {
    showToast: (message: string, type: string) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

/**
 * Select Dialog Manager
 * Manages the lifecycle and state of the dialog.
 */
class SelectDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private toastService: ToastService = defaultToastService;
    private dialogState: DialogState = {
        open: false,
        title: '',
        fieldName: '',
        items: [],
        initialValue: null,
        warningMessage: undefined,
        showCheckbox: false,
        checkboxLabel: '',
    };

    setToastService(service: ToastService): void {
        this.toastService = service;
    }

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-select-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.(null);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleSubmit = (result: SelectDialogResult) => {
            this.dialogState.open = false;
            this.dialogState.resolve?.(result);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const currentTheme = getTheme();

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <SelectDialog
                        open={this.dialogState.open}
                        title={this.dialogState.title}
                        fieldName={this.dialogState.fieldName}
                        items={this.dialogState.items}
                        initialValue={this.dialogState.initialValue}
                        warningMessage={this.dialogState.warningMessage}
                        showCheckbox={this.dialogState.showCheckbox}
                        checkboxLabel={this.dialogState.checkboxLabel}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        showToast={this.toastService.showToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    showSelectDialog(options: SelectDialogOptions): Promise<SelectDialogResult | null> {
        this.initializeDialogRoot();

        // Determine warning message based on field name
        const warningMessage = options.fieldName === 'Status' ? STATUS_WARNING_MESSAGE : undefined;

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                title: options.title,
                fieldName: options.fieldName,
                items: options.items,
                initialValue: options.initialValue,
                warningMessage,
                showCheckbox: options.showCheckbox ?? false,
                checkboxLabel: options.checkboxLabel ?? '',
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new SelectDialogManager();

export function showSelectDialog(options: SelectDialogOptions): Promise<SelectDialogResult | null> {
    return dialogManager.showSelectDialog(options);
}

export function setToastService(service: ToastService): void {
    dialogManager.setToastService(service);
}

// Expose to window for AngularJS access
(window as any).ReactSelectDialog = {
    showSelectDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const selectDialogReactModule = (window as any).angular.module(
    'uDispatch.selectDialogReact',
    []
);

console.log('[SelectDialogReact] Module registered');

export default selectDialogReactModule;
