/**
 * Notes Interfaces
 *
 * Type definitions for notes-related API operations.
 */

import {Dayjs} from 'dayjs';

export interface JobNoteDto {
    noteId?: number;
    noteTypeId: number;
    noteTypeName?: string;
    jobId?: number;
    bulkJobId?: number;
    jobNumber?: string;
    jobBookingId?: number;
    noteText: string;
    isImportant: boolean;
    createdDate?: string;
    createdBy?: number;
    createdByName?: string;
    updatedDate?: string;
    updatedBy?: number;
    updatedByName?: string;
}

export interface JobNote {
    noteId?: number;
    noteTypeId: number;
    noteTypeName?: string;
    jobId?: number;
    bulkJobId?: number;
    jobNumber?: string;
    jobBookingId?: number;
    noteText: string;
    isImportant: boolean;
    createdDate?: Dayjs;
    createdBy?: number;
    createdByName?: string;
    updatedDate?: Dayjs;
    updatedBy?: number;
    updatedByName?: string;
    _createdDateStr?: string;
    _updatedDateStr?: string;
}

export interface NoteType {
    id?: number;
    text: string;
    isPublic: boolean;
    isCourierFacing?: boolean;
    description?: string;
}

export interface CreateNoteRequest {
    noteId?: number;
    noteTypeId: number;
    noteText: string;
    isImportant: boolean;
    jobId?: number;
    jobBookingId?: number;
    bulkJobId?: number;
}

export interface UpdateNoteRequest {
    noteId: number;
    noteTypeId: number;
    noteText: string;
    isImportant: boolean;
    jobId?: number;
    jobBookingId?: number;
    bulkJobId?: number;
}

export interface NoteHistoryDto {
    noteHistoryId: number;
    noteId: number;
    editedBy: number;
    editedByName: string;
    editedAt: string;
    oldNoteText: string;
    newNoteText: string;
    oldNoteTypeId?: number;
    oldNoteTypeName?: string;
    newNoteTypeId?: number;
    newNoteTypeName?: string;
    oldIsImportant?: boolean;
    newIsImportant?: boolean;
}

export interface NoteHistoryEntry {
    noteHistoryId: number;
    noteId: number;
    editedBy: number;
    editedByName: string;
    editedAt: Dayjs;
    editedAtStr: string;
    oldNoteText: string;
    newNoteText: string;
    oldNoteTypeId?: number;
    oldNoteTypeName?: string;
    newNoteTypeId?: number;
    newNoteTypeName?: string;
    oldIsImportant?: boolean;
    newIsImportant?: boolean;
}
