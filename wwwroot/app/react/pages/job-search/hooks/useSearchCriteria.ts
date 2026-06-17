import {useCallback, useMemo, useState} from 'react';
import dayjs, {Dayjs} from 'dayjs';
import JobSearchDateRange from '../../../../components/jobSearch/enums/JobSearchDateRange';
import {ISuggestion} from '../../../../interfaces/job.interface';
import {
    resolveDateRange,
    toSelectedIds,
} from '../lib/searchCriteria';

export interface JobSearchCriteria {
    clients: ISuggestion[];
    couriers: ISuggestion[];
    speeds: ISuggestion[];
    from_date: Dayjs;
    to_date: Dayjs;
    wild?: string;
    job?: string;
    jobId?: number;
    bulkJobId?: number;
}

export interface UseSearchCriteriaOptions {
    timeZone: string;
    initialDateRange?: JobSearchDateRange;
}

export interface UseSearchCriteriaResult {
    criteria: JobSearchCriteria;
    dateSearchRange: JobSearchDateRange;
    selectedClientIds: number[] | undefined;
    selectedCourierIds: number[] | undefined;
    selectedSpeedIds: number[] | undefined;
    setDateSearchRange: (range: JobSearchDateRange) => void;
    setFromDate: (date: Dayjs) => void;
    setToDate: (date: Dayjs) => void;
    setField: <K extends keyof JobSearchCriteria>(field: K, value: JobSearchCriteria[K]) => void;
}

function initialCriteria(timeZone: string, range: JobSearchDateRange): JobSearchCriteria {
    const resolved = resolveDateRange(range, timeZone);
    const now = dayjs();
    return {
        clients: [],
        couriers: [],
        speeds: [],
        from_date: resolved?.from_date ?? now.subtract(7, 'day'),
        to_date: resolved?.to_date ?? now.add(7, 'day'),
    };
}

export function useSearchCriteria({
    timeZone,
    initialDateRange = JobSearchDateRange.Fortnight,
}: UseSearchCriteriaOptions): UseSearchCriteriaResult {
    const [dateSearchRange, setDateSearchRangeState] = useState<JobSearchDateRange>(initialDateRange);
    const [criteria, setCriteria] = useState<JobSearchCriteria>(() => initialCriteria(timeZone, initialDateRange));

    const setField = useCallback(
        <K extends keyof JobSearchCriteria>(field: K, value: JobSearchCriteria[K]) => {
            setCriteria(prev => ({...prev, [field]: value}));
        },
        [],
    );

    const setDateSearchRange = useCallback((range: JobSearchDateRange) => {
        setDateSearchRangeState(range);
        const resolved = resolveDateRange(range, timeZone);
        if (resolved) {
            setCriteria(prev => ({...prev, from_date: resolved.from_date, to_date: resolved.to_date}));
        }
    }, [timeZone]);

    const setFromDate = useCallback((date: Dayjs) => {
        if (!date.isValid()) return;
        setCriteria(prev => ({...prev, from_date: date.startOf('day')}));
    }, []);

    const setToDate = useCallback((date: Dayjs) => {
        if (!date.isValid()) return;
        setCriteria(prev => ({...prev, to_date: date.startOf('day')}));
    }, []);

    const selectedClientIds = useMemo(() => toSelectedIds(criteria.clients), [criteria.clients]);
    const selectedCourierIds = useMemo(() => toSelectedIds(criteria.couriers), [criteria.couriers]);
    const selectedSpeedIds = useMemo(() => toSelectedIds(criteria.speeds), [criteria.speeds]);

    return {
        criteria,
        dateSearchRange,
        selectedClientIds,
        selectedCourierIds,
        selectedSpeedIds,
        setDateSearchRange,
        setFromDate,
        setToDate,
        setField,
    };
}
