/**
 * Edit Address Dialog React Module
 *
 * Entry point for the React-based Edit Address Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses React Query for data fetching with automatic caching.
 */

import React from 'react';
import {EditAddressDialog} from './EditAddressDialog';
import {EditAddressDialogViewModel} from '../../../interfaces';
import type {ToastService} from '../../../services/toastService';
import {AddressType} from '../../../../enums/address-type.enum';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import {createDialogHost} from '../../../utils/reactDialogHost';

interface EditAddressPayload {
    addressDetails: EditAddressDialogViewModel | null;
    title: string;
    submitLabel: string;
    showContactInfo: boolean;
    isUsTenant: boolean;
    addressType?: AddressType;
    readOnly: boolean;
}

const host = createDialogHost<EditAddressPayload, EditAddressDialogViewModel | null>({
    containerId: 'react-edit-address-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <MuiThemeIsland>
            <EditAddressDialog
                open={open}
                addressDetails={payload.addressDetails}
                title={payload.title}
                submitLabel={payload.submitLabel}
                showContactInfo={payload.showContactInfo}
                isUsTenant={payload.isUsTenant}
                addressType={payload.addressType}
                readOnly={payload.readOnly}
                onClose={() => close(null)}
                onSave={close}
                showToast={showToast}
            />
        </MuiThemeIsland>
    ),
});

/**
 * Opens the edit address dialog
 *
 * @param addressDetails - The address to edit, or null for new address
 * @param title - Dialog title (default: 'Edit Address')
 * @param submitLabel - Submit button label (default: 'Save')
 * @param showContactInfo - Whether to show shipment details card
 * @param isUsTenant - Whether this is a US tenant (affects address format)
 * @param toastService - Toast service for showing notifications (optional)
 * @param addressType - 'pickup' or 'delivery'; controls the map pin colour
 * @returns Promise that resolves with the updated address, or null if canceled
 */
export function openEditAddressDialog(
    addressDetails: EditAddressDialogViewModel | null,
    title: string = 'Edit Address',
    submitLabel: string = 'Save',
    showContactInfo: boolean = false,
    isUsTenant: boolean = false,
    toastService?: ToastService,
    addressType?: AddressType,
    readOnly: boolean = false,
): Promise<EditAddressDialogViewModel | null> {
    return host.open(
        {addressDetails, title, submitLabel, showContactInfo, isUsTenant, addressType, readOnly},
        toastService,
    );
}

// Expose globally for AngularJS access
window.ReactEditAddressDialog = {
    open: openEditAddressDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const editAddressDialogReactModule = window.angular!.module(
    'uDispatch.editAddressDialogReact',
    []
);

console.log('[EditAddressDialogReact] Module registered');

export default editAddressDialogReactModule;
