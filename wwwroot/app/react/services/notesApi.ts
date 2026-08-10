/**
 * Notes API Service
 *
 * React-native API service for note-related operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {CreateNoteRequest, JobNote, JobNoteDto, NoteHistoryDto, NoteHistoryEntry, NoteType, UpdateNoteRequest} from '../interfaces';
import {parseDateFromApi} from '../utils/dateUtils';
import {RequestOptions} from "./requestOptions";

/**
 * Transform a JobNoteDto from API to JobNote with Dayjs dates
 */
function transformJobNoteDto(dto: JobNoteDto): JobNote {
    const createdDate = dto.createdDate ? parseDateFromApi(dto.createdDate) : undefined;
    const updatedDate = dto.updatedDate ? parseDateFromApi(dto.updatedDate) : undefined;
    return {
        ...dto,
        createdDate,
        updatedDate,
        _createdDateStr: createdDate?.format('MMM D, YYYY h:mm A'),
        _updatedDateStr: updatedDate?.format('MMM D, YYYY h:mm A'),
    };
}

/**
 * Get notes for a job
 */
export async function getJobNotes(jobId: number, isRecurring: boolean, options?: RequestOptions): Promise<JobNote[]> {
    const url = isRecurring ? 'note/GetRecurringNotes' : 'note/GetNotes';
    const notes = await apiClient.get<JobNoteDto[]>(url, {jobId}, options);
    return notes?.map(transformJobNoteDto) ?? [];
}

/**
 * Get notes for a bulk job
 */
export async function getBulkJobNotes(bulkJobId: number, options?: RequestOptions): Promise<JobNote[]> {
    const notes = await apiClient.get<JobNoteDto[]>('note/GetBulkJobNotes', {bulkJobId}, options);
    return notes?.map(transformJobNoteDto) ?? [];
}

/**
 * Get all note types
 */
export async function getNoteTypes(options?: RequestOptions): Promise<NoteType[]> {
    const noteTypes = await apiClient.get<NoteType[]>('note/GetNoteTypes', undefined, options);
    return noteTypes ?? [];
}

/**
 * Create a new note
 */
export async function createNote(note: CreateNoteRequest): Promise<void> {
    await apiClient.post('note/CreateNote', note);
}

/**
 * Create a new bulk job note
 */
export async function createBulkJobNote(note: CreateNoteRequest): Promise<void> {
    await apiClient.post('note/CreateBulkJobNote', note);
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
 * Delete a note. jobId disambiguates active vs archived notes server-side.
 */
export async function deleteNote(noteId: number, jobId?: number): Promise<void> {
    const url = jobId != null
        ? `note/DeleteNote?noteId=${noteId}&jobId=${jobId}`
        : `note/DeleteNote?noteId=${noteId}`;
    await apiClient.delete(url);
}

/**
 * Get edit history for a note
 */
export async function getNoteHistory(noteId: number, noteSource: string = 'Note', options?: RequestOptions): Promise<NoteHistoryEntry[]> {
    const history = await apiClient.get<NoteHistoryDto[]>('note/GetNoteHistory', {noteId, noteSource}, options);
    return history?.map(dto => {
        const editedAt = parseDateFromApi(dto.editedAt);
        return {
            ...dto,
            editedAt,
            editedAtStr: editedAt.format('MMM D, YYYY h:mm A'),
        };
    }) ?? [];
}

/**
 * Create a new note type
 */
export async function createNoteType(noteType: NoteType): Promise<void> {
    await apiClient.post('note/CreateNoteType', noteType);
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
    getNoteHistory,
};

export default notesApi;
