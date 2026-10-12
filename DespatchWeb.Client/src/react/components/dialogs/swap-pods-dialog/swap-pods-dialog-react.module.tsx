/**
 * Swap PODs Dialog React Module
 *
 * Entry point for the React-based Swap PODs Dialog.
 */

import React from 'react';
import {SwapPodsDialog} from './SwapPodsDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {jobApi} from '../../../services/jobApi';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{jobNo: string; customer?: string}, boolean | null>({
    containerId: 'react-swap-pods-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <SwapPodsDialog
            open={open}
            jobNo={payload.jobNo}
            customer={payload.customer}
            onClose={() => close(null)}
            onValidate={(jobNo: string) => jobApi.validateSwapPod(jobNo)}
            onSearch={(query, options) => jobApi.searchSwapPodCandidates(query, options)}
            onSwap={async (job1: string, job2: string) => {
                const result = await jobApi.swapPod(job1, job2);
                close(true);
                return result;
            }}
            showToast={showToast}
        />
    ),
});

export function openSwapPodsDialog(
    jobNo: string,
    toastService?: ToastService,
    customer?: string
): Promise<boolean | null> {
    return host.open({jobNo, customer}, toastService);
}

export const reactSwapPodsDialog = {
    open: openSwapPodsDialog,
};
