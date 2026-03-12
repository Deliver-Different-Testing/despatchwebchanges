/**
 * Simple Price Edit Dialog React Module
 *
 * Entry point for the React-based Simple Price Edit Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';

import { SimplePriceEditDialog } from './SimplePriceEditDialog';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { PriceEditResult, PricingMode, SimplePriceEditDialogOptions } from './types';

interface DialogState {
    open: boolean;
    jobId: number;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
    resolve?: (result: PriceEditResult | null) => void;
}

interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

const defaultToastService: ToastService = {
    showToast: (message: string, type: string) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
    },
};

// --- API helpers ---

async function applyRecalculatedJobRate(jobId: number, isPrebook: boolean): Promise<void> {
    const params = new URLSearchParams({ jobId: String(jobId), isPrebook: String(isPrebook) });
    const response = await fetch(`job/ApplyRecalculatedJobRate?${params}`, { method: 'POST' });
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Failed to apply recalculated rate');
    }
}

async function recalculateJobRate(jobId: number, isPrebook: boolean): Promise<number> {
    const params = new URLSearchParams({ jobId: String(jobId), isBooking: String(isPrebook) });
    const response = await fetch(`job/RecalculateJobRate?${params}`);
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Failed to recalculate rate');
    }
    return response.json();
}

async function repriceJobWithBaseAmount(jobId: number, isPrebook: boolean, baseAmount: number): Promise<number> {
    const response = await fetch('job/RepriceJobWithBaseAmount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, isPrebook, baseAmount }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Failed to reprice with base amount');
    }
    return response.json();
}

async function simpleRepriceJobManual(jobId: number, isPrebook: boolean, isBulk: boolean, newPrice: number): Promise<void> {
    const response = await fetch('job/SimpleRepriceJobManual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, isPrebook, isBulk, newPrice }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Failed to reprice job');
    }
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

        const handleSubmit = async (mode: PricingMode, amount: number): Promise<number> => {
            const { jobId, isPrebook } = this.dialogState;
            let savedAmount = 0;

            if (mode === 'recalculate') {
                await applyRecalculatedJobRate(jobId, isPrebook);
                savedAmount = await recalculateJobRate(jobId, isPrebook);
            } else if (mode === 'base') {
                savedAmount = await repriceJobWithBaseAmount(jobId, isPrebook, amount);
            } else if (mode === 'gross') {
                await simpleRepriceJobManual(jobId, isPrebook, false, amount);
                savedAmount = amount;
            }

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
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        showToast={this.toastService.showToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    open(options: SimplePriceEditDialogOptions): Promise<PriceEditResult | null> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {
                open: true,
                jobId: options.jobId,
                jobNumber: options.jobNumber,
                currentCharge: options.currentCharge,
                isPrebook: options.isPrebook,
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
(window as any).ReactSimplePriceEditDialog = {
    open: openSimplePriceEditDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const simplePriceEditDialogReactModule = (window as any).angular.module(
    'uDispatch.simplePriceEditDialogReact',
    []
);

console.log('[SimplePriceEditDialogReact] Module registered');

export default simplePriceEditDialogReactModule;
