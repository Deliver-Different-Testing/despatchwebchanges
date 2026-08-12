/**
 * Note Management Dialog React Module
 *
 * Entry point for the React-based Note Management Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {NoteManagementDialog} from './NoteManagementDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {notesApi} from '../../../services/notesApi';
import {toastService} from '../../../services/toastService';
import {JobNote, NoteType, CreateNoteRequest, UpdateNoteRequest} from '../../../interfaces';

// State management for the dialog
interface DialogState {
    open: boolean;
    note: JobNote | null;
    resolve?: (saved: boolean) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    note: null,
};

/**
 * Renders the dialog with current state
 */
function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.(false);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSave = () => {
        dialogState.resolve?.(true);
        dialogState.resolve = undefined;
    };

    const handleLoadNoteTypes = async (): Promise<NoteType[]> => {
        return notesApi.getNoteTypes();
    };

    const handleCreateNote = async (request: CreateNoteRequest): Promise<void> => {
        if (request.bulkJobId) {
            await notesApi.createBulkJobNote(request);
        } else {
            await notesApi.createNote(request);
        }
    };

    const handleUpdateNote = async (request: UpdateNoteRequest): Promise<void> => {
        if (dialogState.note?.bulkJobId) {
            return notesApi.updateBulkJobNote(request);
        }
        return notesApi.updateNote(request);
    };

    const handleCreateNoteType = async (noteType: NoteType): Promise<void> => {
        await notesApi.createNoteType(noteType);
    };

    const handleShowToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        toastService.showToast(message, type);
    };

    // Get theme dynamically based on customer region
    dialogRoot.render(islandTree(
        <NoteManagementDialog
            open={dialogState.open}
            note={dialogState.note}
            onClose={handleClose}
            onSave={handleSave}
            onLoadNoteTypes={handleLoadNoteTypes}
            onCreateNote={handleCreateNote}
            onUpdateNote={handleUpdateNote}
            onCreateNoteType={handleCreateNoteType}
            showToast={handleShowToast}
        />
    ));
}

/**
 * Initialize the dialog root (called once)
 */
function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-note-management-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the note management dialog
 *
 * @param note - The note to edit, or null/empty object for a new note
 * @returns Promise that resolves to true if saved, false if canceled
 */
export function openNoteManagementDialog(note: JobNote | null): Promise<boolean> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            note: note ? {...note} : null,
            resolve,
        };
        renderDialog();
    });
}

/**
 * Closes the note management dialog
 */
export function closeNoteManagementDialog(): void {
    if (dialogState.open) {
        dialogState.open = false;
        dialogState.resolve?.(false);
        dialogState.resolve = undefined;
        renderDialog();
    }
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
