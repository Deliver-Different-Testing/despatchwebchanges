import NoteService from "../../../services/notes.service";
import NoteManagementDialogService from "../../dialogs/note-management-dialog/note-management.dialog.service";
import ToastrService from "../../../services/toastr.service";
import {IJobNote} from "../../../interfaces/job.interface";
import "./sticky-notes.styles.less";
import BaseController from "../../base-controller";
import moment from "moment";

class StickyNoteController extends BaseController {
    private previousJobId?: number;
    private readonly isRecurringJob: boolean = false;

    notes?: IJobNote[] = [];
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
        private $mdDialog: angular.material.IDialogService
    ) {
        super();
    }

    $onInit() {
        if (this.jobId) {
            this.loadNotes();
        }
    }

    $onChanges(changes: angular.IOnChangesObject) {
        console.log('StickyNoteController - $onChanges called with changes:', JSON.stringify(changes));

        if (changes['jobId']) {
            const currentValue = changes['jobId'].currentValue;

            if (currentValue && typeof currentValue === 'number') {
                console.log('StickyNoteController - Valid jobId detected:', currentValue);

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
        this.noteService.getJobNotes(this.jobId, this.isRecurringJob)
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
        const emptyNote: IJobNote = {
            noteId: 0,
            noteTypeId: 0,
            noteText: '',
            isImportant: false,
            jobId: !this.isRecurringJob ? this.jobId : undefined,
            jobBookingId: this.isRecurringJob ? this.jobId : undefined,
            createdDate: new Date(),
            createdBy: ContactID
        };

        try {
            await this.noteManagementDialogService.openNoteDialog($event, emptyNote, ContactID);
            this.loadNotes();
            this.toastrService.showSuccessToast('Note added successfully');
        } catch (error) {
            if (!error) return;
            console.error("An error occured!")
        }
    }

    async editNote($event: MouseEvent, note: IJobNote) {
        try {
            await this.noteManagementDialogService.openNoteDialog($event, note, ContactID);
            this.loadNotes();
            this.toastrService.showSuccessToast('Note updated successfully');
        } catch (error) {
            if (!error) return;
            console.error("An error occured!")
        }
    }

    async deleteNote($event: MouseEvent, note: IJobNote) {
        $event.stopPropagation();

        try {
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
            if (!error) return;

            console.error('Error deleting note:', error);
            this.toastrService.showErrorToast('Failed to delete note');
        }
    }

    formatDate(date: Date | string): string {
        if (!date) return '';

        const momentDate = moment(date);
        const now = moment();
        const diffDays = now.diff(momentDate, 'days');

        if (diffDays === 0) {
            return 'Today ' + momentDate.format('HH:mm');
        } else if (diffDays === 1) {
            return 'Yesterday ' + momentDate.format('HH:mm');
        } else if (diffDays < 7) {
            return diffDays + ' days ago';
        } else {
            return momentDate.format('MM/DD/YYYY HH:mm');
        }
    }
}

const StickyNoteComponent: angular.IComponentOptions = {
    template: require('./sticky-notes.template.html'),
    controller: StickyNoteController,
    controllerAs: 'ctrl',
    bindings: {
        jobId: '<',
        isRecurringJob: "<"
    }
};

export default StickyNoteComponent;
