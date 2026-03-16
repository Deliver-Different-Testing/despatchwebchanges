import {CreateNoteRequest, JobNote, NoteType, UpdateNoteRequest} from "../../../interfaces";
import type {ShowToastFn} from '../../../services/toastService';

export interface NoteManagementDialogProps {
    open: boolean;
    note: JobNote | null;
    onClose: () => void;
    onSave: () => void;
    onLoadNoteTypes: () => Promise<NoteType[]>;
    onCreateNote: (note: CreateNoteRequest) => Promise<void>;
    onUpdateNote: (note: UpdateNoteRequest) => Promise<void>;
    onCreateNoteType: (noteType: NoteType) => Promise<void>;
    showToast: ShowToastFn;
}
