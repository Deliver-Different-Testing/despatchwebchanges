/**
 * Note Management Dialog React Module
 *
 * Entry point for the React-based Note Management Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {NoteManagementDialog} from './NoteManagementDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {notesApi} from '../../../services/notesApi';
import {toastService} from '../../../services/toastService';
import {JobNote, CreateNoteRequest, UpdateNoteRequest} from '../../../interfaces';
import {createDialogHost} from '../../../utils/reactDialogHost';

const host = createDialogHost<{note: JobNote | null}, boolean>({
    containerId: 'react-note-management-dialog-root',
    render: ({open, payload, close, settle}) => islandTree(
        <NoteManagementDialog
            open={open}
            note={payload.note}
            onClose={() => close(false)}
            // A save answers the caller but leaves the dialog to close itself.
            onSave={() => settle(true)}
            onLoadNoteTypes={() => notesApi.getNoteTypes()}
            onCreateNote={(request: CreateNoteRequest) =>
                request.bulkJobId ? notesApi.createBulkJobNote(request) : notesApi.createNote(request)}
            onUpdateNote={(request: UpdateNoteRequest) =>
                payload.note?.bulkJobId ? notesApi.updateBulkJobNote(request) : notesApi.updateNote(request)}
            onCreateNoteType={(noteType) => notesApi.createNoteType(noteType).then(() => undefined)}
            showToast={(message, type) => toastService.showToast(message, type)}
        />
    ),
});

/**
 * Opens the note management dialog
 *
 * @param note - The note to edit, or null/empty object for a new note
 * @returns Promise that resolves to true if saved, false if canceled
 */
export function openNoteManagementDialog(note: JobNote | null): Promise<boolean> {
    return host.open({note: note ? {...note} : null});
}

/**
 * Closes the note management dialog
 */
export function closeNoteManagementDialog(): void {
    host.close(false);
}

// Expose globally for AngularJS access
window.ReactNoteManagementDialog = {
    open: openNoteManagementDialog,
    close: closeNoteManagementDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const noteManagementDialogReactModule = window.angular!.module(
    'uDispatch.noteManagementDialogReact',
    []
);

// Register a service that wraps the React dialog
noteManagementDialogReactModule.service('noteManagementDialogReactService', [
    () => ({
        /**
         * Opens the React note management dialog
         * @param note - The note to edit, or null for a new note
         * @returns Promise resolving to true if saved, false if canceled
         */
        openNoteDialog: (note: JobNote | null) => openNoteManagementDialog(note),

        /**
         * Closes the React note management dialog
         */
        closeNoteDialog: () => closeNoteManagementDialog(),
    })
]);

console.log('[NoteManagementDialogReact] Module registered');

export default noteManagementDialogReactModule;
