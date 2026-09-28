import React from 'react';
import {ComposeEmailDialog} from './ComposeEmailDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {DriverEmail, GroupEmailData} from '../../../interfaces';
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

window.ReactComposeEmailDialog = {
    open: openComposeEmailDialog,
};

const composeEmailDialogReactModule = window.angular!.module(
    'uDispatch.composeEmailDialogReact',
    []
);

console.log('[ComposeEmailDialogReact] Module registered');

export default composeEmailDialogReactModule;
