/**
 * Persisted date-range filter for Nationwide, shared between the React page
 * and the AngularJS `nationwide` route state so both read/write the same key.
 * Mirrors `pages/dispatch/lib/dispatchFilters.ts`'s `DATE_FILTER_KEY`/`loadDateFilter`.
 */

import {getContactId} from '../../../api/session';
import {AppPage as LegacyAppPage} from '../../../types/enums/app-pages.enum';
import {loadDateFilterFrom, type StoredDateFilter} from '../../../utils/dateFilterStorage';

/** The date menu's `appPage` on Nationwide, which keys its saved option. */
export const DATE_MENU_PAGE = 'nationwide';
export const DATE_FILTER_KEY = () => `dateFilter-${LegacyAppPage.Domestic}-${getContactId()}`;

export function loadNationwideDateFilter(timeZone?: string): StoredDateFilter {
    return loadDateFilterFrom(DATE_FILTER_KEY(), {timeZone, appPage: DATE_MENU_PAGE});
}
