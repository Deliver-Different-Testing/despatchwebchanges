import {useQuery} from '@tanstack/react-query';
import {fetchScanDetail, ScanDetailRecord} from '../../../api/jobSearchApi';
import {queryKeys} from '../../../api/queryClient';
import {formatDateForApiWithTzs} from '../../../utils/dateUtils';

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
        // A bulk job's runs share one id, so the run date has to be part of the key.
        queryKey: jobId
            ? [...queryKeys.jobSearch.scanDetail(jobId, isBulkJob), enabled ? formatDateForApiWithTzs(runDate as never) : null]
            : ['jobSearch', 'scanDetail', 'disabled'],
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
