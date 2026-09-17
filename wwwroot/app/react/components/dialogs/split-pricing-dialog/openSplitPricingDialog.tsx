/**
 * Imperative opener for SplitPricingDialog
 *
 * Creates a detached React root, renders the dialog, and returns a promise that resolves with the
 * user's choice. Cleans up on close.
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {DfrntMantineProvider} from '../../../theme/DfrntMantineProvider';
import {SplitPricingDialog, type SplitPricingResult} from './SplitPricingDialog';
import {SplitPricingPreview} from "../../../interfaces/splitJobs";

export function openSplitPricingDialog(
    jobNo: string,
    preview: SplitPricingPreview,
    legCourierNames?: (string | null)[],
): Promise<SplitPricingResult> {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        function handleClose(result: SplitPricingResult) {
            root.unmount();
            container.remove();
            resolve(result);
        }

        root.render(
            <DfrntMantineProvider>
                <SplitPricingDialog
                    open
                    jobNo={jobNo}
                    preview={preview}
                    legCourierNames={legCourierNames}
                    onClose={handleClose}
                />
            </DfrntMantineProvider>,
        );
    });
}
