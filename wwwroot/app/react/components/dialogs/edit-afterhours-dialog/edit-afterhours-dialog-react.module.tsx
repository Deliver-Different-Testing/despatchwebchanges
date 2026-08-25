/**
 * Edit Afterhours Dialog React Module
 *
 * Entry point for the React-based Edit Afterhours Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {EditAfterhoursDialog} from './EditAfterhoursDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {AfterHoursCourierSchedule} from '../../../interfaces';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<
    {schedule: AfterHoursCourierSchedule | null; isUsTenant: boolean},
    AfterHoursCourierSchedule | null
>({
    containerId: 'react-edit-afterhours-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <EditAfterhoursDialog
            open={open}
            schedule={payload.schedule}
            isUsTenant={payload.isUsTenant}
            onClose={() => close(null)}
            onSave={close}
            showToast={showToast}
        />
    ),
});

/**
 * Opens the edit afterhours dialog
 *
 * @param schedule - The schedule to edit, or null/empty for new schedule
 * @param isUsTenant - Whether this is a US tenant (affects timezone display)
 * @param toastService - Toast service for showing notifications (optional, for AngularJS integration)
 * @returns Promise that resolves with the updated schedule, or null if canceled
 */
export function openEditAfterhoursDialog(
    schedule: AfterHoursCourierSchedule | null,
    isUsTenant: boolean,
    toastService?: ToastService
): Promise<AfterHoursCourierSchedule | null> {
    return host.open({schedule, isUsTenant}, toastService);
}

// Expose globally for AngularJS access
window.ReactEditAfterhoursDialog = {
    open: openEditAfterhoursDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const editAfterhoursDialogReactModule = window.angular!.module(
    'uDispatch.editAfterhoursDialogReact',
    []
);

console.log('[EditAfterhoursDialogReact] Module registered');

export default editAfterhoursDialogReactModule;
