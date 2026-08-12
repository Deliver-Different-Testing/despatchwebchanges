import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {SendPodDialog, SendPodJobData, SendPodRequest} from './SendPodDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {sendPodReport} from '../../../services/jobDetailApi';
import type {ApiError} from '../../../interfaces';

interface DialogState {
    open: boolean;
    jobData: SendPodJobData;
    sending: boolean;
    sent: boolean;
    error?: string;
    resolve?: (value: boolean) => void;
}

const emptyJobData: SendPodJobData = {
    jobId: 0,
    jobNo: '',
    clientName: '',
    driverName: '',
    deliveryAddress: '',
    deliveryDateTime: '',
};

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    jobData: emptyJobData,
    sending: false,
    sent: false,
};

function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.sending = false;
        dialogState.sent = false;
        dialogState.error = undefined;
        dialogState.resolve?.(false);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSend = async (data: SendPodRequest) => {
        dialogState.sending = true;
        dialogState.error = undefined;
        renderDialog();

        try {
            await sendPodReport(data);

            dialogState.sending = false;
            dialogState.sent = true;
            renderDialog();

            // Auto-close after showing "Sent!" state
            setTimeout(() => {
                dialogState.open = false;
                dialogState.sent = false;
                dialogState.resolve?.(true);
                dialogState.resolve = undefined;
                renderDialog();
            }, 1400);
        } catch (error) {
            console.error('[SendPodDialog] Error sending POD report:', error);
            dialogState.sending = false;
            // Show the server's own reason — a generic "please try again" hides whether the
            // address was rejected, the job was missing, or the queue insert failed.
            dialogState.error = (error as ApiError)?.message
                || 'Failed to send POD report. Please try again.';
            renderDialog();
        }
    };

    dialogRoot.render(islandTree(
        <SendPodDialog
            open={dialogState.open}
            jobData={dialogState.jobData}
            onClose={handleClose}
            onSend={handleSend}
            sending={dialogState.sending}
            sent={dialogState.sent}
            errorMessage={dialogState.error}
        />
    ));
}

function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-send-pod-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

export function openSendPodDialog(
    jobData: SendPodJobData
): Promise<boolean> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            jobData,
            sending: false,
            sent: false,
            resolve,
        };
        renderDialog();
    });
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
