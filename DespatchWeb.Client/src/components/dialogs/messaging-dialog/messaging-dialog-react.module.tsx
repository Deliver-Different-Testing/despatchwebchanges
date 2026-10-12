import React from 'react';
import { MessagingDialog } from './MessagingDialog';
import { OpenMessagingDialogOptions } from './types';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';
import {getSession} from '../../../api/session';

// Get current staff info from global variables
declare const ContactID: number;
declare const FullName: string;
declare const TimeZone: string;

const currentStaffId = (): number => (typeof ContactID !== 'undefined' ? ContactID : 0);

const host = createDialogHost<void, void>({
    containerId: 'react-messaging-dialog-root',
    render: ({open, close, showToast}) => islandTree(
        <MessagingDialog
            open={open}
            onClose={() => close()}
            showToast={showToast}
            currentStaffId={currentStaffId()}
            currentStaffName={getSession().fullName || 'Unknown'}
            timeZone={getSession().timeZone || 'UTC'}
        />
    ),
});

export function openMessagingDialog(options?: OpenMessagingDialogOptions): Promise<void> {
    if (!currentStaffId()) {
        console.error('[MessagingDialog] Unable to determine current staff member');
        options?.toastService?.showToast("Couldn't open messaging. Refresh and try again.", 'error');
        return Promise.resolve();
    }

    return host.open(undefined, options?.toastService);
}

export const reactMessagingDialog = {
    open: openMessagingDialog,
};
