/**
 * Dispatch Views API Service
 *
 * Page views are admin-configured saved job filters (`tblDespatchView`) linked
 * to an app page. Selecting several scopes the job list to the union of their
 * filters. The server owns the definitions; the selection is per-user and lives
 * in localStorage (see `pages/dispatch/lib/dispatchFilters.ts`).
 */

import {apiClient} from './apiClient';
import type {DfrntPageViewModel} from '../../interfaces/dfrnt-page-view-model.interface';

/** Server shape — `selected` is client-only and never sent back. */
type PageViewResponse = Omit<DfrntPageViewModel, 'selected'>;

/** Load the views configured for an app page, all initially unselected. */
export async function fetchPageViews(pageId: number): Promise<DfrntPageViewModel[]> {
    const views = await apiClient.get<PageViewResponse[]>('home/GetPageViews', {pageId});
    return (views ?? []).map(view => ({...view, selected: false}));
}

export const dispatchViewsApi = {
    fetchPageViews,
};

export default dispatchViewsApi;
