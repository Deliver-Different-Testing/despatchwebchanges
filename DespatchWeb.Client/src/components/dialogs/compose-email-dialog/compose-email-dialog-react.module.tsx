import React from 'react';
import {ComposeEmailDialog} from './ComposeEmailDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {DriverEmail, GroupEmailData} from '../../../types';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{selectedCouriers: DriverEmail[]}, GroupEmailData | null>({
    containerId: 'react-compose-email-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <ComposeEmailDialog
            open={open}
            selectedCouriers={payload.selectedCouriers}
            onClose={() => close(null)}
            onSend={close}
        />
    ),
});

export function openComposeEmailDialog(
    selectedCouriers: DriverEmail[]
): Promise<GroupEmailData | null> {
    return host.open({selectedCouriers});
}

export const reactComposeEmailDialog = {
    open: openComposeEmailDialog,
};
