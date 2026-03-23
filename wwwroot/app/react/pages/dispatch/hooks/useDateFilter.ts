/**
 * useDateFilter Hook
 *
 * Manages date filter state for the dispatch page.
 */

import {useCallback, useState} from 'react';
import type {DateFilterData} from '../../../components/common/app-toolbar/ToolbarActions';

const DATE_FILTER_STORAGE_KEY = 'dispatch_dateFilter';

export interface UseDateFilterReturn {
    dateFilterData: DateFilterData | null;
    onRefreshData: (data: DateFilterData) => void;
}

export function useDateFilter(): UseDateFilterReturn {
    const [dateFilterData, setDateFilterData] = useState<DateFilterData | null>(null);

    const onRefreshData = useCallback((data: DateFilterData) => {
        setDateFilterData(data);
        try {
            localStorage.setItem(DATE_FILTER_STORAGE_KEY, JSON.stringify({
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString(),
                useTime: data.useTime,
            }));
        } catch { /* ignore */ }
    }, []);

    return {dateFilterData, onRefreshData};
}
