import {Suggestion, IJobNote} from "../../../interfaces/job.interface";
import "./note-management-dialog.styles.less";
import NoteService from "../../../services/notes.service";
import ToastrService from "../../../services/toastr.service";
import {material} from "angular";

class NoteManagementDialogController {
    noteTypes: Suggestion[] = [];
    title: string = '';
    isNew: boolean = false;
    model: IJobNote;
    isSubmitting: boolean = false;

    static $inject = [
        '$mdDialog',
        'noteService',
        'toastrService',
        'model',
        'staffId'
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private noteService: NoteService,
        private toastrService: ToastrService,
        model: IJobNote,
        private staffId: number
    ) {
        this.model = angular.copy(model || this.createEmptyNote());
        this.isNew = this.model.noteId === 0;
        this.title = this.isNew ? 'Add Note' : 'Edit Note';

        this.loadNoteTypes();
    }

    private createEmptyNote(): IJobNote {
        return {
            noteId: 0,
            noteTypeId: 0,
            noteText: '',
            isImportant: false,
            createdDate: new Date(),
            createdBy: this.staffId
        };
    }

    loadNoteTypes(): void {
        this.noteService.getNoteTypes()
            .then((noteTypes) => {
                this.noteTypes = noteTypes;

                // Set default note type for new notes if none is selected
                if (this.isNew && this.model.noteTypeId === 0 && this.noteTypes.length > 0) {
                    this.model.noteTypeId = this.noteTypes[0].id;
                }
            })
            .catch((error) => {
                console.error('Error loading note types:', error);
                this.toastrService.showErrorToast('Failed to load note types');
            });
    }

    async save(): Promise<void> {
        if (!this.validate()) {
            return;
        }

        try {
            this.isSubmitting = true;

            if (this.isNew) {
                // For new notes, set creation metadata
                this.model.createdDate = new Date();
                this.model.createdBy = this.staffId;

                await this.noteService.createNote(this.staffId, this.model);
                this.toastrService.showSuccessToast('Note created successfully');
                this.$mdDialog.hide();
            } else {
                // For updates, set the update metadata
                this.model.updatedDate = new Date();
                this.model.updatedBy = this.staffId;

                await this.noteService.updateNote(this.staffId, this.model);
                this.toastrService.showSuccessToast('Note updated successfully');
                this.$mdDialog.hide();
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.toastrService.showErrorToast('Failed to save note');
        } finally {
            this.isSubmitting = false;
        }
    }

    validate(): boolean {
        if (!this.model.noteText || this.model.noteText.trim() === '') {
            this.toastrService.showErrorToast('Note text is required');
            return false;
        }

        if (this.model.noteTypeId === 0) {
            this.toastrService.showErrorToast('Please select a note type');
            return false;
        }

        return true;
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
export default NoteManagementDialogController;
