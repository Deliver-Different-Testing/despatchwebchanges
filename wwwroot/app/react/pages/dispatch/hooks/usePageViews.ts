/**
 * usePageViews Hook
 *
 * Fetches and manages dispatch page views (geographic view filters).
 */

import {useCallback, useState} from 'react';
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

    const views: View[] | null = data
        ? data.map((v: DfrntPageViewModel) => ({
            id: v.id,
            name: v.name,
            selected: selectedIds.has(v.id),
        }))
        : null;

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

    const selectedViewIds = [...selectedIds];

    return {views, loading: isLoading, selectedViewIds, toggleView, clearAll};
}
