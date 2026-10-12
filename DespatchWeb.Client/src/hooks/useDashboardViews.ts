/**
 * Loads the page views configured for a dashboard-style page (Dispatch,
 * Nationwide, ...). The definitions are admin data that changes rarely, so
 * they are cached for the session and shared by every consumer (the views
 * rail and the host toolbar menu).
 */

import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../api/queryClient';
import {fetchPageViews} from '../api/dispatchViewsApi';
import type {DfrntPageViewModel} from '../types/interfaces/dfrnt-page-view-model.interface';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function useDashboardViews(pageId: number) {
    return useQuery<DfrntPageViewModel[]>({
        queryKey: queryKeys.dispatch.pageViews(pageId),
        queryFn: () => fetchPageViews(pageId),
        staleTime: FIFTEEN_MINUTES,
    });
}
