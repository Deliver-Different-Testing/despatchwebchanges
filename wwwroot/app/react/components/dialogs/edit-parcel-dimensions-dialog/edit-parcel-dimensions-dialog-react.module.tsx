/**
 * Edit Parcel Dimensions Dialog React Module
 *
 * Entry point for the React-based Edit Parcel Dimensions Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';

import { EditParcelDimensionsDialog } from './EditParcelDimensionsDialog';
import {
    EditParcelDimensionsDialogOptions,
    EditParcelDimensionsDialogResult,
} from './types';
import type { ToastService } from '../../../services/toastService';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<EditParcelDimensionsDialogOptions, EditParcelDimensionsDialogResult | null>({
    containerId: 'react-edit-parcel-dimensions-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <MuiThemeIsland>
            <EditParcelDimensionsDialog
                open={open}
                parcels={payload.parcels}
                jobId={payload.jobId}
                bulkJobId={payload.bulkJobId}
                jobNumber={payload.jobNumber}
                isUsCustomer={payload.isUsCustomer}
                jobWeight={payload.jobWeight}
                calculateDimsOncePerJob={payload.calculateDimsOncePerJob}
                partnerMode={payload.partnerMode}
                readOnly={payload.readOnly ?? false}
                onClose={() => close(null)}
                onSubmit={close}
                showToast={showToast}
            />
        </MuiThemeIsland>
    ),
});

export function showEditParcelDimensionsDialog(
    options: EditParcelDimensionsDialogOptions
): Promise<EditParcelDimensionsDialogResult | null> {
    return host.open(options);
}

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactEditParcelDimensionsDialog = {
    showEditParcelDimensionsDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const editParcelDimensionsDialogReactModule = window.angular!.module(
    'uDispatch.editParcelDimensionsDialogReact',
    []
);

console.log('[EditParcelDimensionsDialogReact] Module registered');

export default editParcelDimensionsDialogReactModule;
