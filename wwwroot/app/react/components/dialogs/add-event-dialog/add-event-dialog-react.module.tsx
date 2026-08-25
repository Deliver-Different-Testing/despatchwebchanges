/**
 * Add Event Dialog React Module
 *
 * Entry point for the React-based Add Event Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { AddEventDialog, AddEventJob, JobEventData } from './AddEventDialog';
import { getIanaTimezone, formatDateForApi, getTenantTimezone } from '../../../utils/dateUtils';
import { EventType as EventTypeEnum } from '../../../../enums/event-type';
import { JobNoteType } from '../../../../enums/job-note-type.enum';
import { eventApi } from '../../../services/eventApi';
import { notesApi } from '../../../services/notesApi';
import { openVoidJobConfirmationDialog } from '../void-job-confirmation-dialog/void-job-confirmation-dialog-react.module';
import type { ToastService } from '../../../services/toastService';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

export interface OpenAddEventDialogOptions {
    job: AddEventJob;
    toastService?: ToastService;
}

const NOTE_WORTHY_EVENTS = new Set<number>([
    EventTypeEnum.Closed,
    EventTypeEnum.AddressIncorrect,
    EventTypeEnum.FlightDetails,
    EventTypeEnum.WaitingForJob,
    EventTypeEnum.CancelJob,
]);

async function submitEvent(
    job: AddEventJob,
    toastService: ToastService | undefined,
    eventData: JobEventData,
): Promise<void> {
    const eventTypes = await eventApi.getEventTypes();
    const eventName = eventTypes.find(et => et.id === eventData.eventTypeId)?.text ?? '';

    if (eventData.eventTypeId === EventTypeEnum.Compliment || eventData.eventTypeId === EventTypeEnum.Complaint) {
        await eventApi.exsalerateActivity(eventName, eventData.notes, job.clientId ?? 0, job.jobNo);
    }

    if (NOTE_WORTHY_EVENTS.has(eventData.eventTypeId)) {
        await notesApi.createNote({
            jobId: job.id,
            isImportant: false,
            noteTypeId: JobNoteType.InternalNote,
            noteText: eventName + ':' + eventData.notes,
        });
    }

    await eventApi.addEvent({...eventData, eventDueDate: formatDateForApi(eventData.eventDueDate)});

    if (eventData.eventTypeId === EventTypeEnum.CancelJob) {
        const jobDetail = await eventApi.getDispatchJobDetail(job.id) as { id: number; jobNo: string; isArchived: boolean };
        await openVoidJobConfirmationDialog(
            {
                id: jobDetail.id,
                jobNo: jobDetail.jobNo,
                isBulkJob: false,
                isArchived: jobDetail.isArchived,
            },
            toastService,
        );
    }
}

const host = createDialogHost<{job: AddEventJob; toastService?: ToastService}, boolean>({
    containerId: 'react-add-event-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <AddEventDialog
            open={open}
            job={payload.job}
            onClose={() => close(false)}
            onSubmit={async (eventData: JobEventData) => {
                await submitEvent(payload.job, payload.toastService, eventData);
                close(true);
            }}
            onLoadEventTypes={async () => {
                const eventTypes = await eventApi.getEventTypes();
                return eventTypes.map(et => ({ id: et.id, text: et.text }));
            }}
            showToast={showToast}
            timezone={getIanaTimezone(getTenantTimezone())}
        />
    ),
});

export function openAddEventDialog(options: OpenAddEventDialogOptions): Promise<boolean> {
    return host.open({job: options.job, toastService: options.toastService}, options.toastService);
}

// Expose to window for AngularJS access
window.ReactAddEventDialog = {
    open: openAddEventDialog,
};

// Create AngularJS module
const addEventDialogReactModule = window.angular!.module(
    'uDispatch.addEventDialogReact',
    []
);

console.log('[AddEventDialogReact] Module registered');

export default addEventDialogReactModule;
