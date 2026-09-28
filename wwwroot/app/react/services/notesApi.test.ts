/** @jest-environment node */
/**
 * Notes API Service Tests
 */

import {notesApi} from './notesApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';
import dayjs from 'dayjs';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

// Mock date utilities - parseDateFromApi preserves the string as a dayjs object
jest.mock('../utils/dateUtils', () => ({
    parseDateFromApi: jest.fn((dateStr: string) => dayjs(dateStr)),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('notesApi', () => {
    describe('getJobNotes', () => {
        const mockNoteDtos = [
            {
                noteId: 1,
                noteTypeId: 1,
                noteTypeName: 'General',
                jobId: 100,
                noteText: 'Test note 1',
                isImportant: false,
                createdDate: '2024-01-15T10:30:00Z',
                createdBy: 1,
                createdByName: 'John Doe',
            },
            {
                noteId: 2,
                noteTypeId: 2,
                noteTypeName: 'Urgent',
                jobId: 100,
                noteText: 'Test note 2',
                isImportant: true,
                createdDate: '2024-01-16T14:00:00Z',
                updatedDate: '2024-01-17T09:00:00Z',
                createdBy: 2,
                createdByName: 'Jane Smith',
                updatedBy: 1,
                updatedByName: 'John Doe',
            },
        ];

        it('should call correct endpoint for regular job notes', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockNoteDtos);

            await notesApi.getJobNotes(100, false);

            expect(mockApiClient.get).toHaveBeenCalledWith('note/GetNotes', {jobId: 100}, undefined);
        });

        it('should call correct endpoint for recurring job notes', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockNoteDtos);

            await notesApi.getJobNotes(100, true);

            expect(mockApiClient.get).toHaveBeenCalledWith('note/GetRecurringNotes', {jobId: 100}, undefined);
        });

        it('should transform date strings to Dayjs objects', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockNoteDtos);

            const result = await notesApi.getJobNotes(100, false);

            expect(result[0].createdDate).toBeDefined();
            expect(dayjs.isDayjs(result[0].createdDate)).toBe(true);
            expect(result[1].updatedDate).toBeDefined();
            expect(dayjs.isDayjs(result[1].updatedDate)).toBe(true);
        });

        it('should add formatted date strings', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockNoteDtos);

            const result = await notesApi.getJobNotes(100, false);

            expect(result[0]._createdDateStr).toBeDefined();
            expect(typeof result[0]._createdDateStr).toBe('string');
        });

        it('should return empty array when no notes found', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await notesApi.getJobNotes(100, false);

            expect(result).toEqual([]);
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await notesApi.getJobNotes(100, false);

            expect(result).toEqual([]);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Job not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Database error'})],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(notesApi.getJobNotes(100, false)).rejects.toEqual(error);
        });
    });

    describe('getBulkJobNotes', () => {
        it('should call correct endpoint with bulkJobId', async () => {
            const mockNotes = [{noteId: 1, noteTypeId: 1, noteText: 'Bulk note', isImportant: false}];
            mockApiClient.get.mockResolvedValueOnce(mockNotes);

            await notesApi.getBulkJobNotes(200);

            expect(mockApiClient.get).toHaveBeenCalledWith('note/GetBulkJobNotes', {bulkJobId: 200}, undefined);
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await notesApi.getBulkJobNotes(200);

            expect(result).toEqual([]);
        });
    });

    describe('getNoteTypes', () => {
        it('should call correct endpoint', async () => {
            const mockNoteTypes = [
                {id: 1, text: 'General', isPublic: true},
                {id: 2, text: 'Internal', isPublic: false},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockNoteTypes);

            const result = await notesApi.getNoteTypes();

            expect(mockApiClient.get).toHaveBeenCalledWith('note/GetNoteTypes', undefined, undefined);
            expect(result).toEqual(mockNoteTypes);
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await notesApi.getNoteTypes();

            expect(result).toEqual([]);
        });
    });

    describe('createNote', () => {
        const createRequest = {
            noteTypeId: 1,
            noteText: 'New note',
            isImportant: false,
            jobId: 100,
        };

        it('should call correct endpoint with create request', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await notesApi.createNote(createRequest);

            expect(mockApiClient.post).toHaveBeenCalledWith('note/CreateNote', createRequest);
        });

        it('should complete without returning data', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await expect(notesApi.createNote(createRequest)).resolves.toBeUndefined();
        });
    });

    describe('createBulkJobNote', () => {
        it('should call correct endpoint', async () => {
            const createRequest = {noteTypeId: 1, noteText: 'Bulk note', isImportant: false, bulkJobId: 200};
            const mockCreatedDto = {...createRequest, noteId: 4, createdDate: '2024-01-18T12:00:00Z'};
            mockApiClient.post.mockResolvedValueOnce(mockCreatedDto);

            await notesApi.createBulkJobNote(createRequest);

            expect(mockApiClient.post).toHaveBeenCalledWith('note/CreateBulkJobNote', createRequest);
        });
    });

    describe('updateNote', () => {
        it('should call correct endpoint with update request', async () => {
            const updateRequest = {
                noteId: 1,
                noteTypeId: 1,
                noteText: 'Updated note',
                isImportant: true,
                jobId: 100,
            };
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await notesApi.updateNote(updateRequest);

            expect(mockApiClient.post).toHaveBeenCalledWith('note/UpdateNote', updateRequest);
        });
    });

    describe('updateBulkJobNote', () => {
        it('should call correct endpoint', async () => {
            const updateRequest = {noteId: 1, noteTypeId: 1, noteText: 'Updated', isImportant: false, bulkJobId: 200};
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await notesApi.updateBulkJobNote(updateRequest);

            expect(mockApiClient.post).toHaveBeenCalledWith('note/UpdateBulkJobNote', updateRequest);
        });
    });

    describe('deleteNote', () => {
        it('should call correct endpoint with noteId', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await notesApi.deleteNote(1);

            expect(mockApiClient.delete).toHaveBeenCalledWith('note/DeleteNote?noteId=1');
        });

        it('should include jobId when provided', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await notesApi.deleteNote(1, 123);

            expect(mockApiClient.delete).toHaveBeenCalledWith('note/DeleteNote?noteId=1&jobId=123');
        });
    });

    describe('getNoteHistory', () => {
        const mockHistoryDtos = [
            {
                noteHistoryId: 1,
                noteId: 10,
                editedBy: 1,
                editedByName: 'John Doe',
                editedAt: '2024-06-15T10:30:00Z',
                oldNoteText: 'Original text',
                newNoteText: 'Updated text',
                oldNoteTypeId: 1,
                oldNoteTypeName: 'Internal Note',
                newNoteTypeId: 2,
                newNoteTypeName: 'Client Note',
                oldIsImportant: false,
                newIsImportant: true,
            },
        ];

        it('should call correct endpoint with noteId and noteSource', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockHistoryDtos);

            await notesApi.getNoteHistory(1, 'Note');

            expect(mockApiClient.get).toHaveBeenCalledWith('note/GetNoteHistory', {noteId: 1, noteSource: 'Note'}, undefined);
        });

        it('should use default noteSource of "Note"', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockHistoryDtos);

            await notesApi.getNoteHistory(1);

            expect(mockApiClient.get).toHaveBeenCalledWith('note/GetNoteHistory', {noteId: 1, noteSource: 'Note'}, undefined);
        });

        it('should transform editedAt strings to Dayjs objects', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockHistoryDtos);

            const result = await notesApi.getNoteHistory(10);

            expect(result[0].editedAt).toBeDefined();
            expect(dayjs.isDayjs(result[0].editedAt)).toBe(true);
        });

        it('should add formatted editedAtStr', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockHistoryDtos);

            const result = await notesApi.getNoteHistory(10);

            expect(result[0].editedAtStr).toBeDefined();
            expect(typeof result[0].editedAtStr).toBe('string');
            expect(result[0].editedAtStr.length).toBeGreaterThan(0);
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await notesApi.getNoteHistory(10);

            expect(result).toEqual([]);
        });
    });

    describe('createNoteType', () => {
        it('should call correct endpoint with note type', async () => {
            const newNoteType = {text: 'Custom Type', isPublic: true, description: 'A custom note type'};
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await notesApi.createNoteType(newNoteType);

            expect(mockApiClient.post).toHaveBeenCalledWith('note/CreateNoteType', newNoteType);
        });
    });
});
