import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {SendPodDialog, SendPodJobData, SendPodRequest} from './SendPodDialog';
import {getTheme} from '../../../theme/muiTheme';

interface DialogState {
    open: boolean;
    jobData: SendPodJobData;
    sending: boolean;
    sent: boolean;
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
        dialogState.resolve?.(false);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSend = async (data: SendPodRequest) => {
        dialogState.sending = true;
        renderDialog();

        try {
            const response = await fetch('/Job/SendPodReport', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`Failed to send: ${response.statusText}`);
            }

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
            renderDialog();
            alert('Failed to send POD report. Please try again.');
        }
    };

    const currentTheme = getTheme();

    dialogRoot.render(
        <ThemeProvider theme={currentTheme}>
            <CssBaseline/>
            <SendPodDialog
                open={dialogState.open}
                jobData={dialogState.jobData}
                onClose={handleClose}
                onSend={handleSend}
                sending={dialogState.sending}
                sent={dialogState.sent}
            />
        </ThemeProvider>
    );
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

(window as any).ReactSendPodDialog = {
    open: openSendPodDialog,
};

const sendPodDialogReactModule = (window as any).angular.module(
    'uDispatch.sendPodDialogReact',
    []
);

console.log('[SendPodDialogReact] Module registered');

export default sendPodDialogReactModule;
