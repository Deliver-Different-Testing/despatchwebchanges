/**
 * Recovery Agent Management Dialog React Module
 *
 * Entry point for the React-based Recovery Agent Management Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {RecoveryAgentManagementDialog} from './RecoveryAgentManagementDialog';
import {getTheme} from '../../../theme/muiTheme';
import {nationwideApi} from '../../../services/nationwideApi';
import {toastService} from '../../../services/toastService';
import type {RecoveryAgentJobViewModel} from '../../../services/nationwideApi';

interface DialogState {
    open: boolean;
    job: RecoveryAgentJobViewModel | null;
}

export interface OpenRecoveryAgentManagementDialogOptions {
    jobId: number;
}

class RecoveryAgentManagementDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        job: null,
    };
    private resolveCurrent?: () => void;

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-recovery-agent-management-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState = {open: false, job: null};
            this.renderDialog();
            this.resolveCurrent?.();
            this.resolveCurrent = undefined;
        };

        const currentTheme = getTheme();

        this.dialogRoot.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <RecoveryAgentManagementDialog
                    open={this.dialogState.open}
                    job={this.dialogState.job}
                    onClose={handleClose}
                    onLoadAirports={() => nationwideApi.getAllActiveAirports()}
                    onLoadAgentsForAirport={(airportId) =>
                        nationwideApi.getAgentOptionsByAirport(airportId)
                    }
                    onAddAgent={(request) => nationwideApi.addAgentRecoveryJob(request)}
                    onUpdateAgent={(request) => nationwideApi.updateAgentRecoveryJob(request)}
                    onRemoveAgent={(recoveryId) => nationwideApi.removeAgentRecoveryJob(recoveryId)}
                    onRefresh={async () => {
                        if (!this.dialogState.job) {
                            throw new Error('No job loaded');
                        }
                        return nationwideApi.getAgentRecoveryJobs(this.dialogState.job.jobId);
                    }}
                    showToast={(message, type) => toastService.showToast(message, type)}
                />
            </ThemeProvider>
        );
    }

    async open(options: OpenRecoveryAgentManagementDialogOptions): Promise<void> {
        this.initializeDialogRoot();

        try {
            const job = await nationwideApi.getAgentRecoveryJobs(options.jobId);

            return new Promise<void>((resolve) => {
                this.resolveCurrent = resolve;
                this.dialogState = {open: true, job};
                this.renderDialog();
            });
        } catch (error) {
            console.error('Error loading recovery agent job:', error);
            toastService.showToast('Failed to load recovery agent details', 'error');
        }
    }
}

const recoveryAgentManagementDialogManager = new RecoveryAgentManagementDialogManager();

export async function openRecoveryAgentManagementDialog(
    options: OpenRecoveryAgentManagementDialogOptions
): Promise<void> {
    return recoveryAgentManagementDialogManager.open(options);
}

// Expose to window for AngularJS access
window.ReactRecoveryAgentManagementDialog = {
    open: openRecoveryAgentManagementDialog,
};

// Create AngularJS module
const recoveryAgentManagementDialogReactModule = window.angular!.module(
    'uDispatch.recoveryAgentManagementDialogReact',
    []
);

console.log('[RecoveryAgentManagementDialogReact] Module registered');

export default recoveryAgentManagementDialogReactModule;
