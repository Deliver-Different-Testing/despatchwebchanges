import React from 'react';
import {NoteManagementDialog} from './NoteManagementDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {notesApi} from '../../../api/notesApi';
import {toastService} from '../../../services/toastService';
import {JobNote, CreateNoteRequest, UpdateNoteRequest} from '../../../types';
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

export const reactNoteManagementDialog = {
    open: openNoteManagementDialog,
    close: closeNoteManagementDialog,
};
