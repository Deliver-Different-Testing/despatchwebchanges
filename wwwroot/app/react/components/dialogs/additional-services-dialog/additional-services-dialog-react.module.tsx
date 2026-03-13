/**
 * Additional Services Dialog React Module
 *
 * Entry point for the React-based Additional Services Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AdditionalServicesDialog } from './AdditionalServicesDialog';
import { AdditionalService, AdditionalServicesJob, OpenAdditionalServicesDialogOptions } from './types';
import { getTheme } from '../../../theme/muiTheme';
import { ReactQueryProvider } from '../../../query';
import { additionalServicesApi } from '../../../services/additionalServicesApi';

interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface DialogState {
    open: boolean;
    job: AdditionalServicesJob | null;
    toastService: ToastService | null;
    resolve?: (value: boolean) => void;
}

/**
 * Additional Services Dialog Manager Class
 * Manages the lifecycle and state of the Additional Services Dialog.
 */
class AdditionalServicesDialogManager {
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
        this.dialogContainer.id = 'react-additional-services-dialog-root';
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

        const handleLoadServices = async (): Promise<AdditionalService[]> => {
            const { job } = this.dialogState;
            if (!job) return [];

            const response = await additionalServicesApi.getServices(
                job.clientId,
                job.speedId,
                job.id
            );
            return response.items;
        };

        const handleCalculateTotal = async (selectedServices: AdditionalService[]): Promise<number> => {
            const { job } = this.dialogState;
            if (!job) return 0;

            // Calculate raw total (perItem services multiply by quantity)
            const totalAmount = selectedServices.reduce((sum, service) => {
                const charge = service.perItem ? service.rate * job.items : service.rate;
                return sum + charge;
            }, 0);

            // Get PPD exclusive amount (excludes GST)
            return additionalServicesApi.calculatePpdExclusiveAmount(job.clientId, totalAmount);
        };

        const handleSubmit = async (serviceIds: number[], totalCost: number): Promise<void> => {
            const { job } = this.dialogState;
            if (!job) {
                throw new Error('Job not available');
            }

            await additionalServicesApi.addServicesToJob(job.id, serviceIds, totalCost);

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

        this.dialogRoot.render(
            <ReactQueryProvider>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <AdditionalServicesDialog
                        open={this.dialogState.open}
                        job={this.dialogState.job}
                        onClose={handleClose}
                        onSubmit={handleSubmit}
                        onLoadServices={handleLoadServices}
                        onCalculateTotal={handleCalculateTotal}
                        showToast={handleShowToast}
                    />
                </ThemeProvider>
            </ReactQueryProvider>
        );
    }

    async open(options: OpenAdditionalServicesDialogOptions): Promise<boolean> {
        const { job, toastService } = options;

        // Pre-check: Validate client and speed
        if (!job.clientId || !job.speedId) {
            console.debug('[AdditionalServicesDialog] No client or speed selected');
            return false;
        }

        // Pre-check: Verify services are available
        try {
            const hasServices = await additionalServicesApi.hasClientItemsAvailable(
                job.clientId,
                job.speedId
            );

            if (!hasServices) {
                toastService?.showToast(
                    'No additional services have been set up for this client. Please add a service through Admin Manager and try again.',
                    'warning'
                );
                return false;
            }
        } catch (error: unknown) {
            toastService?.showToast(
                `Error checking available services: ${error instanceof Error ? error.message : String(error)}`,
                'error'
            );
            return false;
        }

        // Proceed to open dialog
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

const additionalServicesDialogManager = new AdditionalServicesDialogManager();

export function openAdditionalServicesDialog(options: OpenAdditionalServicesDialogOptions): Promise<boolean> {
    return additionalServicesDialogManager.open(options);
}

// Expose to window for AngularJS access
(window as any).ReactAdditionalServicesDialog = {
    open: openAdditionalServicesDialog,
};

// Create AngularJS module
const additionalServicesDialogReactModule = (window as any).angular.module(
    'uDispatch.additionalServicesDialogReact',
    []
);

console.log('[AdditionalServicesDialogReact] Module registered');

export default additionalServicesDialogReactModule;
