/**
 * useSupportTasks Hook
 *
 * Fetches and manages support tasks for the selected job.
 * Supports filtering by staff and event type.
 */

import {useCallback, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {getAllTasks, getActiveStaff, getEventTypes, markTaskAsClosed} from '../../../services/tasksApi';
import type {StaffSuggestion, EventTypeSuggestion} from '../../../interfaces';

export interface UseSupportTasksReturn {
    tasks: any[];
    loading: boolean;
    refetch: () => void;
    staffList: StaffSuggestion[];
    eventTypeList: EventTypeSuggestion[];
    selectedStaffId: number | undefined;
    selectedEventTypeId: number | undefined;
    setStaffId: (id: number | undefined) => void;
    setEventTypeId: (id: number | undefined) => void;
    closeTask: (taskId: number) => Promise<void>;
}

const STAFF_FILTER_KEY = 'dispatch_supportStaffFilter';
const EVENT_TYPE_FILTER_KEY = 'dispatch_supportEventTypeFilter';

function loadStoredFilter(key: string): number | undefined {
    try {
        const val = localStorage.getItem(key);
        if (val && val !== 'all') return parseInt(val, 10);
    } catch { /* ignore */ }
    return undefined;
}

export function useSupportTasks(jobId: number | null, enabled = true): UseSupportTasksReturn {
    const [selectedStaffId, setStaffIdState] = useState<number | undefined>(() => loadStoredFilter(STAFF_FILTER_KEY));
    const [selectedEventTypeId, setEventTypeIdState] = useState<number | undefined>(() => loadStoredFilter(EVENT_TYPE_FILTER_KEY));

    const {data, isLoading, refetch} = useQuery({
        queryKey: queryKeys.tasks.list({
            jobId: jobId ?? undefined,
            staffId: selectedStaffId,
            eventTypeId: selectedEventTypeId,
        }),
        queryFn: () => getAllTasks({
            jobId: jobId ?? undefined,
            staffId: selectedStaffId,
            eventTypeId: selectedEventTypeId,
        }),
        enabled: enabled && jobId != null,
    });

    const {data: staffList} = useQuery({
        queryKey: queryKeys.tasks.staff,
        queryFn: () => getActiveStaff(),
        enabled,
    });

    const {data: eventTypeList} = useQuery({
        queryKey: queryKeys.tasks.eventTypes,
        queryFn: () => getEventTypes(),
        enabled,
    });

    const setStaffId = useCallback((id: number | undefined) => {
        setStaffIdState(id);
        try { localStorage.setItem(STAFF_FILTER_KEY, id?.toString() ?? 'all'); } catch { /* ignore */ }
    }, []);

    const setEventTypeId = useCallback((id: number | undefined) => {
        setEventTypeIdState(id);
        try { localStorage.setItem(EVENT_TYPE_FILTER_KEY, id?.toString() ?? 'all'); } catch { /* ignore */ }
    }, []);

    const closeTask = useCallback(async (taskId: number) => {
        await Promise.all([markTaskAsClosed(taskId, true), refetch()]);
    }, [refetch]);

    return {
        tasks: data ?? [],
        loading: isLoading,
        refetch: () => { return refetch(); },
        staffList: staffList ?? [],
        eventTypeList: eventTypeList ?? [],
        selectedStaffId,
        selectedEventTypeId,
        setStaffId,
        setEventTypeId,
        closeTask,
    };
}
