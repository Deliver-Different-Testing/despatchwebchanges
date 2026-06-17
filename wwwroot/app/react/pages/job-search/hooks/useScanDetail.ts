import {useQuery} from '@tanstack/react-query';
import {fetchScanDetail, ScanDetailRecord} from '../../../services/jobSearchApi';
import {queryKeys} from '../../../query/queryClient';

export interface UseScanDetailOptions {
    jobId?: number;
    runDate?: unknown;
    isBulkJob?: boolean;
}

export interface UseScanDetailResult {
    scans: ScanDetailRecord[];
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}

export function useScanDetail({jobId, runDate, isBulkJob = false}: UseScanDetailOptions): UseScanDetailResult {
    const enabled = !!jobId && !!runDate;

    const {data, isLoading, isError, refetch} = useQuery({
        queryKey: jobId ? queryKeys.jobSearch.scanDetail(jobId, isBulkJob) : ['jobSearch', 'scanDetail', 'disabled'],
        queryFn: ({signal}) => fetchScanDetail(runDate, jobId as number, isBulkJob, {signal}),
        enabled,
        staleTime: 15_000,
    });

    return {
        scans: data ?? [],
        isLoading,
        isError,
        refetch,
    };
}
