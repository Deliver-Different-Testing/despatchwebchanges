import {CreateNoteRequest, JobNote, NoteType, UpdateNoteRequest} from "../../../interfaces";

export interface NoteManagementDialogProps {
    open: boolean;
    note: JobNote | null;
    onClose: () => void;
    onSave: () => void;
    onLoadNoteTypes: () => Promise<NoteType[]>;
    onCreateNote: (note: CreateNoteRequest) => Promise<void>;
    onUpdateNote: (note: UpdateNoteRequest) => Promise<void>;
    onCreateNoteType: (noteType: NoteType) => Promise<void>;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}
