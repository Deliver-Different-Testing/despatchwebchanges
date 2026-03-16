import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {ComposeEmailDialog} from './ComposeEmailDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
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

    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <ComposeEmailDialog
                    open={dialogState.open}
                    selectedCouriers={dialogState.selectedCouriers}
                    onClose={handleClose}
                    onSend={handleSend}
                />
            </ThemeProvider>
        </ReactQueryProvider>
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

(window as any).ReactComposeEmailDialog = {
    open: openComposeEmailDialog,
};

const composeEmailDialogReactModule = (window as any).angular.module(
    'uDispatch.composeEmailDialogReact',
    []
);

console.log('[ComposeEmailDialogReact] Module registered');

export default composeEmailDialogReactModule;
