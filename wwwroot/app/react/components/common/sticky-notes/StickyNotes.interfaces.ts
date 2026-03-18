/**
 * Sticky Notes Interfaces
 *
 * Type definitions for the React StickyNotes component.
 */

import {JobNote} from '../../../interfaces';

export interface NoteManagementDialogServiceInterface {
    openNoteDialog(event: MouseEvent, model: JobNote | null): Promise<void>;
}

export interface StickyNotesProps {
    jobId?: number;
    bulkJobId?: number;
    isRecurringJob?: boolean;
    noteManagementDialogService: NoteManagementDialogServiceInterface;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
    showInfoToast?: (message: string) => void;
}
