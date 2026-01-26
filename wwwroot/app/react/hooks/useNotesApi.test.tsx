/**
 * useNotesApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
    useJobNotes,
    useBulkJobNotes,
    useNoteTypes,
    useCreateNote,
    useCreateBulkJobNote,
    useUpdateNote,
    useUpdateBulkJobNote,
    useDeleteNote,
    useCreateNoteType,
} from './useNotesApi';
import {notesApi} from '../services/notesApi';
import {JobNote, NoteType} from '../interfaces';
import dayjs from 'dayjs';

// Mock the notesApi
jest.mock('../services/notesApi', () => ({
    notesApi: {
        getJobNotes: jest.fn(),
        getBulkJobNotes: jest.fn(),
        getNoteTypes: jest.fn(),
        createNote: jest.fn(),
        createBulkJobNote: jest.fn(),
        updateNote: jest.fn(),
        updateBulkJobNote: jest.fn(),
        deleteNote: jest.fn(),
        createNoteType: jest.fn(),
    },
}));

const mockNotesApi = notesApi as jest.Mocked<typeof notesApi>;

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });

// Wrapper component for providing QueryClient
const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

// Sample test data
const mockNotes: JobNote[] = [
    {
        noteId: 1,
        noteTypeId: 1,
        noteTypeName: 'General',
        jobId: 100,
        noteText: 'Test note 1',
        isImportant: false,
        createdDate: dayjs('2024-01-15T10:30:00Z'),
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
        createdDate: dayjs('2024-01-16T14:00:00Z'),
        createdBy: 2,
        createdByName: 'Jane Smith',
    },
];

const mockNoteTypes: NoteType[] = [
    {id: 1, text: 'General', isPublic: true},
    {id: 2, text: 'Urgent', isPublic: true},
    {id: 3, text: 'Internal', isPublic: false},
];

describe('useJobNotes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch notes for a regular job', async () => {
        mockNotesApi.getJobNotes.mockResolvedValueOnce(mockNotes);

        const {result} = renderHook(() => useJobNotes(100, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.getJobNotes).toHaveBeenCalledWith(100, false);
        expect(result.current.data).toEqual(mockNotes);
    });

    it('should fetch notes for a recurring job', async () => {
        mockNotesApi.getJobNotes.mockResolvedValueOnce(mockNotes);

        const {result} = renderHook(() => useJobNotes(100, true), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.getJobNotes).toHaveBeenCalledWith(100, true);
    });

    it('should not fetch when jobId is undefined', async () => {
        renderHook(() => useJobNotes(undefined, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockNotesApi.getJobNotes).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useJobNotes(100, false, {enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockNotesApi.getJobNotes).not.toHaveBeenCalled();
        });
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to fetch notes');
        mockNotesApi.getJobNotes.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useJobNotes(100, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useBulkJobNotes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch notes for a bulk job', async () => {
        mockNotesApi.getBulkJobNotes.mockResolvedValueOnce(mockNotes);

        const {result} = renderHook(() => useBulkJobNotes(200), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.getBulkJobNotes).toHaveBeenCalledWith(200);
        expect(result.current.data).toEqual(mockNotes);
    });

    it('should not fetch when bulkJobId is undefined', async () => {
        renderHook(() => useBulkJobNotes(undefined), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockNotesApi.getBulkJobNotes).not.toHaveBeenCalled();
        });
    });
});

describe('useNoteTypes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch note types', async () => {
        mockNotesApi.getNoteTypes.mockResolvedValueOnce(mockNoteTypes);

        const {result} = renderHook(() => useNoteTypes(), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.getNoteTypes).toHaveBeenCalled();
        expect(result.current.data).toEqual(mockNoteTypes);
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useNoteTypes({enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockNotesApi.getNoteTypes).not.toHaveBeenCalled();
        });
    });
});

describe('useCreateNote', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a note successfully', async () => {
        mockNotesApi.createNote.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useCreateNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                noteTypeId: 1,
                noteText: 'New note',
                isImportant: false,
                jobId: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.createNote).toHaveBeenCalledWith({
            noteTypeId: 1,
            noteText: 'New note',
            isImportant: false,
            jobId: 100,
        });
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to create note');
        mockNotesApi.createNote.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useCreateNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                noteTypeId: 1,
                noteText: 'New note',
                isImportant: false,
            });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useCreateBulkJobNote', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a bulk job note successfully', async () => {
        mockNotesApi.createBulkJobNote.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useCreateBulkJobNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                noteTypeId: 1,
                noteText: 'Bulk note',
                isImportant: false,
                bulkJobId: 200,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.createBulkJobNote).toHaveBeenCalled();
    });
});

describe('useUpdateNote', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should update a note successfully', async () => {
        mockNotesApi.updateNote.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useUpdateNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                noteId: 1,
                noteTypeId: 1,
                noteText: 'Updated note',
                isImportant: true,
                jobId: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.updateNote).toHaveBeenCalled();
    });
});

describe('useUpdateBulkJobNote', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should update a bulk job note successfully', async () => {
        mockNotesApi.updateBulkJobNote.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useUpdateBulkJobNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                noteId: 1,
                noteTypeId: 1,
                noteText: 'Updated bulk note',
                isImportant: false,
                bulkJobId: 200,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.updateBulkJobNote).toHaveBeenCalled();
    });
});

describe('useDeleteNote', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should delete a note successfully', async () => {
        mockNotesApi.deleteNote.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useDeleteNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({noteId: 1, jobId: 100});
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.deleteNote).toHaveBeenCalledWith(1);
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to delete note');
        mockNotesApi.deleteNote.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useDeleteNote(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({noteId: 999, jobId: 100});
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useCreateNoteType', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a note type successfully', async () => {
        mockNotesApi.createNoteType.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useCreateNoteType(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({text: 'Custom', isPublic: true});
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockNotesApi.createNoteType).toHaveBeenCalledWith({text: 'Custom', isPublic: true});
    });
});
