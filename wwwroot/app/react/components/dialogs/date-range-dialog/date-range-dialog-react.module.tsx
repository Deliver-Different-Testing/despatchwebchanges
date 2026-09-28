/**
 * Date Range Dialog React Module
 *
 * Entry point for the React-based Date Range Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {DateRangeDialog, DateRange} from './DateRangeDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

type InitialRange = { start?: Date; end?: Date } | undefined;

const host = createDialogHost<{initialRange: InitialRange}, DateRange | null>({
    containerId: 'react-date-range-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <DateRangeDialog
            open={open}
            initialRange={payload.initialRange}
            onClose={() => close(null)}
            onApply={close}
        />
    ),
});

/**
 * Opens the date range dialog
 *
 * @param initialRange - Optional initial date range
 * @returns Promise that resolves with the selected range, or null if cancelled
 */
export function openDateRangeDialog(initialRange?: InitialRange): Promise<DateRange | null> {
    return host.open({initialRange});
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
