/**
 * Edit Date Time Dialog React Module
 *
 * Entry point for the React-based Edit Date Time Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Dayjs } from 'dayjs';

import { EditDateTimeDialog } from './EditDateTimeDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { EditDateTimeDialogResult, EditDateTimeDialogOptions } from './types';
import type { ToastService } from '../../../services/toastService';

interface DialogState {
    open: boolean;
    title: string;
    fieldName: string;
    dateTime?: Dayjs;
    defaultTimeZone?: string;
    showDate: boolean;
    showTime: boolean;
    isUSCustomer: boolean;
    readOnly: boolean;
    resolve?: (result: EditDateTimeDialogResult | null) => void;
}

/**
 * Get the US customer flag from server config
 */
function getIsUSCustomer(): boolean {
    return window.serverConfig?.isUSCustomer ?? false;
}

// Default toast service that logs to console
const defaultToastService: ToastService = {
    showToast: (message: string, type: string) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

/**
 * Edit Date Time Dialog Manager
 * Manages the lifecycle and state of the dialog.
 */
class EditDateTimeDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private toastService: ToastService = defaultToastService;
    private dialogState: DialogState = {
        open: false,
        title: '',
        fieldName: '',
        dateTime: undefined,
        defaultTimeZone: undefined,
        showDate: true,
        showTime: true,
        isUSCustomer: false,
        readOnly: false,
    };

    setToastService(service: ToastService): void {
        this.toastService = service;
    }

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-edit-date-time-dialog-root';
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

        const handleSubmit = (result: EditDateTimeDialogResult) => {
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
                    <EditDateTimeDialog
                        open={this.dialogState.open}
                        title={this.dialogState.title}
                        fieldName={this.dialogState.fieldName}
                        dateTime={this.dialogState.dateTime}
                        defaultTimeZone={this.dialogState.defaultTimeZone}
                        showDate={this.dialogState.showDate}
                        showTime={this.dialogState.showTime}
                        isUSCustomer={this.dialogState.isUSCustomer}
                        readOnly={this.dialogState.readOnly}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        showToast={this.toastService.showToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    /**
     * Show edit time dialog (time only)
     */
    showEditTimeDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
        return this.openDialog({
            ...options,
            showDate: false,
            showTime: true,
        });
    }

    /**
     * Show edit date dialog (date only)
     */
    showEditDateDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
        return this.openDialog({
            ...options,
            showDate: true,
            showTime: false,
        });
    }

    /**
     * Show edit date and time dialog
     */
    showEditDateAndTimeDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
        return this.openDialog({
            ...options,
            showDate: true,
            showTime: true,
        });
    }

    private openDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                title: options.title,
                fieldName: options.fieldName,
                dateTime: options.dateTime,
                defaultTimeZone: options.defaultTimeZone,
                showDate: options.showDate ?? true,
                showTime: options.showTime ?? true,
                isUSCustomer: options.isUSCustomer ?? getIsUSCustomer(),
                readOnly: options.readOnly ?? false,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new EditDateTimeDialogManager();

// Export functions for external use
export function showEditTimeDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
    return dialogManager.showEditTimeDialog(options);
}

export function showEditDateDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
    return dialogManager.showEditDateDialog(options);
}

export function showEditDateAndTimeDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
    return dialogManager.showEditDateAndTimeDialog(options);
}

export function setToastService(service: ToastService): void {
    dialogManager.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactEditDateTimeDialog = {
    showEditTimeDialog,
    showEditDateDialog,
    showEditDateAndTimeDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const editDateTimeDialogReactModule = window.angular!.module(
    'uDispatch.editDateTimeDialogReact',
    []
);

console.log('[EditDateTimeDialogReact] Module registered');

export default editDateTimeDialogReactModule;
