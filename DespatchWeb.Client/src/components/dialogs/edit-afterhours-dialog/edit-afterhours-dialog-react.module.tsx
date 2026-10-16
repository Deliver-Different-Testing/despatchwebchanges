/**
 * Edit Afterhours Dialog React Module
 *
 * Entry point for the React-based Edit Afterhours Dialog.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {EditAfterhoursDialog} from './EditAfterhoursDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {AfterHoursCourierSchedule} from '../../../types';
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

export const reactEditAfterhoursDialog = {
    open: openEditAfterhoursDialog,
};
