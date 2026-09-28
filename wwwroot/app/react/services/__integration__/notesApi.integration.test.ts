/** @jest-environment jest-fixed-jsdom */
/**
 * Notes API Integration Tests
 *
 * Tests the notesApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, response handling,
 * and date transformations.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { notesApi } from '../notesApi';
import { mockJobNoteDtos } from '../../__testUtils__/msw/handlers';
import dayjs from 'dayjs';

describe('notesApi integration', () => {
    describe('getJobNotes', () => {
        it('fetches regular notes for a job', async () => {
            let capturedEndpoint = '';

            server.use(
                http.get('*/note/GetNotes', ({ request }) => {
                    capturedEndpoint = new URL(request.url).pathname;
                    return HttpResponse.json(mockJobNoteDtos);
                })
            );

            const result = await notesApi.getJobNotes(100, false);

            expect(capturedEndpoint).toContain('GetNotes');
            expect(result).toHaveLength(2);
            expect(result[0].noteText).toBe('Package requires signature on delivery');
        });

        it('fetches recurring notes when isRecurring is true', async () => {
            let capturedEndpoint = '';

            server.use(
                http.get('*/note/GetRecurringNotes', ({ request }) => {
                    capturedEndpoint = new URL(request.url).pathname;
                    return HttpResponse.json(mockJobNoteDtos);
                })
            );

            const result = await notesApi.getJobNotes(100, true);

            expect(capturedEndpoint).toContain('GetRecurringNotes');
            expect(result).toHaveLength(2);
        });

        it('transforms createdDate to Dayjs', async () => {
            const result = await notesApi.getJobNotes(100, false);

            expect(dayjs.isDayjs(result[0].createdDate)).toBe(true);
        });

        it('transforms updatedDate to Dayjs when present', async () => {
            const result = await notesApi.getJobNotes(100, false);

            // First note has no updatedDate
            expect(result[0].updatedDate).toBeUndefined();
            // Second note has updatedDate
            expect(dayjs.isDayjs(result[1].updatedDate)).toBe(true);
        });

        it('includes formatted date strings', async () => {
            const result = await notesApi.getJobNotes(100, false);

            expect(result[0]._createdDateStr).toBeDefined();
            expect(typeof result[0]._createdDateStr).toBe('string');
        });

        it('passes jobId parameter correctly', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/note/GetNotes', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await notesApi.getJobNotes(42, false);

            expect(capturedUrl).toContain('jobId=42');
        });

        it('returns empty array when response is null', async () => {
            server.use(
                http.get('*/note/GetNotes', () => {
                    return HttpResponse.json(null);
                })
            );

            const result = await notesApi.getJobNotes(100, false);

            expect(result).toHaveLength(0);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/note/GetNotes', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(notesApi.getJobNotes(100, false)).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getBulkJobNotes', () => {
        it('fetches bulk job notes with correct parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/note/GetBulkJobNotes', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobNoteDtos);
                })
            );

            const result = await notesApi.getBulkJobNotes(500);

            expect(capturedUrl).toContain('bulkJobId=500');
            expect(result).toHaveLength(2);
        });
    });

    describe('getNoteTypes', () => {
        it('fetches all note types', async () => {
            const result = await notesApi.getNoteTypes();

            expect(result).toHaveLength(4);
            expect(result[0]).toMatchObject({ id: 1, text: 'General', isPublic: true });
            expect(result[3]).toMatchObject({ id: 4, text: 'Dispatch', isCourierFacing: true });
        });

        it('returns empty array when response is null', async () => {
            server.use(
                http.get('*/note/GetNoteTypes', () => {
                    return HttpResponse.json(null);
                })
            );

            const result = await notesApi.getNoteTypes();

            expect(result).toHaveLength(0);
        });
    });

    describe('createNote', () => {
        it('creates a note with correct body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/note/CreateNote', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await notesApi.createNote({
                noteTypeId: 1,
                noteText: 'Test note',
                isImportant: true,
                jobId: 100,
            });

            expect(capturedBody).toMatchObject({
                noteTypeId: 1,
                noteText: 'Test note',
                isImportant: true,
                jobId: 100,
            });
        });

        it('handles validation errors', async () => {
            server.use(
                http.post('*/note/CreateNote', () => {
                    return HttpResponse.json({ message: 'Note text is required' }, { status: 400 });
                })
            );

            await expect(notesApi.createNote({
                noteTypeId: 1,
                noteText: '',
                isImportant: false,
            })).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('createBulkJobNote', () => {
        it('creates a bulk job note', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/note/CreateBulkJobNote', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await notesApi.createBulkJobNote({
                noteTypeId: 2,
                noteText: 'Bulk note',
                isImportant: false,
                bulkJobId: 500,
            });

            expect(capturedBody).toMatchObject({
                noteTypeId: 2,
                bulkJobId: 500,
            });
        });
    });

    describe('updateNote', () => {
        it('updates a note with correct body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/note/UpdateNote', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await notesApi.updateNote({
                noteId: 1,
                noteTypeId: 1,
                noteText: 'Updated note text',
                isImportant: false,
                jobId: 100,
            });

            expect(capturedBody).toMatchObject({
                noteId: 1,
                noteText: 'Updated note text',
            });
        });
    });

    describe('updateBulkJobNote', () => {
        it('updates a bulk job note', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/note/UpdateBulkJobNote', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await notesApi.updateBulkJobNote({
                noteId: 2,
                noteTypeId: 2,
                noteText: 'Updated bulk note',
                isImportant: true,
                bulkJobId: 500,
            });

            expect(capturedBody).toMatchObject({
                noteId: 2,
                bulkJobId: 500,
            });
        });
    });

    describe('deleteNote', () => {
        it('deletes a note with noteId in URL', async () => {
            let capturedUrl = '';

            server.use(
                http.delete('*/note/DeleteNote', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await notesApi.deleteNote(5);

            expect(capturedUrl).toContain('noteId=5');
        });

        it('handles not found error', async () => {
            server.use(
                http.delete('*/note/DeleteNote', () => {
                    return HttpResponse.json({ message: 'Note not found' }, { status: 404 });
                })
            );

            await expect(notesApi.deleteNote(999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });

    describe('createNoteType', () => {
        it('creates a new note type', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/note/CreateNoteType', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await notesApi.createNoteType({
                text: 'Custom Type',
                isPublic: true,
                description: 'A custom note type',
            });

            expect(capturedBody).toMatchObject({
                text: 'Custom Type',
                isPublic: true,
            });
        });
    });
});
