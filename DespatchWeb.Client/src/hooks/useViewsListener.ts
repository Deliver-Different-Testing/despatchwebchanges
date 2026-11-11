import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {DfrntPageViewModel} from '../types/interfaces/dfrnt-page-view-model.interface';

/**
 * Mirrors the page's view selection into the host toolbar's Views menu: the
 * toolbar registers a listener and pushes its own changes back to the page.
 */
export function useViewsListener(
    pageViews: readonly DfrntPageViewModel[] | undefined,
    selectedViewIds: readonly number[],
    viewsLoading: boolean,
) {
    const decoratedViews = useMemo<DfrntPageViewModel[]>(
        () => (pageViews ?? []).map(v => ({...v, selected: selectedViewIds.includes(v.id)})),
        [pageViews, selectedViewIds],
    );
    const decoratedViewsRef = useRef(decoratedViews);
    const viewsListenerRef = useRef<((views: DfrntPageViewModel[]) => void) | null>(null);
    // Hold the first notification until the list has actually loaded, so the
    // toolbar menu keeps its spinner instead of flashing "No views yet".
    const viewsLoadedRef = useRef(false);
    viewsLoadedRef.current = !viewsLoading;
    useEffect(() => {
        decoratedViewsRef.current = decoratedViews;
        if (!viewsLoading) viewsListenerRef.current?.(decoratedViews);
    }, [decoratedViews, viewsLoading]);

    return useCallback((listener: (views: DfrntPageViewModel[]) => void) => {
        viewsListenerRef.current = listener;
        if (viewsLoadedRef.current) listener(decoratedViewsRef.current);
        return () => {
            if (viewsListenerRef.current === listener) viewsListenerRef.current = null;
        };
    }, []);
}
