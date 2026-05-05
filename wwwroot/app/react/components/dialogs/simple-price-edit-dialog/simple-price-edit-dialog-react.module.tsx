/**
 * Simple Price Edit Dialog React Module
 *
 * Entry point for the React-based Simple Price Edit Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { SimplePriceEditDialog } from './SimplePriceEditDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { PriceEditResult, PricingMode, SimplePriceEditDialogOptions, ChildJobPrice, ChildPriceUpdate } from './types';
import type { IJobGroupDto } from '../../../../interfaces/job.interface';
import { apiClient } from '../../../services/apiClient';
import type { ShowToastFn, ToastService } from '../../../services/toastService';

interface DialogState {
    open: boolean;
    jobId: number;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
    hideRecalculate?: boolean;
    childJobs?: ChildJobPrice[];
    resolve?: (result: PriceEditResult | null) => void;
}

const defaultToastService: ToastService = {
    showToast: (message: string, type: string) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

// --- API helpers ---

async function applyRecalculatedJobRate(jobId: number, isPrebook: boolean): Promise<number> {
    const result = await apiClient.post<{ rate: number }>('job/ApplyRecalculatedJobRate', null, {
        params: { jobId, isPrebook },
    });
    return result.rate;
}


async function getJobGroup(jobId: number): Promise<IJobGroupDto> {
    return apiClient.get<IJobGroupDto>('job/Detail', { jobId });
}

async function repriceJobWithBaseAmount(jobId: number, isPrebook: boolean, baseAmount: number): Promise<number> {
    return apiClient.post<number>('job/RepriceJobWithBaseAmount', { jobId, isPrebook, baseAmount });
}

async function simpleRepriceJobManual(jobId: number, isPrebook: boolean, isBulk: boolean, newPrice: number): Promise<void> {
    await apiClient.post('job/SimpleRepriceJobManual', { jobId, isPrebook, isBulk, newPrice });
}

/**
 * Simple Price Edit Dialog Manager
 * Manages the lifecycle and state of the dialog.
 */
class SimplePriceEditDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private toastService: ToastService = defaultToastService;
    private dialogState: DialogState = {
        open: false,
        jobId: 0,
        jobNumber: '',
        currentCharge: 0,
        isPrebook: false,
    };

    setToastService(service: ToastService): void {
        this.toastService = service;
    }

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-simple-price-edit-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const handleClose = () => {
            this.dialogState.open = false;
            this.dialogState.resolve?.(null);
            this.dialogState.resolve = undefined;
            this.renderDialog();
        };

        const handleSubmit = async (mode: PricingMode, amount: number, childUpdates: ChildPriceUpdate[]): Promise<number> => {
            const { jobId, isPrebook } = this.dialogState;
            let savedAmount = 0;

            if (mode === 'recalculate') {
                savedAmount = await applyRecalculatedJobRate(jobId, isPrebook);
            } else if (mode === 'base') {
                savedAmount = await repriceJobWithBaseAmount(jobId, isPrebook, amount);
            } else if (mode === 'gross') {
                await simpleRepriceJobManual(jobId, isPrebook, false, amount);
                savedAmount = amount;
            }

            // Save any changed child job prices
            await Promise.all(
                childUpdates.map(c => simpleRepriceJobManual(c.jobId, c.isPrebook, c.isBulkJob, c.newPrice))
            );

            // Store the result for when the user clicks Done
            this.dialogState.resolve = ((prevResolve) => {
                return (_: PriceEditResult | null) => {
                    prevResolve?.({ mode, amount: savedAmount });
                };
            })(this.dialogState.resolve);

            return savedAmount;
        };

        const currentTheme = getTheme();

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <SimplePriceEditDialog
                        open={this.dialogState.open}
                        jobNumber={this.dialogState.jobNumber}
                        currentCharge={this.dialogState.currentCharge}
                        isPrebook={this.dialogState.isPrebook}
                        hideRecalculate={this.dialogState.hideRecalculate}
                        childJobs={this.dialogState.childJobs}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        showToast={this.toastService.showToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    async open(options: SimplePriceEditDialogOptions): Promise<PriceEditResult | null> {
        this.initializeDialogRoot();

        // Fetch child jobs before showing — non-fatal if unavailable
        let childJobs: ChildJobPrice[] = [];
        try {
            const group = await getJobGroup(options.jobId);
            childJobs = group.relatedJobs
                .filter(j => j.rootParentId !== undefined && j.rootParentId === options.jobId)
                .map(j => ({
                    jobId: j.id,
                    jobNumber: j.jobNo,
                    charge: j.charge,
                    isPrebook: j.preBook,
                    isBulkJob: j.isBulkJob,
                }));
        } catch {
            // Non-fatal — proceed without child jobs
        }

        return new Promise<PriceEditResult | null>((resolve) => {
            this.dialogState = {
                open: true,
                jobId: options.jobId,
                jobNumber: options.jobNumber,
                currentCharge: options.currentCharge,
                isPrebook: options.isPrebook,
                hideRecalculate: options.hideRecalculate,
                childJobs,
                resolve,
            };
            this.renderDialog();
        });
    }
}

const dialogManager = new SimplePriceEditDialogManager();

export function openSimplePriceEditDialog(options: SimplePriceEditDialogOptions): Promise<PriceEditResult | null> {
    return dialogManager.open(options);
}

export function setToastService(service: ToastService): void {
    dialogManager.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactSimplePriceEditDialog = {
    open: openSimplePriceEditDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const simplePriceEditDialogReactModule = window.angular!.module(
    'uDispatch.simplePriceEditDialogReact',
    []
);

console.log('[SimplePriceEditDialogReact] Module registered');

export default simplePriceEditDialogReactModule;
