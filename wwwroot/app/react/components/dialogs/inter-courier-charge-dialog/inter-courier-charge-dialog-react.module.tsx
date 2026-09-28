/**
 * Inter-Courier Charge Dialog React Module
 *
 * Entry point for the React-based Inter-Courier Charge Dialog.
 * Exposes a function to open the dialog from DispatchPage or AngularJS.
 */

import React from 'react';
import {InterCourierChargeDialog} from './InterCourierChargeDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<void, void>({
    containerId: 'react-inter-courier-charge-dialog-root',
    render: ({open, close, showToast}) => islandTree(
        <InterCourierChargeDialog
            open={open}
            onClose={() => close()}
            showToast={showToast}
        />
    ),
});

/**
 * Opens the inter-courier charge dialog.
 *
 * @param toastService - Toast service for showing notifications (optional)
 * @returns Promise that resolves when the dialog is closed
 */
export function openInterCourierChargeDialog(toastService?: ToastService): Promise<void> {
    return host.open(undefined, toastService);
}
