/**
 * Dispatch Dialog React Module
 *
 * Entry point that lets AngularJS open the universal DispatchDialog. Nationwide is
 * still an AngularJS page, and its agent-row "Assign Job" button used to open the
 * agent-only confirmation dialog — which led with the inbound-agent email and so
 * read as "send the app email" rather than an assignment.
 *
 * The dialog performs the assignment itself (via the shared executor, same as every
 * React caller) so failures surface inline instead of unwinding into AngularJS. The
 * promise resolves with what was assigned, or null if the operator cancelled.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';

import {DispatchDialog} from './DispatchDialog';
import {executeDispatchConfirmation} from './executeDispatch';
import {isNetworkPartnerSession} from './dispatchSession';
import type {DispatchJobFlags, DispatchType} from './types';
import {getActivePartnerOptions, getPartnerRateForJob, sendToPartner} from '../../../services/jobListApi';
import {islandTree} from '../../../theme/DfrntMantineProvider';

export interface OpenDispatchDialogOptions {
    jobId: number;
    jobNo: string;
    flags?: Partial<DispatchJobFlags>;
    initialType?: DispatchType;
    /** Current courier, so the dialog pre-fills and the executor re-allocates. */
    existingCourier?: {id: number; text: string};
    stopJobCount?: number;
    existingConNote?: string;
}

export interface DispatchDialogOutcome {
    type: DispatchType;
    destinationId: number;
    destinationText: string;
    /** The message the caller should surface; already reflects the email outcome. */
    message: string;
}

interface DialogState extends OpenDispatchDialogOptions {
    open: boolean;
    resolve?: (value: DispatchDialogOutcome | null) => void;
}

class DispatchDialogManager {
    private dialogRoot: Root | null = null;
    private dialogContainer: HTMLDivElement | null = null;
    private dialogState: DialogState = {open: false, jobId: 0, jobNo: ''};

    private initializeDialogRoot(): void {
        if (this.dialogRoot) return;

        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'react-dispatch-dialog-root';
        document.body.appendChild(this.dialogContainer);
        this.dialogRoot = createRoot(this.dialogContainer);
    }

    private settle(outcome: DispatchDialogOutcome | null): void {
        this.dialogState.open = false;
        this.dialogState.resolve?.(outcome);
        this.dialogState.resolve = undefined;
        this.renderDialog();
    }

    private renderDialog(): void {
        if (!this.dialogRoot) return;

        const {jobId, jobNo, flags, initialType, existingCourier, stopJobCount, existingConNote} =
            this.dialogState;

        this.dialogRoot.render(islandTree(
            <DispatchDialog
                open={this.dialogState.open}
                mode={{
                    kind: 'single',
                    jobId,
                    jobNo,
                    flags: {
                        isArchived: Boolean(flags?.isArchived),
                        isBulkJob: Boolean(flags?.isBulkJob),
                        preBook: Boolean(flags?.preBook),
                    },
                }}
                initialType={initialType}
                existingDestination={existingCourier}
                stopJobCount={stopJobCount}
                existingConNote={existingConNote}
                isNetworkPartner={isNetworkPartnerSession()}
                onClose={() => this.settle(null)}
                onDispatchCourier={async (confirmation) => {
                    const {message} = await executeDispatchConfirmation(
                        {id: jobId, jobNo, assignedCourierId: existingCourier?.id},
                        confirmation,
                    );
                    this.settle({
                        type: confirmation.type,
                        destinationId: confirmation.destination.id,
                        destinationText: confirmation.destination.text,
                        message,
                    });
                }}
                onSendToPartner={async (partner, agreedRate) => {
                    const result = await sendToPartner(jobId, partner.id, agreedRate);
                    if (!result.success) {
                        throw new Error(result.message || 'Failed to send job to partner');
                    }
                    this.settle({
                        type: 'DfrntPartner',
                        destinationId: partner.id,
                        destinationText: partner.text,
                        message: `Job ${jobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}`,
                    });
                }}
                fetchRate={getPartnerRateForJob}
                getPartnerOptions={getActivePartnerOptions}
            />
        ));
    }

    open(options: OpenDispatchDialogOptions): Promise<DispatchDialogOutcome | null> {
        this.initializeDialogRoot();

        return new Promise((resolve) => {
            this.dialogState = {...options, open: true, resolve};
            this.renderDialog();
        });
    }
}

const manager = new DispatchDialogManager();

window.ReactDispatchDialog = {
    open: (options: OpenDispatchDialogOptions) => manager.open(options),
};

export default manager;
