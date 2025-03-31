import {Suggestion, TucNoteViewModel} from "../interfaces/job.interface";

class NoteService {
    static $inject = [
        '$http'
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
        console.log('Notes service initialized');
    }

    $get() {
        return this;
    }

    async createNote(staffId: number, noteViewModel: TucNoteViewModel): Promise<TucNoteViewModel> {
        try {
            const response = await this.$http.post<TucNoteViewModel>('note/CreateNote', noteViewModel, {
                params: { staffId }
            });
            return response.data;
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }

    async updateNote(staffId: number, noteViewModel: TucNoteViewModel): Promise<void> {
        try {
            await this.$http.post('note/UpdateNote', noteViewModel, {
                params: { staffId }
            });
        } catch (error) {
            console.error('Error updating note:', error);
            throw error;
        }
    }

    async deleteNote(noteId: number): Promise<void> {
        try {
            await this.$http.delete('note/DeleteNote', {
                params: { noteId }
            });
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }

    async getJobNotes(jobId: number): Promise<TucNoteViewModel[]> {
        try {
            const response = await this.$http.get<TucNoteViewModel[]>(`note/GetNotes?jobId=${jobId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting job notes:', error);
            return [];
        }
    }

    async getNoteById(noteId: number): Promise<TucNoteViewModel | null> {
        try {
            const response = await this.$http.get<TucNoteViewModel>(`note/GetNote?noteId=${noteId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting note by ID:', error);
            return null;
        }
    }

    async getNoteTypes(): Promise<Suggestion[]> {
        try {
            const response = await this.$http.get<Suggestion[]>('note/GetNoteTypes');
            return response.data;
        } catch (error) {
            console.error('Error getting note types:', error);
            return [];
        }
    }
}

export default NoteService;
