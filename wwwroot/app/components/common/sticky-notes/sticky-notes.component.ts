import "./sticky-notes.styles.less";
import NoteService from "../../../services/notes.service";
import NoteManagementDialogService from "../../dialogs/note-management-dialog/note-management.dialog.service";
import ToastrService from "../../../services/toastr.service";
import {IJobNote, INoteType} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import {getIanaTimezone} from "../../../functions/formatDates";

class StickyNoteController extends BaseController {
    private previousJobId?: number;
    private previousBulkJobId?: number;
    private timezone: string = getIanaTimezone(TimeZone);
    private readonly isRecurringJob: boolean = false;

    notes?: IJobNote[] = [];
    filteredNotes?: IJobNote[] = [];
    jobId?: number;
    bulkJobId?: number;
    loading: boolean = false;
    noteCategories?: INoteType[];
    selectedCategory: string = 'all';

    static $inject = [
        'noteService',
        'noteManagementDialogService',
        'toastrService',
        '$mdDialog',
        '$filter'
    ];

    constructor(
        private noteService: NoteService,
        private noteManagementDialogService: NoteManagementDialogService,
        private toastrService: ToastrService,
        private $mdDialog: angular.material.IDialogService,
        private $filter: angular.IFilterService,
    ) {
        super();
        
        this.noteService.getNoteTypes().then((noteTypes: INoteType[]) => {
            this.noteCategories = noteTypes;
        });
    }

    $onInit(): void {
        if (this.jobId) {
            this.loadNotes();
        }
        
        if(this.bulkJobId) {
           this.loadBulkNotes();
        }
    }

    $onChanges(changes: angular.IOnChangesObject): void {
        console.info('StickyNoteController - $onChanges called with changes:', JSON.stringify(changes));

        if (changes['jobId']) {
            const currentValue = changes['jobId'].currentValue;

            if (currentValue && typeof currentValue === 'number') {
                console.info('StickyNoteController - Valid jobId detected:', currentValue);

                if (this.previousJobId !== currentValue) {
                    this.previousJobId = currentValue;
                    this.loadNotes();
                }
            } else {
                console.info('StickyNoteController - No valid jobId change detected', {
                    currentValue,
                    type: typeof currentValue
                });
            }
        }    
        
        if (changes['bulkJobId']) {
            const currentValue = changes['bulkJobId'].currentValue;

            if (currentValue && typeof currentValue === 'number') {
                console.info('StickyNoteController - Valid bulkJobId detected:', currentValue);

                if (this.previousBulkJobId !== currentValue) {
                    this.previousBulkJobId = currentValue;
                    this.loadNotes();
                }
            } else {
                console.info('StickyNoteController - No valid bulkJobId change detected', {
                    currentValue,
                    type: typeof currentValue
                });
            }
        }
    }

    loadNotes(): void {
        if (!this.jobId) return;

        this.loading = true;
        this.noteService.getJobNotes(this.jobId, this.isRecurringJob)
            .then(notes => {
                this.notes = notes;
                this.applyFilter();
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                this.toastrService.showErrorToast('Failed to load notes');
            })
            .finally(() => {
                this.loading = false;
            });
    }

    loadBulkNotes(): void {
        if (!this.bulkJobId) return;

        this.loading = true;
        this.noteService.getBulkJobNotes(this.bulkJobId)
            .then(notes => {
                this.notes = notes;
                this.applyFilter();
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                this.toastrService.showErrorToast('Failed to load notes');
            })
            .finally(() => {
                this.loading = false;
            });
    }

    filterByCategory(category: string | INoteType): void {
        if (typeof category === 'string') {
            this.selectedCategory = category;
        } else {
            this.selectedCategory = category.id?.toString() || 'all';
        }

        this.applyFilter();
    }

    private applyFilter(): void {
        if (!this.notes) {
            this.filteredNotes = [];
            return;
        }

        if (this.selectedCategory === 'all') {
            this.filteredNotes = [...this.notes];
        } else {
            const categoryId = parseInt(this.selectedCategory);
            this.filteredNotes = this.notes.filter(note =>
                note.noteTypeId === categoryId
            );
        }
    }

    getDisplayNotes(): IJobNote[] {
        // Use filteredNotes if a filter is applied, otherwise use all notes
        return this.filteredNotes !== undefined ? this.filteredNotes : (this.notes || []);
    }

    async addNote($event: MouseEvent): Promise<void> {
        const emptyNote: IJobNote = {
            noteId: 0,
            noteTypeId: 0,
            noteText: '',
            isImportant: false,
            jobId: !this.isRecurringJob ? this.jobId : undefined,
            jobBookingId: this.isRecurringJob ? this.jobId : undefined,
            bulkJobId: this.bulkJobId != null ? this.bulkJobId : undefined,
            createdDate: dayjs().tz(this.timezone),
        };

        try {
            await this.noteManagementDialogService.openNoteDialog($event, emptyNote);
            this.loadNotes();
            this.toastrService.showSuccessToast('Note added successfully');
        } catch (error) {
            if (!error) return;
            console.error("An error occured!")
        }
    }

    async editNote($event: MouseEvent, note: IJobNote): Promise<void> {
        try {
            await this.noteManagementDialogService.openNoteDialog($event, note);
            this.loadNotes();
            this.toastrService.showSuccessToast('Note updated successfully');
        } catch (error) {
            if (!error) return;
            console.error("An error occured!")
        }
    }

    async deleteNote($event: MouseEvent, note: IJobNote): Promise<void> {
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

        const dayjsDate = dayjs(date);
        const now = dayjs();
        const diffDays = now.diff(dayjsDate, 'days');

        // Get the formatted timezone using the filter
        const timezoneShort = this.$filter<(timezone: string) => string>('timezoneShort')(TimeZone);
        const timezoneDisplay = timezoneShort ? ` (${timezoneShort})` : '';

        if (diffDays === 0) {
            return 'Today ' + dayjsDate.format('HH:mm') + timezoneDisplay;
        } else if (diffDays === 1) {
            return 'Yesterday ' + dayjsDate.format('HH:mm') + timezoneDisplay;
        } else if (diffDays < 7) {
            return diffDays + ' days ago';
        } else {
            return dayjsDate.format('MM/DD/YYYY HH:mm') + timezoneDisplay;
        }
    }

    isFilterActive(): boolean {
        return this.selectedCategory !== 'all';
    }

    getCategoryName(): string {
        if (this.selectedCategory === 'all') {
            return 'All Categories';
        }

        const category = this.noteCategories?.find(cat =>
            cat.id?.toString() === this.selectedCategory
        );

        return category?.text || 'Unknown Category';
    }
    
    getNoNotesMessage(): string {
      if(this.notes && this.notes.length > 0 && this.isFilterActive()) {
          return `No ${this.getCategoryName()} notes found`;
      } else if(this.notes && this.notes.length === 0) {
        return `No notes available for this job`;
      } else {
        return `No notes found. Click "Add Note" to add a new note`;
      }
    }
}

const StickyNoteComponent: angular.IComponentOptions = {
    template: require('./sticky-notes.template.html'),
    controller: StickyNoteController,
    controllerAs: 'ctrl',
    bindings: {
        jobId: '<',
        bulkJobId: '<',
        isRecurringJob: "<"
    }
};

export default StickyNoteComponent;
