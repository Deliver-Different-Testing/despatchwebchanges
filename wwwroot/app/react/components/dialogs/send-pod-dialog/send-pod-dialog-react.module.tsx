import React from 'react';
import {SendPodDialog, SendPodJobData, SendPodRequest} from './SendPodDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {sendPodReport} from '../../../services/jobDetailApi';
import type {ApiError} from '../../../interfaces';
import {createDialogHost} from '../../../utils/reactDialogHost';

interface SendPodState {
    jobData: SendPodJobData;
    sending: boolean;
    sent: boolean;
    error?: string;
}

async function send(data: SendPodRequest): Promise<void> {
    host.update(state => ({...state, sending: true, error: undefined}));

    try {
        await sendPodReport(data);
        host.update(state => ({...state, sending: false, sent: true}));

        // Auto-close after showing the "Sent!" state
        setTimeout(() => {
            host.update(state => ({...state, sent: false}));
            host.close(true);
        }, 1400);
    } catch (error) {
        console.error('[SendPodDialog] Error sending POD report:', error);
        // Show the server's own reason — a generic "please try again" hides whether the
        // address was rejected, the job was missing, or the queue insert failed.
        host.update(state => ({
            ...state,
            sending: false,
            error: (error as ApiError)?.message || 'Failed to send POD report. Please try again.',
        }));
    }
}

function dismiss(): void {
    host.update(state => ({...state, sending: false, sent: false, error: undefined}));
    host.close(false);
}

const host = createDialogHost<SendPodState, boolean>({
    containerId: 'react-send-pod-dialog-root',
    render: ({open, payload}) => islandTree(
        <SendPodDialog
            open={open}
            jobData={payload.jobData}
            onClose={dismiss}
            onSend={send}
            sending={payload.sending}
            sent={payload.sent}
            errorMessage={payload.error}
        />
    ),
});

export function openSendPodDialog(jobData: SendPodJobData): Promise<boolean> {
    return host.open({jobData, sending: false, sent: false});
}

window.ReactSendPodDialog = {
    open: openSendPodDialog,
};

const sendPodDialogReactModule = window.angular!.module(
    'uDispatch.sendPodDialogReact',
    []
);

console.log('[SendPodDialogReact] Module registered');

export default sendPodDialogReactModule;
