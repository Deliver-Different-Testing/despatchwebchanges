/**
 * Imperative opener for SplitJobCourierDialog
 *
 * Creates a detached React root, renders the dialog, and returns a promise
 * that resolves with the user's choice. Cleans up on close.
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {SplitJobCourierDialog, SplitJobCourierResult} from './SplitJobCourierDialog';

export function openSplitJobCourierDialog(): Promise<SplitJobCourierResult> {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        function handleClose(result: SplitJobCourierResult) {
            root.unmount();
            container.remove();
            resolve(result);
        }

        root.render(
            <ReactQueryProvider>
                <ThemeProvider theme={getTheme()}>
                    <CssBaseline/>
                    <SplitJobCourierDialog open onClose={handleClose}/>
                </ThemeProvider>
            </ReactQueryProvider>,
        );
    });
}
