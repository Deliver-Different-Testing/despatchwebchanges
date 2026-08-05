/**
 * Imperative opener for SplitPricingDialog
 *
 * Creates a detached React root, renders the dialog, and returns a promise that resolves with the
 * user's choice. Cleans up on close.
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {SplitPricingDialog, type SplitPricingResult} from './SplitPricingDialog';
import type {SplitPricingPreview} from '../../../services/splitJobApi';

export function openSplitPricingDialog(
    jobNo: string,
    preview: SplitPricingPreview,
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
            <ReactQueryProvider>
                <ThemeProvider theme={getTheme()}>
                    <CssBaseline/>
                    <SplitPricingDialog open jobNo={jobNo} preview={preview} onClose={handleClose}/>
                </ThemeProvider>
            </ReactQueryProvider>,
        );
    });
}
