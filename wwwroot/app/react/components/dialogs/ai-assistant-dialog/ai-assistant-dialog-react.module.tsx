/**
 * AI Assistant Dialog React Module
 *
 * Entry point for the React-based AI Assistant Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AiAssistantDialog } from './AiAssistantDialog';
import { AiSummaryPanel } from '../../common/ai-summary-panel/AiSummaryPanel';
import { AiCourierSuggestionsDialog } from './AiCourierSuggestionsDialog';
import { OpenAiAssistantDialogOptions } from './types';
import { getTheme } from '../../../theme/muiTheme';
import { summarizeJobNotes, summarizeJob, summarizeOperations, analyzeLateAlert, suggestCouriers, AiSummaryResponse, AiCourierSuggestionResponse } from '../../../services/aiAssistantApi';
import type { ShowToastFn } from '../../../services/toastService';

// Get current staff info from global variables
declare const FullName: string;

interface DialogState {
    open: boolean;
    toastService: { showToast: ShowToastFn } | null;
    resolve?: (value: void) => void;
}

/**
 * AI Assistant Dialog Manager Class
 * Manages the lifecycle and state of the AI Assistant Dialog.
 */
class AiAssistantDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {
        open: false,
        toastService: null,
    };

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-ai-assistant-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.();
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleShowToast: ShowToastFn = (message, type) => {
            if (!this.dialogState.toastService) {
                console.log(`[Toast ${type}]: ${message}`);
                return;
            }
            this.dialogState.toastService.showToast(message, type);
        };

        const currentTheme = getTheme();
        const currentStaffName = typeof FullName !== 'undefined' ? FullName : 'Operator';

        this.dialogRoot.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <AiAssistantDialog
                    open={this.dialogState.open}
                    onClose={handleClose}
                    showToast={handleShowToast}
                    currentStaffName={currentStaffName}
                />
            </ThemeProvider>
        );
    }

    async open(options?: OpenAiAssistantDialogOptions): Promise<void> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                toastService: options?.toastService ?? null,
                resolve,
            };
            this.renderDialog();
        });
    }

    async summarizeNotes(jobId: number): Promise<AiSummaryResponse> {
        return summarizeJobNotes(jobId);
    }

    async summarizeFullJob(jobId: number): Promise<AiSummaryResponse> {
        return summarizeJob(jobId);
    }

    async analyzeLateAlert(jobId: number): Promise<AiSummaryResponse> {
        return analyzeLateAlert(jobId);
    }

    async suggestCouriers(jobId: number): Promise<AiCourierSuggestionResponse> {
        return suggestCouriers(jobId);
    }

    showCourierSuggestions(
        jobId: number,
        jobNo: string,
        onAssign: (courierId: number) => Promise<void>,
        onRefresh?: () => void
    ): Promise<void> {
        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.id = 'react-ai-courier-suggestions-root';
            document.body.appendChild(container);
            const root = createRoot(container);

            const cleanup = () => {
                root.unmount();
                container.remove();
                resolve();
            };

            const handleAssign = async (courierId: number) => {
                await onAssign(courierId);
                onRefresh?.();
            };

            const renderDialog = (open: boolean) => {
                const currentTheme = getTheme();
                root.render(
                    <ThemeProvider theme={currentTheme}>
                        <CssBaseline />
                        <AiCourierSuggestionsDialog
                            open={open}
                            onClose={() => {
                                renderDialog(false);
                                setTimeout(cleanup, 300);
                            }}
                            jobId={jobId}
                            jobNo={jobNo}
                            onAssign={handleAssign}
                        />
                    </ThemeProvider>
                );
            };

            renderDialog(true);
        });
    }
}

const aiAssistantDialogManager = new AiAssistantDialogManager();

export function openAiAssistantDialog(options?: OpenAiAssistantDialogOptions): Promise<void> {
    return aiAssistantDialogManager.open(options);
}

export function summarizeNotesForJob(jobId: number): Promise<AiSummaryResponse> {
    return aiAssistantDialogManager.summarizeNotes(jobId);
}

export function summarizeFullJobForJob(jobId: number): Promise<AiSummaryResponse> {
    return aiAssistantDialogManager.summarizeFullJob(jobId);
}

export function analyzeLateAlertForJob(jobId: number): Promise<AiSummaryResponse> {
    return aiAssistantDialogManager.analyzeLateAlert(jobId);
}

export function suggestCouriersForJob(jobId: number): Promise<AiCourierSuggestionResponse> {
    return aiAssistantDialogManager.suggestCouriers(jobId);
}

export function showCourierSuggestions(
    jobId: number,
    jobNo: string,
    onAssign: (courierId: number) => Promise<void>,
    onRefresh?: () => void
): Promise<void> {
    return aiAssistantDialogManager.showCourierSuggestions(jobId, jobNo, onAssign, onRefresh);
}

// --- Summary Panel ---

const panelRoots = new Map<HTMLElement, Root>();

function renderSummaryPanel(container: HTMLElement, jobId: number): void {
    let root = panelRoots.get(container);
    if (!root) {
        root = createRoot(container);
        panelRoots.set(container, root);
    }

    const currentTheme = getTheme();

    root.render(
        <ThemeProvider theme={currentTheme}>
            <AiSummaryPanel
                title="AI Job Summary"
                fetchSummary={(signal) => summarizeJob(jobId, {signal})}
                autoFetch={true}
            />
        </ThemeProvider>
    );
}

function renderOperationsInsightsPanel(container: HTMLElement): void {
    let root = panelRoots.get(container);
    if (!root) {
        root = createRoot(container);
        panelRoots.set(container, root);
    }

    const currentTheme = getTheme();

    root.render(
        <ThemeProvider theme={currentTheme}>
            <AiSummaryPanel
                title="AI Operations Insights"
                fetchSummary={() => summarizeOperations()}
            />
        </ThemeProvider>
    );
}

function unmountSummaryPanel(container: HTMLElement): void {
    const root = panelRoots.get(container);
    if (root) {
        root.unmount();
        panelRoots.delete(container);
    }
}

// Expose to window for AngularJS access
(window as any).ReactAiAssistant = {
    open: openAiAssistantDialog,
    summarizeNotes: summarizeNotesForJob,
    summarizeJob: summarizeFullJobForJob,
    analyzeLateAlert: analyzeLateAlertForJob,
    suggestCouriers: suggestCouriersForJob,
    showCourierSuggestions,
    renderSummaryPanel,
    renderOperationsInsightsPanel,
    unmountSummaryPanel,
};

// Create AngularJS module
const aiAssistantDialogReactModule = (window as any).angular.module(
    'uDispatch.aiAssistantDialogReact',
    []
);

console.log('[AiAssistantDialogReact] Module registered');

export default aiAssistantDialogReactModule;
