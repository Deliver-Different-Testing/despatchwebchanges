/**
 * React Query Hooks for Notes API
 *
 * Provides type-safe hooks for note-related API operations
 * with automatic caching, loading states, and error handling.
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {notesApi} from '../services/notesApi';
import {CreateNoteRequest, JobNote, NoteHistoryEntry, NoteType, UpdateNoteRequest} from '../interfaces';

/**
 * Hook to fetch notes for a job
 *
 * @param jobId - The job ID to fetch notes for
 * @param isRecurring - Whether this is a recurring job
 * @param options - Additional options
 * @returns Query result with notes array, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: notes, isLoading, error } = useJobNotes(123, false);
 * ```
 */
export function useJobNotes(
    jobId: number | undefined,
    isRecurring: boolean = false,
    options?: {
        enabled?: boolean;
    }
) {
    return useQuery<JobNote[], Error>({
        queryKey: queryKeys.notes.job(jobId ?? 0, isRecurring),
        queryFn: ({signal}) => notesApi.getJobNotes(jobId!, isRecurring, {signal}),
        enabled: !!jobId && (options?.enabled ?? true),
    });
}

/**
 * Hook to fetch notes for a bulk job
 *
 * @param bulkJobId - The bulk job ID to fetch notes for
 * @param options - Additional options
 * @returns Query result with notes array, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: notes, isLoading } = useBulkJobNotes(456);
 * ```
 */
export function useBulkJobNotes(
    bulkJobId: number | undefined,
    options?: {
        enabled?: boolean;
    }
) {
    return useQuery<JobNote[], Error>({
        queryKey: queryKeys.notes.bulkJob(bulkJobId ?? 0),
        queryFn: ({signal}) => notesApi.getBulkJobNotes(bulkJobId!, {signal}),
        enabled: !!bulkJobId && (options?.enabled ?? true),
    });
}

/**
 * Hook to fetch all note types
 *
 * @param options - Additional options
 * @returns Query result with note types array, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: noteTypes, isLoading } = useNoteTypes();
 * ```
 */
export function useNoteTypes(options?: { enabled?: boolean }) {
    return useQuery<NoteType[], Error>({
        queryKey: queryKeys.notes.types,
        queryFn: ({signal}) => notesApi.getNoteTypes({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // Cache note types for 5 minutes (rarely change)
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    });
}

/**
 * Hook to create a new note
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const createNote = useCreateNote();
 * createNote.mutate({ jobId: 123, noteTypeId: 1, noteText: 'Hello', isImportant: false });
 * ```
 */
export function useCreateNote() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, CreateNoteRequest>({
        mutationFn: (note) => notesApi.createNote(note),
        onSuccess: async (_, variables) => {
            // Invalidate job notes query to refetch
            if (variables.jobId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.job(variables.jobId, false),
                });
            }
            if (variables.jobBookingId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.job(variables.jobBookingId, true),
                });
            }
        },
    });
}

/**
 * Hook to create a new bulk job note
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const createBulkNote = useCreateBulkJobNote();
 * createBulkNote.mutate({ bulkJobId: 456, noteTypeId: 1, noteText: 'Hello', isImportant: false });
 * ```
 */
export function useCreateBulkJobNote() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, CreateNoteRequest>({
        mutationFn: (note) => notesApi.createBulkJobNote(note),
        onSuccess: async (_, variables) => {
            if (variables.bulkJobId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.bulkJob(variables.bulkJobId),
                });
            }
        },
    });
}

/**
 * Hook to update an existing note
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const updateNote = useUpdateNote();
 * updateNote.mutate({ noteId: 1, noteTypeId: 1, noteText: 'Updated', isImportant: true });
 * ```
 */
export function useUpdateNote() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, UpdateNoteRequest & { jobId?: number; jobBookingId?: number }>({
        mutationFn: (note) => notesApi.updateNote(note),
        onSuccess: async (_, variables) => {
            // Invalidate relevant queries
            if (variables.jobId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.job(variables.jobId, false),
                });
            }
            if (variables.jobBookingId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.job(variables.jobBookingId, true),
                });
            }
        },
    });
}

/**
 * Hook to update an existing bulk job note
 *
 * @returns Mutation object with mutate function and status
 */
export function useUpdateBulkJobNote() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, UpdateNoteRequest & { bulkJobId?: number }>({
        mutationFn: (note) => notesApi.updateBulkJobNote(note),
        onSuccess: async (_, variables) => {
            if (variables.bulkJobId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.bulkJob(variables.bulkJobId),
                });
            }
        },
    });
}

/**
 * Hook to delete a note
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const deleteNote = useDeleteNote();
 * deleteNote.mutate({ noteId: 1, jobId: 123 });
 * ```
 */
export function useDeleteNote() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { noteId: number; jobId?: number; jobBookingId?: number; bulkJobId?: number }>({
        mutationFn: ({noteId}) => notesApi.deleteNote(noteId),
        onSuccess: async (_, variables) => {
            // Invalidate relevant queries
            if (variables.jobId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.job(variables.jobId, false),
                });
            }
            if (variables.jobBookingId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.job(variables.jobBookingId, true),
                });
            }
            if (variables.bulkJobId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.bulkJob(variables.bulkJobId),
                });
            }
        },
    });
}

/**
 * Hook to fetch edit history for a note
 */
export function useNoteHistory(
    noteId: number | undefined,
    noteSource: string = 'Note',
    options?: { enabled?: boolean }
) {
    return useQuery<NoteHistoryEntry[], Error>({
        queryKey: queryKeys.notes.history(noteId ?? 0, noteSource),
        queryFn: ({signal}) => notesApi.getNoteHistory(noteId!, noteSource, {signal}),
        enabled: !!noteId && (options?.enabled ?? true),
    });
}

/**
 * Hook to create a new note type
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const createNoteType = useCreateNoteType();
 * createNoteType.mutate({ text: 'Custom', isPublic: true });
 * ```
 */
export function useCreateNoteType() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, NoteType>({
        mutationFn: (noteType) => notesApi.createNoteType(noteType),
        onSuccess: async () => {
            // Invalidate note types query to refetch
            await queryClient.invalidateQueries({
                queryKey: queryKeys.notes.types,
            });
        },
    });
}
