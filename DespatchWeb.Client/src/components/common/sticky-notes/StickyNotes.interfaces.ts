/**
 * Sticky Notes Interfaces
 *
 * Type definitions for the React StickyNotes component.
 */

export interface StickyNotesProps {
    jobId?: number;
    bulkJobId?: number;
    isRecurringJob?: boolean;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
    showInfoToast?: (message: string) => void;
}
