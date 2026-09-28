/**
 * Job File Upload Dialog React Module
 *
 * Entry point for the React-based Job File Upload Dialog.
 * Exposes global functions to open the dialog from AngularJS and other React components.
 */

import React from 'react';

import {JobFileUploadDialog} from './JobFileUploadDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import type {FileUploadType} from './types';
import type {ToastService} from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{jobId: number; initialUploadType: FileUploadType}, void>({
    containerId: 'react-job-file-upload-dialog-root',
    render: ({open: isOpen, payload, close, showToast}) => islandTree(
        <JobFileUploadDialog
            open={isOpen}
            jobId={payload.jobId}
            initialUploadType={payload.initialUploadType}
            onClose={() => close()}
            showToast={showToast}
        />
    ),
});

function normalizeUploadType(uploadType: FileUploadType | string): FileUploadType {
    if (uploadType === 'pod' || uploadType === 'POD') return 'pod';
    if (uploadType === 'both' || uploadType === 'BOTH') return 'both';
    return 'normal';
}

export function open(jobId: number, uploadType: FileUploadType | string = 'normal'): Promise<void> {
    return host.open({jobId, initialUploadType: normalizeUploadType(uploadType)});
}

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

// Expose to window for AngularJS and React access
window.ReactJobFileUploadDialog = {
    open,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const jobFileUploadDialogReactModule = window.angular!.module(
    'uDispatch.jobFileUploadDialogReact',
    []
);

console.log('[JobFileUploadDialogReact] Module registered');

export default jobFileUploadDialogReactModule;
