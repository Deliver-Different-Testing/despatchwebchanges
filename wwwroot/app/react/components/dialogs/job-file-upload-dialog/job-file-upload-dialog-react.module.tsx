/**
 * Job File Upload Dialog React Module
 *
 * Entry point for the React-based Job File Upload Dialog.
 * Exposes global functions to open the dialog from AngularJS and other React components.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';

import {JobFileUploadDialog} from './JobFileUploadDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import type {FileUploadType} from './types';
import type {ToastService} from '../../../services/toastService';

interface DialogState {
    open: boolean;
    jobId: number;
    initialUploadType: FileUploadType;
    resolve?: (value: void) => void;
}

const defaultToastService: ToastService = {
    showToast: (message: string, type: string) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

class JobFileUploadDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private toastService: ToastService = defaultToastService;
    private dialogState: DialogState = {
        open: false,
        jobId: 0,
        initialUploadType: 'normal',
    };

    setToastService(service: ToastService): void {
        this.toastService = service;
    }

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-job-file-upload-dialog-root';
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

        this.dialogRoot.render(islandTree(
            <JobFileUploadDialog
                open={this.dialogState.open}
                jobId={this.dialogState.jobId}
                initialUploadType={this.dialogState.initialUploadType}
                onClose={handleClose}
                showToast={this.toastService.showToast}
            />
        ));
    }

    open(jobId: number, uploadType: FileUploadType | string = 'normal'): Promise<void> {
        this.initializeDialogRoot();

        const normalizedType: FileUploadType =
            (uploadType === 'pod' || uploadType === 'POD') ? 'pod'
            : (uploadType === 'both' || uploadType === 'BOTH') ? 'both'
            : 'normal';

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                jobId,
                initialUploadType: normalizedType,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new JobFileUploadDialogManager();

export function open(jobId: number, uploadType?: FileUploadType | string): Promise<void> {
    return dialogManager.open(jobId, uploadType);
}

export function setToastService(service: ToastService): void {
    dialogManager.setToastService(service);
}

// Expose to window for AngularJS and React access
window.ReactJobFileUploadDialog = {
    open,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const jobFileUploadDialogReactModule = window.angular!.module(
    'uDispatch.jobFileUploadDialogReact',
    []
);

console.log('[JobFileUploadDialogReact] Module registered');

export default jobFileUploadDialogReactModule;
