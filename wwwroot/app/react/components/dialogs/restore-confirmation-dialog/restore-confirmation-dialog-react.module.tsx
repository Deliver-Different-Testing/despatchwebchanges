/**
 * Restore Confirmation Dialog React Module
 *
 * Entry point for the React restore confirmation, exposed as a global so the AngularJS
 * job-search FAB can warn before a restore destroys proof of delivery. The POD pre-check runs
 * here, so the AngularJS side only has to await a decision.
 */

import React from 'react';
import {RestoreConfirmationDialog} from './RestoreConfirmationDialog';
import type {RestorePodImpactSummary} from './RestoreConfirmationDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {getRestorePodImpact} from '../../../services/jobListApi';
import {needsRestoreConfirmation, summarisePodImpact} from '../../../services/restorePodImpact';
import {createDialogHost} from '../../../utils/reactDialogHost';

export interface RestoreConfirmRequest {
    jobId: number;
    /** Whether the job is completed — restoring reopens it, which is worth confirming on its own. */
    done?: boolean;
}

export type RestoreConfirmResult =
    | {action: 'restore'; removeCapturedImages: boolean}
    | {action: 'swapPod'};

const host = createDialogHost<{done: boolean; summary: RestorePodImpactSummary}, RestoreConfirmResult | null>({
    containerId: 'react-restore-confirm-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <RestoreConfirmationDialog
            open={open}
            count={payload.done ? 1 : 0}
            podImpact={payload.summary}
            onClose={() => close(null)}
            onSwapPod={() => close({action: 'swapPod'})}
            onConfirm={(removeCapturedImages) => close({action: 'restore', removeCapturedImages})}
        />
    ),
});

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

    return host.open({done: !!request.done, summary});
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
