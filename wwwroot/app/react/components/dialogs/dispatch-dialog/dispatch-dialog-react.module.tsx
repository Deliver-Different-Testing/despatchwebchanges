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

import {DispatchDialog} from './DispatchDialog';
import {executeDispatchConfirmation} from './executeDispatch';
import {isNetworkPartnerSession} from './dispatchSession';
import type {DispatchJobFlags, DispatchType} from './types';
import {getActivePartnerOptions, getPartnerRateForJob, sendToPartner} from '../../../services/jobListApi';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

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

const host = createDialogHost<OpenDispatchDialogOptions, DispatchDialogOutcome | null>({
    containerId: 'react-dispatch-dialog-root',
    render: ({open, payload, close}) => {
        const {jobId, jobNo, flags, initialType, existingCourier, stopJobCount, existingConNote} = payload;

        return islandTree(
            <DispatchDialog
                open={open}
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
                onClose={() => close(null)}
                onDispatchCourier={async (confirmation) => {
                    const {message} = await executeDispatchConfirmation(
                        {id: jobId, jobNo, assignedCourierId: existingCourier?.id},
                        confirmation,
                    );
                    close({
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
                    close({
                        type: 'DfrntPartner',
                        destinationId: partner.id,
                        destinationText: partner.text,
                        message: `Job ${jobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}`,
                    });
                }}
                fetchRate={getPartnerRateForJob}
                getPartnerOptions={getActivePartnerOptions}
            />
        );
    },
});

window.ReactDispatchDialog = {
    open: (options: OpenDispatchDialogOptions) => host.open(options),
};

export default host;
