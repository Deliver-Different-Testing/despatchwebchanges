/**
 * Void Job Confirmation Dialog React Module
 *
 * Entry point for the React-based Void Job Confirmation Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {VoidJobConfirmationDialog, VoidJobDialogJob, VoidJobResult, RelatedJob} from './VoidJobConfirmationDialog';
import {DfrntMantineProvider} from '../../../theme/DfrntMantineProvider';
import {jobApi} from '../../../services/jobApi';
import type {ShowToastFn, ToastService} from '../../../services/toastService';

interface DialogState {
    open: boolean;
    job: VoidJobDialogJob | null;
    toastService: ToastService | null;
    resolve?: (value: VoidJobResult | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    job: null,
    toastService: null,
};

function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.(null);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleConfirm = (result: VoidJobResult) => {
        dialogState.open = false;
        dialogState.resolve?.(result);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleLoadRelatedJobs = async (jobId: number, isArchived: boolean, isBulkJob: boolean): Promise<RelatedJob[]> => {
        const results = await jobApi.getRelatedJobsMultiSelectList(jobId, isArchived, isBulkJob);
        return results.map(r => ({
            id: r.id,
            text: r.text,
            selected: r.selected,
            isBulkJob: r.isBulkJob,
            isArchived: r.isArchived,
        }));
    };

    const handleVoidJob = async (
        jobId: number,
        voidSingleJobOnly: boolean,
        voidReason: string,
        selectedJobIds?: number[]
    ): Promise<void> => {
        await jobApi.voidJob({jobId, voidSingleJobOnly, voidReason, selectedJobIds});
    };

    const handleVoidBulkJob = async (
        bulkJobId: number,
        voidSingleJobOnly: boolean,
        voidReason: string,
        selectedJobIds?: number[]
    ): Promise<void> => {
        await jobApi.voidBulkJob({bulkJobId, voidSingleJobOnly, voidReason, selectedJobIds});
    };

    const handleShowToast: ShowToastFn = (message, type) => {
        if (!dialogState.toastService) {
            console.log(`[Toast ${type}]: ${message}`);
            return;
        }
        dialogState.toastService.showToast(message, type);
    };

    dialogRoot.render(
        <DfrntMantineProvider>
            <VoidJobConfirmationDialog
                open={dialogState.open}
                job={dialogState.job}
                onClose={handleClose}
                onConfirm={handleConfirm}
                onLoadRelatedJobs={handleLoadRelatedJobs}
                onVoidJob={handleVoidJob}
                onVoidBulkJob={handleVoidBulkJob}
                showToast={handleShowToast}
            />
        </DfrntMantineProvider>
    );
}

function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-void-job-confirmation-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

export function openVoidJobConfirmationDialog(
    job: VoidJobDialogJob,
    toastService?: ToastService
): Promise<VoidJobResult | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            job,
            toastService: toastService ?? null,
            resolve,
        };
        renderDialog();
    });
}

window.ReactVoidJobConfirmationDialog = {
    open: openVoidJobConfirmationDialog,
};

const voidJobConfirmationDialogReactModule = window.angular!.module(
    'uDispatch.voidJobConfirmationDialogReact',
    []
);

console.log('[VoidJobConfirmationDialogReact] Module registered');

export default voidJobConfirmationDialogReactModule;
