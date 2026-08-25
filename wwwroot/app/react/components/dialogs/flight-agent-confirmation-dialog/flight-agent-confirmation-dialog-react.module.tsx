/**
 * Flight Agent Confirmation Dialog React Module
 *
 * Entry point for the React-based Flight Agent Confirmation Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import duration from 'dayjs/plugin/duration';

import {FlightAgentConfirmationDialog} from './FlightAgentConfirmationDialog';
import {formatDateForApi, getIanaTimezone, getTenantTimezone} from '../../../utils/dateUtils';
import {nationwideApi} from '../../../services/nationwideApi';
import {AgentSuggestion, FlightAgentDialogResult, FlightCargoProcessing, FlightViewModel, ToastService,} from './types';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import {createDialogHost} from '../../../utils/reactDialogHost';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(duration);

interface FlightAgentPayload {
    mode: 'flight' | 'agent';
    jobId: number;
    jobNumber: string;
    flight?: FlightViewModel;
    agent?: AgentSuggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
}

const DISMISSED: FlightAgentDialogResult = {
    shouldAssign: false,
    shouldAssignToStopJobs: false,
};

async function calculateCargoTimes(
    jobId: number,
    carrierFsCode: string,
    arrivalTime: Dayjs,
    tz: string
): Promise<FlightCargoProcessing | null> {
    try {
        return await nationwideApi.calculateCargoReadyTime(
            jobId,
            carrierFsCode,
            formatDateForApi(arrivalTime, tz)
        );
    } catch (error) {
        console.error('Error calculating cargo times:', error);
        return null;
    }
}

const host = createDialogHost<FlightAgentPayload, FlightAgentDialogResult>({
    containerId: 'react-flight-agent-confirmation-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <MuiThemeIsland>
            <FlightAgentConfirmationDialog
                open={open}
                mode={payload.mode}
                jobId={payload.jobId}
                jobNumber={payload.jobNumber}
                flight={payload.flight}
                agent={payload.agent}
                existingAwb={payload.existingAwb}
                dgClass={payload.dgClass}
                stopJobCount={payload.stopJobCount}
                timezone={getIanaTimezone(getTenantTimezone())}
                onClose={() => close(DISMISSED)}
                onConfirm={close}
                onCalculateCargoTimes={calculateCargoTimes}
                showToast={showToast}
            />
        </MuiThemeIsland>
    ),
});

export function openFlightConfirmationDialog(options: {
    jobId: number;
    jobNumber: string;
    flight: FlightViewModel;
    existingAwb?: string;
    dgClass?: number;
    toastService?: ToastService;
}): Promise<FlightAgentDialogResult> {
    return host.open({
        mode: 'flight',
        jobId: options.jobId,
        jobNumber: options.jobNumber,
        flight: options.flight,
        existingAwb: options.existingAwb,
        dgClass: options.dgClass,
    }, options.toastService);
}

export function openAgentConfirmationDialog(options: {
    jobId: number;
    jobNumber: string;
    agent: AgentSuggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
    toastService?: ToastService;
}): Promise<FlightAgentDialogResult> {
    return host.open({
        mode: 'agent',
        jobId: options.jobId,
        jobNumber: options.jobNumber,
        agent: options.agent,
        existingAwb: options.existingAwb,
        dgClass: options.dgClass,
        stopJobCount: options.stopJobCount,
    }, options.toastService);
}

// Expose to window for AngularJS access
window.ReactFlightAgentConfirmationDialog = {
    openFlightDialog: openFlightConfirmationDialog,
    openAgentDialog: openAgentConfirmationDialog,
};

// Create AngularJS module for ocLazyLoad
const flightAgentConfirmationDialogReactModule = window.angular!.module(
    'uDispatch.flightAgentConfirmationDialogReact',
    []
);

console.log('[FlightAgentConfirmationDialogReact] Module registered');

export default flightAgentConfirmationDialogReactModule;
