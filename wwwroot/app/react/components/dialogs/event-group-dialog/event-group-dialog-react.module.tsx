/**
 * Event Group Dialog React Module
 *
 * Entry point for the React-based Event Group Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { EventGroupDialog } from './EventGroupDialog';
import { getIanaTimezone, getTenantTimezone } from '../../../utils/dateUtils';
import { getEventTypeGroups, getActiveStaff } from '../../../services/tasksApi';
import { saveTasks } from './saveTasks';
import { EventGroupViewModel, StaffSuggestion } from '../../../interfaces';
import type { ToastService } from '../../../services/toastService';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import {createDialogHost} from '../../../utils/reactDialogHost';

export interface OpenEventGroupDialogOptions {
    eventGroupId: number;
    jobId: number;
    toastService?: ToastService;
}

function openAdminManager(): void {
    window.open(window.location.href.replace(/adminmanager/g, 'hub'), '_blank');
}

const host = createDialogHost<{events: EventGroupViewModel[]; users: StaffSuggestion[]; jobId: number}, boolean>({
    containerId: 'react-event-group-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <MuiThemeIsland>
            <EventGroupDialog
                open={open}
                events={payload.events}
                users={payload.users}
                onClose={() => close(false)}
                onSave={async (events: EventGroupViewModel[]) => {
                    await saveTasks(payload.jobId, events);
                    const taskCount = events.length;
                    showToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`, 'success');
                    close(true);
                }}
                onOpenAdminManager={openAdminManager}
                showToast={showToast}
                timezone={getIanaTimezone(getTenantTimezone())}
            />
        </MuiThemeIsland>
    ),
});

export async function openEventGroupDialog(options: OpenEventGroupDialogOptions): Promise<boolean> {
    const [events, users] = await Promise.all([
        getEventTypeGroups(options.eventGroupId),
        getActiveStaff(),
    ]);

    return host.open({events, users, jobId: options.jobId}, options.toastService);
}

// Expose to window for AngularJS access
window.ReactEventGroupDialog = {
    open: openEventGroupDialog,
};

// Create AngularJS module
const eventGroupDialogReactModule = window.angular!.module(
    'uDispatch.eventGroupDialogReact',
    []
);

console.log('[EventGroupDialogReact] Module registered');

export default eventGroupDialogReactModule;
