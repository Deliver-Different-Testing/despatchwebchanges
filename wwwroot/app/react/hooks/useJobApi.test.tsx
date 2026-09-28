/**
 * useJobApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {useRelatedJobs, useClientSearch} from './useJobApi';
import {jobApi} from '../services/jobApi';
import {RelatedJobDto, Suggestion} from '../interfaces';
import {createQueryWrapper} from '../__testUtils__';

// Mock the jobApi
jest.mock('../services/jobApi', () => ({
    jobApi: {
        getRelatedJobsMultiSelectList: jest.fn(),
        searchActiveClients: jest.fn(),
    },
}));

const mockJobApi = jobApi as jest.Mocked<typeof jobApi>;

describe('useRelatedJobs', () => {
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

        const {result} = renderHook(() => useRelatedJobs(100, false), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(100, false, false, expect.anything());
        expect(result.current.data).toEqual(mockRelatedJobs);
    });

    it('should fetch related jobs for archived job', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValueOnce(mockRelatedJobs);

        const {result} = renderHook(() => useRelatedJobs(200, true), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.getRelatedJobsMultiSelectList).toHaveBeenCalledWith(200, true, false, expect.anything());
    });

    it('should not fetch when jobId is 0', async () => {
        renderHook(() => useRelatedJobs(0, false), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when jobId is negative', async () => {
        renderHook(() => useRelatedJobs(-1, false), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useRelatedJobs(100, false, {enabled: false}), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(mockJobApi.getRelatedJobsMultiSelectList).not.toHaveBeenCalled();
        });
    });

    it('should handle empty results', async () => {
        mockJobApi.getRelatedJobsMultiSelectList.mockResolvedValueOnce([]);

        const {result} = renderHook(() => useRelatedJobs(100, false), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it('should handle errors', async () => {
        const error = new Error('Job not found');
        mockJobApi.getRelatedJobsMultiSelectList.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useRelatedJobs(999, false), {wrapper: createQueryWrapper()});

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
                wrapper: createQueryWrapper(),
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
                wrapper: createQueryWrapper(),
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

describe('useClientSearch', () => {
    const mockClients: Suggestion[] = [
        {id: 1, text: 'ACM Acme Corp'},
        {id: 2, text: 'ACM Acme Industries'},
    ];

    it('should fetch clients when search text is 3+ characters', async () => {
        mockJobApi.searchActiveClients.mockResolvedValueOnce(mockClients);

        const {result} = renderHook(() => useClientSearch('Acme'), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.searchActiveClients).toHaveBeenCalledWith('Acme', expect.anything());
        expect(result.current.data).toEqual(mockClients);
    });

    it('should not fetch when search text is less than 3 characters', async () => {
        const {result} = renderHook(() => useClientSearch('Ab'), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe('idle');
        });

        expect(mockJobApi.searchActiveClients).not.toHaveBeenCalled();
    });

    it('should not fetch when search text is empty', async () => {
        renderHook(() => useClientSearch(''), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(mockJobApi.searchActiveClients).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useClientSearch('Acme', {enabled: false}), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(mockJobApi.searchActiveClients).not.toHaveBeenCalled();
        });
    });

    it('should refetch when search text changes', async () => {
        mockJobApi.searchActiveClients.mockResolvedValue(mockClients);

        const {result, rerender} = renderHook(
            ({searchText}) => useClientSearch(searchText),
            {
                wrapper: createQueryWrapper(),
                initialProps: {searchText: 'Acme'},
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockJobApi.searchActiveClients).toHaveBeenCalledWith('Acme', expect.anything());

        rerender({searchText: 'Beta'});

        await waitFor(() => {
            expect(mockJobApi.searchActiveClients).toHaveBeenCalledWith('Beta', expect.anything());
        });
    });
});
