/**
 * Edit Parcel Dimensions Dialog React Module
 *
 * Entry point for the React-based Edit Parcel Dimensions Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { EditParcelDimensionsDialog } from './EditParcelDimensionsDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import {
    ParcelDimensions,
    EditParcelDimensionsDialogOptions,
    EditParcelDimensionsDialogResult,
} from './types';
import type { ToastService } from '../../../services/toastService';

interface DialogState {
    open: boolean;
    parcels: ParcelDimensions[];
    jobId?: number;
    bulkJobId?: number;
    jobNumber?: string | number;
    isUsCustomer: boolean;
    jobWeight?: number;
    calculateDimsOncePerJob?: boolean;
    partnerMode?: boolean;
    readOnly?: boolean;
    resolve?: (result: EditParcelDimensionsDialogResult | null) => void;
}

const defaultToastService: ToastService = {
    showToast: (message: string, type: string) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

class EditParcelDimensionsDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private toastService: ToastService = defaultToastService;
    private dialogState: DialogState = {
        open: false,
        parcels: [],
        isUsCustomer: false,
    };

    setToastService(service: ToastService): void {
        this.toastService = service;
    }

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-edit-parcel-dimensions-dialog-root';
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

        const handleSubmit = (result: EditParcelDimensionsDialogResult) => {
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
                    <EditParcelDimensionsDialog
                        open={this.dialogState.open}
                        parcels={this.dialogState.parcels}
                        jobId={this.dialogState.jobId}
                        bulkJobId={this.dialogState.bulkJobId}
                        jobNumber={this.dialogState.jobNumber}
                        isUsCustomer={this.dialogState.isUsCustomer}
                        jobWeight={this.dialogState.jobWeight}
                        calculateDimsOncePerJob={this.dialogState.calculateDimsOncePerJob}
                        partnerMode={this.dialogState.partnerMode}
                        readOnly={this.dialogState.readOnly}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        showToast={this.toastService.showToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    showEditParcelDimensionsDialog(options: EditParcelDimensionsDialogOptions): Promise<EditParcelDimensionsDialogResult | null> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                parcels: options.parcels,
                jobId: options.jobId,
                bulkJobId: options.bulkJobId,
                jobNumber: options.jobNumber,
                isUsCustomer: options.isUsCustomer,
                jobWeight: options.jobWeight,
                calculateDimsOncePerJob: options.calculateDimsOncePerJob,
                partnerMode: options.partnerMode,
                readOnly: options.readOnly ?? false,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new EditParcelDimensionsDialogManager();

export function showEditParcelDimensionsDialog(
    options: EditParcelDimensionsDialogOptions
): Promise<EditParcelDimensionsDialogResult | null> {
    return dialogManager.showEditParcelDimensionsDialog(options);
}

export function setToastService(service: ToastService): void {
    dialogManager.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactEditParcelDimensionsDialog = {
    showEditParcelDimensionsDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const editParcelDimensionsDialogReactModule = window.angular!.module(
    'uDispatch.editParcelDimensionsDialogReact',
    []
);

console.log('[EditParcelDimensionsDialogReact] Module registered');

export default editParcelDimensionsDialogReactModule;
