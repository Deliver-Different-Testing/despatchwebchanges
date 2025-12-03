import {IJobNote, IJobNoteDto, INoteType} from "../interfaces/job.interface";
import {transformJobNoteDto} from "../functions/dtoMappings";

class NoteService implements angular.IServiceProvider {
    static $inject = [
        '$http',
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {
        console.log('NoteService: Initialized');
    }

    $get() {
        return this;
    }

    async createNote(noteViewModel: IJobNote): Promise<IJobNote> {
        console.log('NoteService.createNote: Starting', { noteViewModel });
        try {
            const response = await this.$http.post<IJobNote>('note/CreateNote', noteViewModel);
            console.log('NoteService.createNote: Success', { noteId: response.data.noteId });
            return response.data;
        } catch (error) {
            console.error('NoteService.createNote: Failed', { noteViewModel, error });
            throw error;
        }
    }

    async createBulkJobNote(noteViewModel: IJobNote): Promise<IJobNote> {
        console.log('NoteService.createBulkJobNote: Starting', { noteViewModel });
        try {
            const response = await this.$http.post<IJobNote>('note/CreateBulkJobNote', noteViewModel);
            console.log('NoteService.createBulkJobNote: Success', { noteId: response.data.noteId });
            return response.data;
        } catch (error) {
            console.error('NoteService.createBulkJobNote: Failed', { noteViewModel, error });
            throw error;
        }
    }

    async updateNote(noteViewModel: IJobNote): Promise<void> {
        console.log('NoteService.updateNote: Starting', { noteId: noteViewModel.noteId });
        try {
            await this.$http.post('note/UpdateNote', noteViewModel);
            console.log('NoteService.updateNote: Success', { noteId: noteViewModel.noteId });
        } catch (error) {
            console.error('NoteService.updateNote: Failed', { noteViewModel, error });
            throw error;
        }
    }

    async updateBulkJobNote(noteViewModel: IJobNote): Promise<void> {
        console.log('NoteService.updateBulkJobNote: Starting', { noteId: noteViewModel.noteId });
        try {
            await this.$http.post('note/UpdateBulkJobNote', noteViewModel);
            console.log('NoteService.updateBulkJobNote: Success', { noteId: noteViewModel.noteId });
        } catch (error) {
            console.error('NoteService.updateBulkJobNote: Failed', { noteViewModel, error });
            throw error;
        }
    }

    async deleteNote(noteId: number): Promise<void> {
        console.log('NoteService.deleteNote: Starting', { noteId });
        try {
            await this.$http.delete('note/DeleteNote', {
                params: { noteId }
            });
            console.log('NoteService.deleteNote: Success', { noteId });
        } catch (error) {
            console.error('NoteService.deleteNote: Failed', { noteId, error });
            throw error;
        }
    }

    async getJobNotes(jobId: number, isRecurring: boolean): Promise<IJobNote[]> {
        try {
            const url = isRecurring ? 'note/GetRecurringNotes' : 'note/GetNotes';
            const response = await this.$http.get<IJobNoteDto[]>(url, {
                params: {
                    jobId,
                }
            });
            
            return response.data.map(transformJobNoteDto);
        } catch (error) {
            console.error('NoteService.getJobNotes: Failed', { jobId, isRecurring, error });
            return [];
        }
    }

    async getBulkJobNotes(bulkJobId: number): Promise<IJobNote[]> {
        try {
            const response = await this.$http.get<IJobNoteDto[]>('note/GetBulkJobNotes', {
                params: {
                    bulkJobId,
                }
            });
       
            return response.data.map(transformJobNoteDto);
        } catch (error) {
            console.error('NoteService.getBulkJobNotes: Failed', { bulkJobId, error });
            return [];
        }
    }

    async getNoteTypes(): Promise<INoteType[]> {
        console.log('NoteService.getNoteTypes: Starting');
        try {
            const response = await this.$http.get<INoteType[]>('note/GetNoteTypes');
            console.log('NoteService.getNoteTypes: Success', {
                typesCount: response.data.length
            });
            return response.data;
        } catch (error) {
            console.error('NoteService.getNoteTypes: Failed', { error });
            return [];
        }
    }

    async createNoteType(noteType: INoteType): Promise<INoteType> {
        console.log('NoteService.createNoteType: Starting', { noteType });
        try {
            const response = await this.$http.post<INoteType>('note/CreateNoteType', noteType);
            console.log('NoteService.createNoteType: Success', { noteTypeId: response.data.id });
            return response.data;
        } catch (error) {
            console.error('NoteService.createNoteType: Failed', { noteType, error });
            throw error;
        }
    }
}

export default NoteService;