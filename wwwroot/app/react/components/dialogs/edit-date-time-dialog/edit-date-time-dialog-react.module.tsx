/**
 * Edit Date Time Dialog React Module
 *
 * Entry point for the React-based Edit Date Time Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';

import { EditDateTimeDialog } from './EditDateTimeDialog';
import { EditDateTimeDialogResult, EditDateTimeDialogOptions } from './types';
import type { ToastService } from '../../../services/toastService';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

/**
 * Get the US customer flag from server config
 */
function getIsUSCustomer(): boolean {
    return window.serverConfig?.isUSCustomer ?? false;
}

type EditDateTimePayload = Required<Pick<EditDateTimeDialogOptions, 'title' | 'fieldName'>>
    & Pick<EditDateTimeDialogOptions, 'dateTime' | 'defaultTimeZone'>
    & {showDate: boolean; showTime: boolean; isUSCustomer: boolean; readOnly: boolean; allowClear: boolean};

const host = createDialogHost<EditDateTimePayload, EditDateTimeDialogResult | null>({
    containerId: 'react-edit-date-time-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <EditDateTimeDialog
            open={open}
            title={payload.title}
            fieldName={payload.fieldName}
            dateTime={payload.dateTime}
            defaultTimeZone={payload.defaultTimeZone}
            showDate={payload.showDate}
            showTime={payload.showTime}
            isUSCustomer={payload.isUSCustomer}
            readOnly={payload.readOnly}
            allowClear={payload.allowClear}
            onClose={() => close(null)}
            onSubmit={close}
            showToast={showToast}
        />
    ),
});

function openDialog(
    options: EditDateTimeDialogOptions,
    showDate: boolean,
    showTime: boolean,
): Promise<EditDateTimeDialogResult | null> {
    return host.open({
        title: options.title,
        fieldName: options.fieldName,
        dateTime: options.dateTime,
        defaultTimeZone: options.defaultTimeZone,
        showDate,
        showTime,
        isUSCustomer: options.isUSCustomer ?? getIsUSCustomer(),
        readOnly: options.readOnly ?? false,
        allowClear: options.allowClear ?? false,
    });
}

/** Show edit time dialog (time only) */
export function showEditTimeDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
    return openDialog(options, false, true);
}

/** Show edit date dialog (date only) */
export function showEditDateDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
    return openDialog(options, true, false);
}

/** Show edit date and time dialog */
export function showEditDateAndTimeDialog(options: EditDateTimeDialogOptions): Promise<EditDateTimeDialogResult | null> {
    return openDialog(options, true, true);
}

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactEditDateTimeDialog = {
    showEditTimeDialog,
    showEditDateDialog,
    showEditDateAndTimeDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const editDateTimeDialogReactModule = window.angular!.module(
    'uDispatch.editDateTimeDialogReact',
    []
);

console.log('[EditDateTimeDialogReact] Module registered');

export default editDateTimeDialogReactModule;
