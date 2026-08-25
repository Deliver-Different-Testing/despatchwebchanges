/**
 * Create Job Dialog React Module
 *
 * Entry point for the React-based Create Job Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {CreateJobDialog} from './CreateJobDialog';
import type {ToastService} from '../../../services/toastService';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{isUsTenant: boolean}, number | null>({
    containerId: 'react-create-job-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <MuiThemeIsland>
            <CreateJobDialog
                open={open}
                isUsTenant={payload.isUsTenant}
                onClose={() => close(null)}
                onSubmit={close}
                showToast={showToast}
            />
        </MuiThemeIsland>
    ),
});

/**
 * Opens the create job dialog
 *
 * @param isUsTenant - Whether this is a US tenant
 * @param toastService - Toast service for showing notifications (optional)
 * @returns Promise that resolves with the new job ID, or null if canceled
 */
export function openCreateJobDialog(
    isUsTenant: boolean = false,
    toastService?: ToastService
): Promise<number | null> {
    return host.open({isUsTenant}, toastService);
}

// Expose globally for AngularJS access
window.ReactCreateJobDialog = {
    open: openCreateJobDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const createJobDialogReactModule = window.angular!.module(
    'uDispatch.createJobDialogReact',
    []
);

console.log('[CreateJobDialogReact] Module registered');

export default createJobDialogReactModule;
