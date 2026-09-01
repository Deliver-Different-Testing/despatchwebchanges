/**
 * Bulk Price Upload Dialog React Module
 *
 * Entry point for the React-based Bulk Price Upload Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 * Uses native React API services instead of AngularJS dependencies.
 */

import React from 'react';
import { BulkPriceUploadDialog } from './BulkPriceUploadDialog';
import { OpenBulkPriceUploadDialogOptions, PricingMode } from './types';
import { bulkPriceApi } from '../../../services/bulkPriceApi';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<void, boolean>({
    containerId: 'react-bulk-price-upload-dialog-root',
    render: ({open, close, showToast}) => islandTree(
        <BulkPriceUploadDialog
            open={open}
            onClose={() => close(false)}
            onSubmit={(file: File, mode: PricingMode) => bulkPriceApi.applyBulkPriceUpdate(file, mode)}
            showToast={showToast}
        />
    ),
});

export function openBulkPriceUploadDialog(options: OpenBulkPriceUploadDialogOptions): Promise<boolean> {
    return host.open(undefined, options.toastService);
}

// Expose to window for AngularJS access
window.ReactBulkPriceUploadDialog = {
    open: openBulkPriceUploadDialog,
};

// Create AngularJS module
const bulkPriceUploadDialogReactModule = window.angular!.module(
    'uDispatch.bulkPriceUploadDialogReact',
    []
);

console.log('[BulkPriceUploadDialogReact] Module registered');

export default bulkPriceUploadDialogReactModule;
