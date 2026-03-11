/**
 * Event Group Dialog React Module
 *
 * Entry point for the React-based Event Group Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { EventGroupDialog } from './EventGroupDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { getIanaTimezone, getTenantTimezone } from '../../../utils/dateUtils';
import { getEventTypeGroups, addTasks, getActiveStaff } from '../../../services/tasksApi';
import { EventGroupViewModel, StaffSuggestion } from '../../../interfaces';

interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface DialogState {
    open: boolean;
    events: EventGroupViewModel[];
    users: StaffSuggestion[];
    jobId: number;
    toastService: ToastService | null;
    resolve?: (value: boolean) => void;
}

export interface OpenEventGroupDialogOptions {
    eventGroupId: number;
    jobId: number;
    toastService?: ToastService;
}

/**
 * Event Group Dialog Manager Class
 * Manages the lifecycle and state of the Event Group Dialog.
 */
class EventGroupDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        events: [],
        users: [],
        jobId: 0,
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-event-group-dialog-root';
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

        const handleSave = async (events: EventGroupViewModel[]): Promise<void> => {
            const { jobId} = this.dialogState;

            await addTasks(jobId, events);

            const taskCount = events.length;
            handleShowToast(
                `${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`,
                'success'
            );

            this.dialogState.open = false;
            this.dialogState.resolve?.(true);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleOpenAdminManager = () => {
            const adminUrl = window.location.href.replace(/adminmanager/g, 'hub');
            window.open(adminUrl, '_blank');
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
                    <EventGroupDialog
                        open={this.dialogState.open}
                        events={this.dialogState.events}
                        users={this.dialogState.users}
                        onClose={handleClose}
                        onSave={handleSave}
                        onOpenAdminManager={handleOpenAdminManager}
                        showToast={handleShowToast}
                        timezone={timezone}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    async open(options: OpenEventGroupDialogOptions): Promise<boolean> {
        this.initializeDialogRoot();

        const [events, users] = await Promise.all([
            getEventTypeGroups(options.eventGroupId),
            getActiveStaff(),
        ]);

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                events,
                users,
                jobId: options.jobId,
                toastService: options.toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const eventGroupDialogManager = new EventGroupDialogManager();

export function openEventGroupDialog(options: OpenEventGroupDialogOptions): Promise<boolean> {
    return eventGroupDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactEventGroupDialog = {
    open: openEventGroupDialog,
};

// Create AngularJS module
const eventGroupDialogReactModule = (window as any).angular.module(
    'uDispatch.eventGroupDialogReact',
    []
);

console.log('[EventGroupDialogReact] Module registered');

export default eventGroupDialogReactModule;
