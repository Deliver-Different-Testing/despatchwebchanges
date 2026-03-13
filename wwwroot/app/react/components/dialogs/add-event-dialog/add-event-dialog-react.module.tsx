/**
 * Add Event Dialog React Module
 *
 * Entry point for the React-based Add Event Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AddEventDialog, AddEventJob, EventType, JobEventData } from './AddEventDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { getIanaTimezone, formatDateForApi, getTenantTimezone } from '../../../utils/dateUtils';
import { EventType as EventTypeEnum } from '../../../../enums/event-type';
import { JobNoteType } from '../../../../enums/job-note-type.enum';
import { eventApi } from '../../../services/eventApi';
import { notesApi } from '../../../services/notesApi';
import { openVoidJobConfirmationDialog } from '../void-job-confirmation-dialog/void-job-confirmation-dialog-react.module';

interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface DialogState {
    open: boolean;
    job: AddEventJob | null;
    toastService: ToastService | null;
    resolve?: (value: boolean) => void;
}

export interface OpenAddEventDialogOptions {
    job: AddEventJob;
    toastService?: ToastService;
}

/**
 * Add Event Dialog Manager Class
 * Manages the lifecycle and state of the Add Event Dialog.
 */
class AddEventDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        job: null,
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-add-event-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.(false);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleLoadEventTypes = async (): Promise<EventType[]> => {
            const eventTypes = await eventApi.getEventTypes();
            return eventTypes.map(et => ({ id: et.id, text: et.text }));
        };

        const handleSubmit = async (eventData: JobEventData): Promise<void> => {
            const { job, toastService } = this.dialogState;
            if (!job) {
                throw new Error('Job not available');
            }

            const eventTypes = await eventApi.getEventTypes();
            const selectedEventType = eventTypes.find(et => et.id === eventData.eventTypeId);
            const eventName = selectedEventType?.text ?? '';

            if (eventData.eventTypeId === EventTypeEnum.Compliment || eventData.eventTypeId === EventTypeEnum.Complaint) {
                await eventApi.exsalerateActivity(
                    eventName,
                    eventData.notes,
                    job.clientId ?? 0,
                    job.jobNo
                );
            }

            if (
                eventData.eventTypeId === EventTypeEnum.Closed ||
                eventData.eventTypeId === EventTypeEnum.AddressIncorrect ||
                eventData.eventTypeId === EventTypeEnum.FlightDetails ||
                eventData.eventTypeId === EventTypeEnum.WaitingForJob ||
                eventData.eventTypeId === EventTypeEnum.CancelJob
            ) {
                const newNote = eventName + ':' + eventData.notes;
                await notesApi.createNote({
                    jobId: job.id,
                    isImportant: false,
                    noteTypeId: JobNoteType.InternalNote,
                    noteText: newNote,
                });
            }

            const formattedEventData: JobEventData = {
                ...eventData,
                eventDueDate: formatDateForApi(eventData.eventDueDate),
            };

            await eventApi.addEvent(formattedEventData);

            if (eventData.eventTypeId === EventTypeEnum.CancelJob) {
                const jobDetail = await eventApi.getDispatchJobDetail(job.id) as { id: number; jobNo: string; isArchived: boolean };
                await openVoidJobConfirmationDialog(
                    {
                        id: jobDetail.id,
                        jobNo: jobDetail.jobNo,
                        isBulkJob: false,
                        isArchived: jobDetail.isArchived,
                    },
                    toastService ?? undefined
                );
            }

            this.dialogState.open = false;
            this.dialogState.resolve?.(true);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleShowToast = (message: string, type: 'success' | 'warning' | 'error') => {
            if (!this.dialogState.toastService) {
                console.log(`[Toast ${type}]: ${message}`);
                return;
            }
            this.dialogState.toastService.showToast(message, type);
        };

        const currentTheme = getTheme();
        const timezone = getIanaTimezone(getTenantTimezone());

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <AddEventDialog
                        open={this.dialogState.open}
                        job={this.dialogState.job}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        onLoadEventTypes={handleLoadEventTypes}
                        showToast={handleShowToast}
                        timezone={timezone}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    open(options: OpenAddEventDialogOptions): Promise<boolean> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                job: options.job,
                toastService: options.toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const addEventDialogManager = new AddEventDialogManager();

export function openAddEventDialog(options: OpenAddEventDialogOptions): Promise<boolean> {
    return addEventDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactAddEventDialog = {
    open: openAddEventDialog,
};

// Create AngularJS module
const addEventDialogReactModule = (window as any).angular.module(
    'uDispatch.addEventDialogReact',
    []
);

console.log('[AddEventDialogReact] Module registered');

export default addEventDialogReactModule;
