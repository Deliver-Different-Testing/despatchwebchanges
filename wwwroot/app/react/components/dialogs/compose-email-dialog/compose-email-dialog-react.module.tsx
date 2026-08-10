import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ComposeEmailDialog} from './ComposeEmailDialog';
import {DfrntMantineProvider} from '../../../theme/DfrntMantineProvider';
import {DriverEmail, GroupEmailData} from '../../../interfaces';

interface DialogState {
    open: boolean;
    selectedCouriers: DriverEmail[];
    resolve?: (value: GroupEmailData | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    selectedCouriers: [],
};

function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.(null);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSend = (data: GroupEmailData) => {
        dialogState.open = false;
        dialogState.resolve?.(data);
        dialogState.resolve = undefined;
        renderDialog();
    };

    dialogRoot.render(
        <DfrntMantineProvider>
            <ComposeEmailDialog
                open={dialogState.open}
                selectedCouriers={dialogState.selectedCouriers}
                onClose={handleClose}
                onSend={handleSend}
            />
        </DfrntMantineProvider>
    );
}

function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-compose-email-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

export function openComposeEmailDialog(
    selectedCouriers: DriverEmail[]
): Promise<GroupEmailData | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            selectedCouriers,
            resolve,
        };
        renderDialog();
    });
}

window.ReactComposeEmailDialog = {
    open: openComposeEmailDialog,
};

const composeEmailDialogReactModule = window.angular!.module(
    'uDispatch.composeEmailDialogReact',
    []
);

console.log('[ComposeEmailDialogReact] Module registered');

export default composeEmailDialogReactModule;
