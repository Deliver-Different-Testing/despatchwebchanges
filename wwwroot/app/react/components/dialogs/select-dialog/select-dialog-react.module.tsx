/**
 * Select Dialog React Module
 *
 * Entry point for the React-based Select Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';

import { SelectDialog } from './SelectDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import { SelectDialogResult, SelectDialogOptions } from './types';
import type { ToastService } from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

/** Warning message displayed when changing a job's Status field */
const STATUS_WARNING_MESSAGE =
    'Warning: You are about to change the status of a job. Different statuses trigger different notifications and automated workflows. ' +
    'While this change can be reversed, it may impact multiple systems and stakeholders. Please ensure you\'re selecting the correct status.';

const host = createDialogHost<SelectDialogOptions, SelectDialogResult | null>({
    containerId: 'react-select-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <SelectDialog
            open={open}
            title={payload.title}
            fieldName={payload.fieldName}
            items={payload.items}
            initialValue={payload.initialValue}
            warningMessage={payload.fieldName === 'Status' ? STATUS_WARNING_MESSAGE : undefined}
            showCheckbox={payload.showCheckbox ?? false}
            checkboxLabel={payload.checkboxLabel ?? ''}
            onClose={() => close(null)}
            onSubmit={close}
            showToast={showToast}
        />
    ),
});

export function showSelectDialog(options: SelectDialogOptions): Promise<SelectDialogResult | null> {
    return host.open(options);
}

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactSelectDialog = {
    showSelectDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const selectDialogReactModule = window.angular!.module(
    'uDispatch.selectDialogReact',
    []
);

console.log('[SelectDialogReact] Module registered');

export default selectDialogReactModule;
