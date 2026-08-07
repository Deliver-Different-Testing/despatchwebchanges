/**
 * Loads the page views configured for a dispatch-style page. The definitions
 * are admin data that changes rarely, so they are cached for the session and
 * shared by every consumer (the views rail and the host toolbar menu).
 */

import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {fetchPageViews} from '../../../services/dispatchViewsApi';
import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function useDispatchViews(pageId: number) {
    return useQuery<DfrntPageViewModel[]>({
        queryKey: queryKeys.dispatch.pageViews(pageId),
        queryFn: () => fetchPageViews(pageId),
        staleTime: FIFTEEN_MINUTES,
    });
}
