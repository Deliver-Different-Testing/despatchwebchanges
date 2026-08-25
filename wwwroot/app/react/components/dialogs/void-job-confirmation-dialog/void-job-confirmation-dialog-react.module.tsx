/**
 * Void Job Confirmation Dialog React Module
 *
 * Entry point for the React-based Void Job Confirmation Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {VoidJobConfirmationDialog, VoidJobDialogJob, VoidJobResult, RelatedJob} from './VoidJobConfirmationDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {jobApi} from '../../../services/jobApi';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

async function loadRelatedJobs(jobId: number, isArchived: boolean, isBulkJob: boolean): Promise<RelatedJob[]> {
    const results = await jobApi.getRelatedJobsMultiSelectList(jobId, isArchived, isBulkJob);
    return results.map(r => ({
        id: r.id,
        text: r.text,
        selected: r.selected,
        isBulkJob: r.isBulkJob,
        isArchived: r.isArchived,
    }));
}

const host = createDialogHost<{job: VoidJobDialogJob}, VoidJobResult | null>({
    containerId: 'react-void-job-confirmation-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <VoidJobConfirmationDialog
            open={open}
            job={payload.job}
            onClose={() => close(null)}
            onConfirm={close}
            onLoadRelatedJobs={loadRelatedJobs}
            onVoidJob={(jobId, voidSingleJobOnly, voidReason, selectedJobIds) =>
                jobApi.voidJob({jobId, voidSingleJobOnly, voidReason, selectedJobIds})}
            onVoidBulkJob={(bulkJobId, voidSingleJobOnly, voidReason, selectedJobIds) =>
                jobApi.voidBulkJob({bulkJobId, voidSingleJobOnly, voidReason, selectedJobIds})}
            showToast={showToast}
        />
    ),
});

export function openVoidJobConfirmationDialog(
    job: VoidJobDialogJob,
    toastService?: ToastService
): Promise<VoidJobResult | null> {
    return host.open({job}, toastService);
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
