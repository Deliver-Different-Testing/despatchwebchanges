/**
 * Persisted date-range filter for Nationwide, shared between the React page
 * and the AngularJS `nwV2` route state so both read/write the same key.
 * Mirrors `pages/dispatch/lib/dispatchFilters.ts`'s `DATE_FILTER_KEY`/`loadDateFilter`.
 */

import {ContactID} from '../../../../contants';
import {AppPage as LegacyAppPage} from '../../../../enums/app-pages.enum';
import {loadDateFilterFrom, type StoredDateFilter} from '../../../utils/dateFilterStorage';

export const DATE_FILTER_KEY = `dateFilter-${LegacyAppPage.Domestic}-${ContactID}`;

export function loadNationwideDateFilter(timeZone?: string): StoredDateFilter {
    return loadDateFilterFrom(DATE_FILTER_KEY, {timeZone});
}
