import NoteService from "../../../services/notes.service";
import NoteManagementDialogService from "../../dialogs/note-management-dialog/note-management.dialog.service";
import ToastrService from "../../../services/toastr.service";
import {TucNoteViewModel} from "../../../interfaces/job.interface";
import "./sticky-notes.styles.less";
import BaseController from "../../base-controller";
import {IComponentOptions, IOnChangesObject, material} from "angular";

class StickyNoteController extends BaseController {
    private previousJobId?: number;

    notes?: TucNoteViewModel[] = [];
    jobId?: number;
    loading: boolean = false;

    static $inject = [
        'noteService',
        'noteManagementDialogService',
        'toastrService',
        '$mdDialog'
    ];

    constructor(
        private noteService: NoteService,
        private noteManagementDialogService: NoteManagementDialogService,
        private toastrService: ToastrService,
        private $mdDialog: material.IDialogService
    ) {
        super();
    }

    $onInit() {
        if (this.jobId) {
            this.loadNotes();
        }
    }

    $onChanges(changes: IOnChangesObject) {
        console.log('StickyNoteController - $onChanges called with changes:', JSON.stringify(changes));

        // Check if jobId is present and is a valid change
        if (changes['jobId']) {
            const currentValue = changes['jobId'].currentValue;

            // Make sure we have a valid number for jobId
            if (currentValue && typeof currentValue === 'number') {
                console.log('StickyNoteController - Valid jobId detected:', currentValue);

                // Only reload if the ID actually changed
                if (this.previousJobId !== currentValue) {
                    this.previousJobId = currentValue;
                    this.loadNotes();
                }
            } else {
                console.log('StickyNoteController - No valid jobId change detected', {
                    currentValue,
                    type: typeof currentValue
                });
            }
        }
    }

    loadNotes() {
        if (!this.jobId) return;

        this.loading = true;
        this.noteService.getJobNotes(this.jobId)
            .then(notes => {
                this.notes = notes;
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                this.toastrService.showErrorToast('Failed to load notes');
            })
            .finally(() => {
                this.loading = false;
            });
    }

    async addNote($event: MouseEvent) {
        const emptyNote: TucNoteViewModel = {
            noteId: 0,
            noteTypeId: 0,
            noteText: '',
            isImportant: false,
            jobId: this.jobId,
            createdDate: new Date(),
            createdBy: ContactID
        };

        try {
            await this.noteManagementDialogService.openNoteDialog($event, emptyNote, ContactID);
            this.loadNotes();
            this.toastrService.showSuccessToast('Note added successfully');
        } catch (error) {
            if(!error) return;
          console.error("An error occured!")
        }
    }

    async editNote($event: MouseEvent, note: TucNoteViewModel) {
        try {
            await this.noteManagementDialogService.openNoteDialog($event, note, ContactID);
            this.loadNotes();
            this.toastrService.showSuccessToast('Note updated successfully');
        } catch (error) {
            // Dialog was likely canceled
            console.log('Note dialog was canceled or had an error');
        }
    }

    async deleteNote($event: MouseEvent, note: TucNoteViewModel) {
        // Prevent event propagation to avoid triggering edit
        $event.stopPropagation();

        try {
            // Show confirmation dialog
            const confirmed = await this.$mdDialog.show(
                this.$mdDialog.confirm()
                    .title('Delete Note')
                    .textContent('Are you sure you want to delete this note?')
                    .ariaLabel('Delete Note')
                    .targetEvent($event)
                    .ok('Delete')
                    .cancel('Cancel')
            );

            if (confirmed) {
                await this.noteService.deleteNote(note.noteId ?? 0);
                this.loadNotes();
                this.toastrService.showSuccessToast('Note deleted successfully');
            }
        } catch (error) {
            if(!error) return;

            console.error('Error deleting note:', error);
            this.toastrService.showErrorToast('Failed to delete note');
        }
    }

    // Helper method to format dates in a user-friendly way
    formatDate(date: Date | string): string {
        if (!date) return '';

        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        const diffMs = now.getTime() - dateObj.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } else if (diffDays === 1) {
            return 'Yesterday ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } else if (diffDays < 7) {
            return diffDays + ' days ago';
        } else {
            return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
}

const StickyNoteComponent: IComponentOptions = {
    template: require('./sticky-notes.template.html'),
    controller: StickyNoteController,
    controllerAs: 'ctrl',
    bindings: {
        jobId: '<'
    }
};

export default StickyNoteComponent;
