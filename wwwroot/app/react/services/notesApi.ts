/**
 * Notes API Service
 *
 * React-native API service for note-related operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {CreateNoteRequest, JobNote, JobNoteDto, NoteType, UpdateNoteRequest} from '../interfaces';
import dayjs from 'dayjs';

/**
 * Transform a JobNoteDto from API to JobNote with Dayjs dates
 */
function transformJobNoteDto(dto: JobNoteDto): JobNote {
    return {
        ...dto,
        createdDate: dto.createdDate ? dayjs(dto.createdDate) : undefined,
        updatedDate: dto.updatedDate ? dayjs(dto.updatedDate) : undefined,
        _createdDateStr: dto.createdDate ? dayjs(dto.createdDate).format('MMM D, YYYY h:mm A') : undefined,
        _updatedDateStr: dto.updatedDate ? dayjs(dto.updatedDate).format('MMM D, YYYY h:mm A') : undefined,
    };
}

/**
 * Get notes for a job
 */
export async function getJobNotes(jobId: number, isRecurring: boolean): Promise<JobNote[]> {
    const url = isRecurring ? 'note/GetRecurringNotes' : 'note/GetNotes';
    const notes = await apiClient.get<JobNoteDto[]>(url, {jobId});
    return notes?.map(transformJobNoteDto) ?? [];
}

/**
 * Get notes for a bulk job
 */
export async function getBulkJobNotes(bulkJobId: number): Promise<JobNote[]> {
    const notes = await apiClient.get<JobNoteDto[]>('note/GetBulkJobNotes', {bulkJobId});
    return notes?.map(transformJobNoteDto) ?? [];
}

/**
 * Get all note types
 */
export async function getNoteTypes(): Promise<NoteType[]> {
    const noteTypes = await apiClient.get<NoteType[]>('note/GetNoteTypes');
    return noteTypes ?? [];
}

/**
 * Create a new note
 */
export async function createNote(note: CreateNoteRequest): Promise<JobNote> {
    const created = await apiClient.post<JobNoteDto>('note/CreateNote', note);
    return transformJobNoteDto(created);
}

/**
 * Create a new bulk job note
 */
export async function createBulkJobNote(note: CreateNoteRequest): Promise<JobNote> {
    const created = await apiClient.post<JobNoteDto>('note/CreateBulkJobNote', note);
    return transformJobNoteDto(created);
}

/**
 * Update an existing note
 */
export async function updateNote(note: UpdateNoteRequest): Promise<void> {
    await apiClient.post('note/UpdateNote', note);
}

/**
 * Update an existing bulk job note
 */
export async function updateBulkJobNote(note: UpdateNoteRequest): Promise<void> {
    await apiClient.post('note/UpdateBulkJobNote', note);
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: number): Promise<void> {
    await apiClient.delete(`note/DeleteNote?noteId=${noteId}`);
}

/**
 * Create a new note type
 */
export async function createNoteType(noteType: NoteType): Promise<NoteType> {
    return apiClient.post<NoteType>('note/CreateNoteType', noteType);
}

export const notesApi = {
    getJobNotes,
    getBulkJobNotes,
    getNoteTypes,
    createNote,
    createBulkJobNote,
    updateNote,
    updateBulkJobNote,
    deleteNote,
    createNoteType,
};

export default notesApi;
