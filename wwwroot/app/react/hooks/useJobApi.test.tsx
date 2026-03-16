/**
 * useJobApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useRelatedJobs} from './useJobApi';
import {jobApi} from '../services/jobApi';
import {RelatedJobDto} from '../interfaces';

// Mock the jobApi
jest.mock('../services/jobApi', () => ({
    jobApi: {
        getRelatedJobsMultiSelectList: jest.fn(),
    },
}));

const mockJobApi = jobApi as jest.Mocked<typeof jobApi>;

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
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

describe('useRelatedJobs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockRelatedJobs: RelatedJobDto[] = [
        {
            id: 100,
            text: 'JOB-001 - Pending',
            selected: true,
        },
        {
            id: 101,
            text: 'JOB-002 - In Progress',
            selected: false,
        },
        {
            id: 102,
            text: 'JOB-003 - Completed',
            selected: false,
        },
    ];

    it('should fetch related jobs for a valid job ID', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValueOnce(mockRelatedJobs);

        const {result} = renderHook(() => useRelatedJobs(100, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(100, false, false, expect.anything());
        expect(result.current.data).toEqual(mockRelatedJobs);
    });

    it('should fetch related jobs for archived job', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValueOnce(mockRelatedJobs);

        const {result} = renderHook(() => useRelatedJobs(200, true), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(200, true, false, expect.anything());
    });

    it('should not fetch when jobId is 0', async () => {
        renderHook(() => useRelatedJobs(0, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when jobId is negative', async () => {
        renderHook(() => useRelatedJobs(-1, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useRelatedJobs(100, false, {enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).not.toHaveBeenCalled();
        });
    });

    it('should handle empty results', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValueOnce([]);

        const {result} = renderHook(() => useRelatedJobs(100, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it('should handle errors', async () => {
        const error = new Error('Job not found');
        mockJobApi.getRelatedJobsMultiSelectList.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useRelatedJobs(999, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    it('should refetch when jobId changes', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValue(mockRelatedJobs);

        const {result, rerender} = renderHook(
            ({jobId, isArchived}) => useRelatedJobs(jobId, isArchived),
            {
                wrapper: createWrapper(),
                initialProps: {jobId: 100, isArchived: false},
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(100, false, false, expect.anything());

        rerender({jobId: 200, isArchived: false});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(200, false, false, expect.anything());
        });
    });

    it('should refetch when isArchived changes', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValue(mockRelatedJobs);

        const {result, rerender} = renderHook(
            ({jobId, isArchived}) => useRelatedJobs(jobId, isArchived),
            {
                wrapper: createWrapper(),
                initialProps: {jobId: 100, isArchived: false},
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        rerender({jobId: 100, isArchived: true});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(100, true, false, expect.anything());
        });
    });
});
