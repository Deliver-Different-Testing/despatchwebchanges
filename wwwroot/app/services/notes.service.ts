import {IJobNote, INoteType} from "../interfaces/job.interface";

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

    async createNote(noteViewModel: IJobNote): Promise<IJobNote> {
        try {
            const response = await this.$http.post<IJobNote>('note/CreateNote', noteViewModel);
            return response.data;
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }

    async updateNote(staffId: number, noteViewModel: IJobNote): Promise<void> {
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

    async getJobNotes(jobId: number, isRecurring: boolean): Promise<IJobNote[]> {
        try {
            const url = isRecurring ? 'note/GetRecurringNotes' : 'note/GetNotes';
            const response = await this.$http.get<IJobNote[]>(`${url}?jobId=${jobId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting job notes:', error);
            return [];
        }
    }

    async getNoteById(noteId: number): Promise<IJobNote | null> {
        try {
            const response = await this.$http.get<IJobNote>(`note/GetNote?noteId=${noteId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting note by ID:', error);
            return null;
        }
    }

    async getNoteTypes(): Promise<INoteType[]> {
        try {
            const response = await this.$http.get<INoteType[]>('note/GetNoteTypes');
            return response.data;
        } catch (error) {
            console.error('Error getting note types:', error);
            return [];
        }
    }

    async createNoteType(noteType: INoteType): Promise<INoteType> {
        try {
            const response = await this.$http.post<INoteType>('note/CreateNoteType', noteType);
            return response.data;
        } catch (error) {
            console.error('Error creating note type:', error);
            throw error;
        }
    }
}

export default NoteService;
