/**
 * Event Group Dialog React Module
 *
 * Entry point for the React-based Event Group Dialog.
 */

import React from 'react';
import { EventGroupDialog } from './EventGroupDialog';
import { getIanaTimezone, getTenantTimezone } from '../../../utils/dateUtils';
import { getEventTypeGroups, getActiveStaff } from '../../../api/tasksApi';
import { saveTasks } from './saveTasks';
import { EventGroupViewModel, StaffSuggestion } from '../../../types';
import type { ToastService } from '../../../services/toastService';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

export interface OpenEventGroupDialogOptions {
    eventGroupId: number;
    jobId: number;
    jobNumber?: string;
    toastService?: ToastService;
}

function openAdminManager(): void {
    window.open(window.location.href.replace(/adminmanager/g, 'hub'), '_blank');
}

const host = createDialogHost<{events: EventGroupViewModel[]; users: StaffSuggestion[]; jobId: number; jobNumber?: string}, boolean>({
    containerId: 'react-event-group-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <EventGroupDialog
            open={open}
            events={payload.events}
            users={payload.users}
            jobNumber={payload.jobNumber}
            onClose={() => close(false)}
            onSave={async (events: EventGroupViewModel[]) => {
                await saveTasks(payload.jobId, events);
                const taskCount = events.length;
                showToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added`, 'success');
                close(true);
            }}
            onOpenAdminManager={openAdminManager}
            timezone={getIanaTimezone(getTenantTimezone())}
        />
    ),
});

export async function openEventGroupDialog(options: OpenEventGroupDialogOptions): Promise<boolean> {
    const [events, users] = await Promise.all([
        getEventTypeGroups(options.eventGroupId),
        getActiveStaff(),
    ]);

    return host.open({events, users, jobId: options.jobId, jobNumber: options.jobNumber}, options.toastService);
}

export const reactEventGroupDialog = {
    open: openEventGroupDialog,
};
