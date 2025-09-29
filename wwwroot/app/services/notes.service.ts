import {IJobNote, INoteType} from "../interfaces/job.interface";
import dayjs from "dayjs";

class NoteService implements angular.IServiceProvider {
    static $inject = [
        '$http',
        '$log'
    ];

    constructor(
        private $http: angular.IHttpService,
        private $log: angular.ILogService,
    ) {
        this.$log.debug('Notes service initialized');
    }

    $get() {
        return this;
    }

    async createNote(noteViewModel: IJobNote): Promise<IJobNote> {
        try {
            const response = await this.$http.post<IJobNote>('note/CreateNote', noteViewModel);
            return response.data;
        } catch (error) {
            this.$log.error('Error creating note:', error);
            throw error;
        }
    } 
    
    async createBulkJobNote(noteViewModel: IJobNote): Promise<IJobNote> {
        try {
            const response = await this.$http.post<IJobNote>('note/CreateBulkJobNote', noteViewModel);
            return response.data;
        } catch (error) {
            this.$log.error('Error creating note:', error);
            throw error;
        }
    }

    async updateNote(noteViewModel: IJobNote): Promise<void> {
        try {
            await this.$http.post('note/UpdateNote', noteViewModel);
        } catch (error) {
            this.$log.error('Error updating note:', error);
            throw error;
        }
    }
  
    async updateBulkJobNote(noteViewModel: IJobNote): Promise<void> {
        try {
            await this.$http.post('note/UpdateBulkJobNote', noteViewModel);
        } catch (error) {
            this.$log.error('Error updating note:', error);
            throw error;
        }
    }

    async deleteNote(noteId: number): Promise<void> {
        try {
            await this.$http.delete('note/DeleteNote', {
                params: { noteId }
            });
        } catch (error) {
            this.$log.error('Error deleting note:', error);
            throw error;
        }
    }

    async getJobNotes(jobId: number, isRecurring: boolean): Promise<IJobNote[]> {
        try {
            const url = isRecurring ? 'note/GetRecurringNotes' : 'note/GetNotes';
            const response = await this.$http.get<IJobNote[]>(url, {
                params: {
                    jobId,
                }
            });
            return response.data;
        } catch (error) {
            this.$log.error('Error getting job notes:', error);
            return [];
        }
    }
    
    async getBulkJobNotes(bulkJobId: number): Promise<IJobNote[]> {
        try {
            const response = await this.$http.get<IJobNote[]>('note/GetBulkJobNotes', {
                params: {
                    bulkJobId,
                }
            });
            return response.data;
        } catch (error) {
            this.$log.error('Error getting job notes:', error);
            return [];
        }
    }
    
    async getNoteTypes(): Promise<INoteType[]> {
        try {
            const response = await this.$http.get<INoteType[]>('note/GetNoteTypes');
            return response.data;
        } catch (error) {
            this.$log.error('Error getting note types:', error);
            return [];
        }
    }

    async createNoteType(noteType: INoteType): Promise<INoteType> {
        try {
            const response = await this.$http.post<INoteType>('note/CreateNoteType', noteType);
            return response.data;
        } catch (error) {
            this.$log.error('Error creating note type:', error);
            throw error;
        }
    }
}

export default NoteService;
