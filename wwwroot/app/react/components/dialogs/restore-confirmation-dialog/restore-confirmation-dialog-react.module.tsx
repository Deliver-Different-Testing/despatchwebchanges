/**
 * Restore Confirmation Dialog React Module
 *
 * Entry point for the React restore confirmation, exposed as a global so the AngularJS
 * job-search FAB can warn before a restore destroys proof of delivery. The POD pre-check runs
 * here, so the AngularJS side only has to await a decision.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {RestoreConfirmationDialog} from './RestoreConfirmationDialog';
import type {RestorePodImpactSummary} from './RestoreConfirmationDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {getRestorePodImpact} from '../../../services/jobListApi';
import {needsRestoreConfirmation, summarisePodImpact} from '../../../services/restorePodImpact';

export interface RestoreConfirmRequest {
    jobId: number;
    /** Whether the job is completed — restoring reopens it, which is worth confirming on its own. */
    done?: boolean;
}

export type RestoreConfirmResult =
    | {action: 'restore'; removeCapturedImages: boolean}
    | {action: 'swapPod'};

interface DialogState {
    open: boolean;
    done: boolean;
    summary: RestorePodImpactSummary;
    resolve?: (value: RestoreConfirmResult | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    done: false,
    summary: {jobsWithPodName: 0, imageCount: 0},
};

function settle(value: RestoreConfirmResult | null): void {
    dialogState.open = false;
    dialogState.resolve?.(value);
    dialogState.resolve = undefined;
    renderDialog();
}

function renderDialog(): void {
    if (!dialogRoot) return;

    dialogRoot.render(islandTree(
        <RestoreConfirmationDialog
            open={dialogState.open}
            count={dialogState.done ? 1 : 0}
            podImpact={dialogState.summary}
            onClose={() => settle(null)}
            onSwapPod={() => settle({action: 'swapPod'})}
            onConfirm={(removeCapturedImages) => settle({action: 'restore', removeCapturedImages})}
        />
    ));
}

function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-restore-confirm-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Checks what the restore would destroy and, when that's worth stopping for, asks the operator.
 * Resolves immediately with a plain restore when there is nothing to warn about, and with null
 * when the operator cancels.
 */
export async function openRestoreConfirmDialog(
    request: RestoreConfirmRequest,
): Promise<RestoreConfirmResult | null> {
    let summary: RestorePodImpactSummary = {jobsWithPodName: 0, imageCount: 0};
    try {
        summary = summarisePodImpact(await getRestorePodImpact([request.jobId]));
    } catch {
        // Never block a restore on the pre-check.
    }

    if (!needsRestoreConfirmation(!!request.done, summary)) {
        return {action: 'restore', removeCapturedImages: false};
    }

    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {open: true, done: !!request.done, summary, resolve};
        renderDialog();
    });
}

window.ReactRestoreConfirmDialog = {
    open: openRestoreConfirmDialog,
};

const restoreConfirmDialogReactModule = window.angular!.module(
    'uDispatch.restoreConfirmDialogReact',
    []
);

console.log('[RestoreConfirmDialogReact] Module registered');

export default restoreConfirmDialogReactModule;
