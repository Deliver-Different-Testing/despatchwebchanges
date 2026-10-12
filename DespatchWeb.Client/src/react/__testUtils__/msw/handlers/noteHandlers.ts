/**
 * Note API Handlers
 *
 * MSW handlers for note-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import {rejectWithoutCsrf} from './requestGuards';
import type { JobNoteDto, NoteType } from '../../../interfaces';

// Mock data
export const mockJobNoteDtos: JobNoteDto[] = [
    {
        noteId: 1,
        noteTypeId: 1,
        noteTypeName: 'General',
        jobId: 100,
        jobNumber: 'JOB-001',
        noteText: 'Package requires signature on delivery',
        isImportant: true,
        createdDate: '2024-01-15T10:00:00+00:00',
        createdBy: 10,
        createdByName: 'John Smith',
    },
    {
        noteId: 2,
        noteTypeId: 2,
        noteTypeName: 'Internal',
        jobId: 100,
        jobNumber: 'JOB-001',
        noteText: 'Client prefers morning delivery',
        isImportant: false,
        createdDate: '2024-01-15T11:00:00+00:00',
        createdBy: 20,
        createdByName: 'Jane Doe',
        updatedDate: '2024-01-16T09:00:00+00:00',
        updatedBy: 20,
        updatedByName: 'Jane Doe',
    },
];

export const mockNoteTypes: NoteType[] = [
    { id: 1, text: 'General', isPublic: true, description: 'General notes' },
    { id: 2, text: 'Internal', isPublic: false, description: 'Internal staff notes' },
    { id: 3, text: 'Client', isPublic: true, description: 'Client-facing notes' },
    { id: 4, text: 'Dispatch', isPublic: false, isCourierFacing: true, description: 'Courier-facing notes' },
];

export const noteHandlers = [
    // Get notes for a job
    http.get('*/note/GetNotes', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockJobNoteDtos);
    }),

    // Get recurring notes for a job
    http.get('*/note/GetRecurringNotes', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockJobNoteDtos);
    }),

    // Get notes for a bulk job
    http.get('*/note/GetBulkJobNotes', ({ request }) => {
        const url = new URL(request.url);
        const bulkJobId = url.searchParams.get('bulkJobId');

        if (!bulkJobId) {
            return new HttpResponse('Missing bulkJobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockJobNoteDtos);
    }),

    // Get note types
    http.get('*/note/GetNoteTypes', () => {
        return HttpResponse.json(mockNoteTypes);
    }),

    // Create a note
    http.post('*/note/CreateNote', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Create a bulk job note
    http.post('*/note/CreateBulkJobNote', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Update a note
    http.post('*/note/UpdateNote', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Update a bulk job note
    http.post('*/note/UpdateBulkJobNote', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Delete a note
    http.delete('*/note/DeleteNote', ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const url = new URL(request.url);
        const noteId = url.searchParams.get('noteId');

        if (!noteId) {
            return new HttpResponse('Missing noteId parameter', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Create a note type
    http.post('*/note/CreateNoteType', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),
];
