/**
 * Accessorial Charges Dialog React Module
 *
 * Entry point for the React-based Accessorial Charges Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import { AccessorialChargesDialog } from './AccessorialChargesDialog';
import { AccessorialChargesJob, OpenAccessorialChargesDialogOptions } from './types';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{job: AccessorialChargesJob}, boolean>({
    containerId: 'react-accessorial-charges-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <AccessorialChargesDialog
            open={open}
            job={payload.job}
            onClose={() => close(false)}
            showToast={showToast}
        />
    ),
});

export function openAccessorialChargesDialog(options: OpenAccessorialChargesDialogOptions): Promise<boolean> {
    const { job, toastService } = options;

    if (!job.id || !job.accessorialChargeGroupId) {
        console.debug('[AccessorialChargesDialog] Missing jobId or accessorialChargeGroupId');
        return Promise.resolve(false);
    }

    return host.open({job}, toastService);
}

// Expose to window for AngularJS access
window.ReactAccessorialChargesDialog = {
    open: openAccessorialChargesDialog,
};

// Create AngularJS module
const accessorialChargesDialogReactModule = window.angular!.module(
    'uDispatch.accessorialChargesDialogReact',
    []
);

console.log('[AccessorialChargesDialogReact] Module registered');

export default accessorialChargesDialogReactModule;
