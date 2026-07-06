/**
 * Date Range Dialog React Module
 *
 * Entry point for the React-based Date Range Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {DateRangeDialog, DateRange} from './DateRangeDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';

// State management for the dialog
interface DialogState {
    open: boolean;
    initialRange?: { start?: Date; end?: Date };
    resolve?: (value: DateRange | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = { open: false };

/**
 * Renders the dialog with current state
 */
function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.(null);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleApply = (range: DateRange) => {
        dialogState.open = false;
        dialogState.resolve?.(range);
        dialogState.resolve = undefined;
        renderDialog();
    };

    // Get theme dynamically based on customer region (US = blue, non-US = yellow)
    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <DateRangeDialog
                    open={dialogState.open}
                    initialRange={dialogState.initialRange}
                    onClose={handleClose}
                    onApply={handleApply}
                />
            </ThemeProvider>
        </ReactQueryProvider>
    );
}

/**
 * Initialize the dialog root (called once)
 */
function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-date-range-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the date range dialog
 *
 * @param initialRange - Optional initial date range
 * @returns Promise that resolves with the selected range, or null if cancelled
 */
export function openDateRangeDialog(
    initialRange?: { start?: Date; end?: Date }
): Promise<DateRange | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            initialRange,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactDateRangeDialog = {
    open: openDateRangeDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const dateRangeDialogReactModule = window.angular!.module(
    'uDispatch.dateRangeDialogReact',
    []
);

console.log('[DateRangeDialogReact] Module registered');

export default dateRangeDialogReactModule;
