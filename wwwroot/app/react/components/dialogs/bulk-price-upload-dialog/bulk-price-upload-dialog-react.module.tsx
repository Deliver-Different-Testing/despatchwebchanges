/**
 * Bulk Price Upload Dialog React Module
 *
 * Entry point for the React-based Bulk Price Upload Dialog.
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

export const reactBulkPriceUploadDialog = {
    open: openBulkPriceUploadDialog,
};
