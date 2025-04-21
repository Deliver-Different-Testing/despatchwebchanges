import {IJobNote, INoteType} from "../../../interfaces/job.interface";
import "./note-management-dialog.styles.less";
import NoteService from "../../../services/notes.service";
import ToastrService from "../../../services/toastr.service";

class NoteManagementDialogController {
    noteTypes: INoteType[] = [];
    title: string = '';
    isNew: boolean = false;
    model: IJobNote;
    isSubmitting: boolean = false;

    // New note type creation
    showNoteTypeCreator: boolean = false;
    newNoteType: INoteType = {
        id: 0,
        text: '',
        isPublic: false,
        description: ''
    };
    isCreatingNoteType: boolean = false;

    // For viewing note type descriptions
    showDescriptionFor: number | null = null;

    static $inject = [
        '$mdDialog',
        'noteService',
        'toastrService',
        'model',
        'staffId'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
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

    async loadNoteTypes(): Promise<void> {
        try {
            this.noteTypes = await this.noteService.getNoteTypes();

            if (this.isNew && this.model.noteTypeId === 0 && this.noteTypes.length > 0) {
                this.model.noteTypeId = this.noteTypes[0].id;
            }
        } catch (error) {
            console.error('Error loading note types:', error);
            this.toastrService.showErrorToast('Failed to load note types');
        }
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

                await this.noteService.createNote(this.model);
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

    // New methods for note type creation
    toggleNoteTypeCreator(): void {
        this.showNoteTypeCreator = !this.showNoteTypeCreator;
        if (this.showNoteTypeCreator) {
            this.newNoteType = {
                id: 0,
                text: '',
                isPublic: false,
                description: ''
            };
        }
    }

    validateNewNoteType(): boolean {
        if (!this.newNoteType.text || this.newNoteType.text.trim() === '') {
            this.toastrService.showErrorToast('Note type name is required');
            return false;
        }
        return true;
    }

    async createNoteType(): Promise<void> {
        if (!this.validateNewNoteType()) {
            return;
        }

        try {
            this.isCreatingNoteType = true;
            const newNoteTypeName = this.newNoteType.text;

            // Create the note type
            await this.noteService.createNoteType(this.newNoteType);
            this.toastrService.showSuccessToast('Note type created successfully');

            // Refresh note types from the backend
            await this.loadNoteTypes();

            // Find and select the newly created note type by name
            const createdNoteType = this.noteTypes.find(type => type.text === newNoteTypeName);
            if (createdNoteType) {
                this.model.noteTypeId = createdNoteType.id;
            }

            // Close the note type creator
            this.showNoteTypeCreator = false;
        } catch (error) {
            console.error('Error creating note type:', error);
            this.toastrService.showErrorToast('Failed to create note type');
        } finally {
            this.isCreatingNoteType = false;
        }
    }

    isSelectedNoteTypePublic(): boolean {
        const selectedType = this.noteTypes.find(type => type.id === this.model.noteTypeId);
        return (selectedType && selectedType.hasOwnProperty('isPublic') && selectedType.isPublic) ?? false;
    }

    toggleDescription(noteTypeId: number): void {
        this.showDescriptionFor = this.showDescriptionFor === noteTypeId ? null : noteTypeId;
    }

    getSelectedNoteType(): INoteType | null {
        return this.noteTypes.find(type => type.id === this.model.noteTypeId) || null;
    }
}

export default NoteManagementDialogController;
