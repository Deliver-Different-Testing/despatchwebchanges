/**
 * The paging props every driver-management tab hands its DataTable. Each tab owns its own
 * query type but pages it the same way, so the five copies of these four props live here.
 */

import type {Dispatch, SetStateAction} from 'react';

interface PagedQuery {
    page?: number;
    pageSize: number;
}

export function dataTablePagingProps<TQuery extends PagedQuery>(
    query: TQuery,
    setQuery: Dispatch<SetStateAction<TQuery>>,
) {
    return {
        page: query.page || 1,
        pageSize: query.pageSize,
        onPageChange: (page: number) => setQuery(q => ({...q, page})),
        // A new page size restarts at the first page — the old offset means nothing now.
        onPageSizeChange: (pageSize: number) => setQuery(q => ({...q, pageSize, page: 1})),
    };
}
