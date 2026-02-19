/**
 * Flight Agent Confirmation Dialog React Module
 *
 * Entry point for the React-based Flight Agent Confirmation Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import duration from 'dayjs/plugin/duration';

import { FlightAgentConfirmationDialog } from './FlightAgentConfirmationDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { getIanaTimezone, formatDateForApi, getTenantTimezone } from '../../../utils/dateUtils';
import { nationwideApi } from '../../../services/nationwideApi';
import angular from 'angular';
import {
    FlightAgentDialogResult,
    FlightViewModel,
    AgentSuggestion,
    FlightCargoProcessing,
    ToastService,
} from './types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(duration);

interface DialogState {
    open: boolean;
    mode: 'flight' | 'agent';
    jobId: number;
    jobNumber: string;
    flight?: FlightViewModel;
    agent?: AgentSuggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
    toastService: ToastService | null;
    resolve?: (value: FlightAgentDialogResult) => void;
}

/**
 * Flight Agent Confirmation Dialog Manager
 * Manages the lifecycle and state of the dialog.
 */
class FlightAgentConfirmationDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        mode: 'flight',
        jobId: 0,
        jobNumber: '',
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-flight-agent-confirmation-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.({
                shouldAssign: false,
                shouldAssignToStopJobs: false,
            });
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleConfirm = (result: FlightAgentDialogResult) => {
            this.dialogState.open = false;
            this.dialogState.resolve?.(result);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleCalculateCargoTimes = async (
            jobId: number,
            carrierFsCode: string,
            arrivalTime: Dayjs,
            tz: string
        ): Promise<FlightCargoProcessing | null> => {
            try {
                const formattedArrivalTime = formatDateForApi(arrivalTime, tz);
                const result = await nationwideApi.calculateCargoReadyTime(
                    jobId,
                    carrierFsCode,
                    formattedArrivalTime
                );
                return result;
            } catch (error) {
                console.error('Error calculating cargo times:', error);
                return null;
            }
        };

        const handleShowToast = (message: string, type: 'success' | 'warning' | 'error') => {
            if (!this.dialogState.toastService) {
                console.log(`[Toast ${type}]: ${message}`);
                return;
            }
            this.dialogState.toastService.showToast(message, type);
        };

        const currentTheme = getTheme();
        const tz = getIanaTimezone(getTenantTimezone());

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <FlightAgentConfirmationDialog
                        open={this.dialogState.open}
                        mode={this.dialogState.mode}
                        jobId={this.dialogState.jobId}
                        jobNumber={this.dialogState.jobNumber}
                        flight={this.dialogState.flight}
                        agent={this.dialogState.agent}
                        existingAwb={this.dialogState.existingAwb}
                        dgClass={this.dialogState.dgClass}
                        stopJobCount={this.dialogState.stopJobCount}
                        timezone={tz}
                        onClose={handleClose}
                        onConfirm={handleConfirm}
                        onCalculateCargoTimes={handleCalculateCargoTimes}
                        showToast={handleShowToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    openFlightDialog(options: {
        jobId: number;
        jobNumber: string;
        flight: FlightViewModel;
        existingAwb?: string;
        dgClass?: number;
        toastService?: ToastService;
    }): Promise<FlightAgentDialogResult> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                mode: 'flight',
                jobId: options.jobId,
                jobNumber: options.jobNumber,
                flight: options.flight,
                agent: undefined,
                existingAwb: options.existingAwb,
                dgClass: options.dgClass,
                stopJobCount: undefined,
                toastService: options.toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }

    openAgentDialog(options: {
        jobId: number;
        jobNumber: string;
        agent: AgentSuggestion;
        existingAwb?: string;
        dgClass?: number;
        stopJobCount?: number;
        toastService?: ToastService;
    }): Promise<FlightAgentDialogResult> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                mode: 'agent',
                jobId: options.jobId,
                jobNumber: options.jobNumber,
                flight: undefined,
                agent: options.agent,
                existingAwb: options.existingAwb,
                dgClass: options.dgClass,
                stopJobCount: options.stopJobCount,
                toastService: options.toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new FlightAgentConfirmationDialogManager();

export function openFlightConfirmationDialog(options: {
    jobId: number;
    jobNumber: string;
    flight: FlightViewModel;
    existingAwb?: string;
    dgClass?: number;
    toastService?: ToastService;
}): Promise<FlightAgentDialogResult> {
    return dialogManager.openFlightDialog(options);
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
    return dialogManager.openAgentDialog(options);
}

// Expose to window for AngularJS access
(window as any).ReactFlightAgentConfirmationDialog = {
    openFlightDialog: openFlightConfirmationDialog,
    openAgentDialog: openAgentConfirmationDialog,
};

// Create AngularJS module for ocLazyLoad
const flightAgentConfirmationDialogReactModule = (window as any).angular.module(
    'uDispatch.flightAgentConfirmationDialogReact',
    []
);

console.log('[FlightAgentConfirmationDialogReact] Module registered');

export default flightAgentConfirmationDialogReactModule;
