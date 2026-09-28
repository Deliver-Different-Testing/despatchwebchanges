/**
 * Recovery Agent Management Dialog React Module
 *
 * Entry point for the React-based Recovery Agent Management Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import {RecoveryAgentManagementDialog} from './RecoveryAgentManagementDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {nationwideApi} from '../../../services/nationwideApi';
import {toastService} from '../../../services/toastService';
import type {RecoveryAgentJobViewModel} from '../../../interfaces/nationwideJobs';
import {createDialogHost} from '../../../utils/reactDialogHost';

export interface OpenRecoveryAgentManagementDialogOptions {
    jobId: number;
}

const host = createDialogHost<{job: RecoveryAgentJobViewModel}, void>({
    containerId: 'react-recovery-agent-management-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <RecoveryAgentManagementDialog
            open={open}
            job={payload.job}
            onClose={() => close()}
            onLoadAirports={() => nationwideApi.getAllActiveAirports()}
            onLoadAgentsForAirport={(airportId) => nationwideApi.getAgentOptionsByAirport(airportId)}
            onAddAgent={(request) => nationwideApi.addAgentRecoveryJob(request)}
            onUpdateAgent={(request) => nationwideApi.updateAgentRecoveryJob(request)}
            onRemoveAgent={(recoveryId) => nationwideApi.removeAgentRecoveryJob(recoveryId)}
            onRefresh={() => nationwideApi.getAgentRecoveryJobs(payload.job.jobId)}
            showToast={(message, type) => toastService.showToast(message, type)}
        />
    ),
});

export async function openRecoveryAgentManagementDialog(
    options: OpenRecoveryAgentManagementDialogOptions
): Promise<void> {
    try {
        const job = await nationwideApi.getAgentRecoveryJobs(options.jobId);
        return host.open({job});
    } catch (error) {
        console.error('Error loading recovery agent job:', error);
        toastService.showToast('Failed to load recovery agent details', 'error');
    }
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
