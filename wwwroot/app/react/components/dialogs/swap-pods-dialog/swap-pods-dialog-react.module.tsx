/**
 * Swap PODs Dialog React Module
 *
 * Entry point for the React-based Swap PODs Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {SwapPodsDialog} from './SwapPodsDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {jobApi} from '../../../services/jobApi';
import type {ShowToastFn, ToastService} from '../../../services/toastService';

interface DialogState {
    open: boolean;
    jobNo: string;
    toastService: ToastService | null;
    resolve?: (value: boolean | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    jobNo: '',
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

    const handleValidate = async (jobNo: string): Promise<boolean> => {
        return jobApi.validateSwapPod(jobNo);
    };

    const handleSwap = async (job1: string, job2: string): Promise<void> => {
        await jobApi.swapPod(job1, job2);
        dialogState.open = false;
        dialogState.resolve?.(true);
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

    dialogRoot.render(islandTree(
        <SwapPodsDialog
            open={dialogState.open}
            jobNo={dialogState.jobNo}
            onClose={handleClose}
            onValidate={handleValidate}
            onSwap={handleSwap}
            showToast={handleShowToast}
        />
    ));
}

function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-swap-pods-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

export function openSwapPodsDialog(
    jobNo: string,
    toastService?: ToastService
): Promise<boolean | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            jobNo,
            toastService: toastService ?? null,
            resolve,
        };
        renderDialog();
    });
}

window.ReactSwapPodsDialog = {
    open: openSwapPodsDialog,
};

const swapPodsDialogReactModule = window.angular!.module(
    'uDispatch.swapPodsDialogReact',
    []
);

console.log('[SwapPodsDialogReact] Module registered');

export default swapPodsDialogReactModule;
