/**
 * usePageViews Hook
 *
 * Fetches and manages dispatch page views (geographic view filters).
 */

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {getPageViews, type DfrntPageViewModel} from '../../../services/dispatchApi';
import type {View} from '../../../components/common/app-toolbar/ToolbarActions';

const VIEWS_STORAGE_KEY = 'dispatch_selectedViews';

function loadSelectedViewIds(): Set<number> {
    try {
        const stored = localStorage.getItem(VIEWS_STORAGE_KEY);
        if (stored) return new Set(JSON.parse(stored));
    } catch { /* ignore */ }
    return new Set();
}

function saveSelectedViewIds(ids: Set<number>): void {
    try {
        localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
}

export interface UsePageViewsReturn {
    views: View[] | null;
    loading: boolean;
    selectedViewIds: number[];
    toggleView: (view: View) => void;
    clearAll: () => void;
}

export function usePageViews(): UsePageViewsReturn {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(loadSelectedViewIds);

    const {data, isLoading} = useQuery({
        queryKey: queryKeys.dispatch.pageViews,
        queryFn: () => getPageViews(),
    });

    // Auto-select all views when API data arrives and nothing is saved yet.
    // Without this, an empty selectedIds sends despatchViewIds=[] to the API
    // which returns zero jobs.
    useEffect(() => {
        if (data && data.length > 0 && selectedIds.size === 0) {
            const allIds = new Set(data.map((v: DfrntPageViewModel) => v.id));
            setSelectedIds(allIds);
            saveSelectedViewIds(allIds);
        }
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    const views = useMemo<View[] | null>(() => data
        ? data.map((v: DfrntPageViewModel) => ({
            id: v.id,
            name: v.name,
            selected: selectedIds.has(v.id),
        }))
        : null, [data, selectedIds]);

    const toggleView = useCallback((view: View) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(view.id)) {
                next.delete(view.id);
            } else {
                next.add(view.id);
            }
            saveSelectedViewIds(next);
            return next;
        });
    }, []);

    const clearAll = useCallback(() => {
        setSelectedIds(new Set());
        saveSelectedViewIds(new Set());
    }, []);

    const selectedViewIds = useMemo(() => [...selectedIds], [selectedIds]);

    return {views, loading: isLoading, selectedViewIds, toggleView, clearAll};
}
