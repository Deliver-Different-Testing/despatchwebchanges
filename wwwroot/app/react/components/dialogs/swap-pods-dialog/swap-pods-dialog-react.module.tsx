/**
 * Swap PODs Dialog React Module
 *
 * Entry point for the React-based Swap PODs Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {SwapPodsDialog} from './SwapPodsDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {jobApi} from '../../../services/jobApi';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{jobNo: string}, boolean | null>({
    containerId: 'react-swap-pods-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <SwapPodsDialog
            open={open}
            jobNo={payload.jobNo}
            onClose={() => close(null)}
            onValidate={(jobNo: string) => jobApi.validateSwapPod(jobNo)}
            onSwap={async (job1: string, job2: string) => {
                await jobApi.swapPod(job1, job2);
                close(true);
            }}
            showToast={showToast}
        />
    ),
});

export function openSwapPodsDialog(
    jobNo: string,
    toastService?: ToastService
): Promise<boolean | null> {
    return host.open({jobNo}, toastService);
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
