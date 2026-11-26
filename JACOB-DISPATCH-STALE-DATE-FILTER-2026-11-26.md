# Dispatch: an old saved date range must not hide today's jobs

**Owner:** Jacob
**Date:** 26 November 2026
**Size:** small fix, front end only
**Repo:** despatchweb, branch off `develop` (checked at `a02e8f116`, 26 Nov; the same code is on `master`)
**Reported by:** Ralph Perrothers, OTG Cargo, 25 Nov ("Dispatch screen under my login is not working. I cannot see jobs.")

## What happened

Ralph opened Dispatch on OTG prod and saw no jobs. He logged out and back in twice. Still no jobs. Steve logged in as Ralph in an incognito window and everything worked.

Ralph's browser had a **Custom dates** range of 21 to 23 November saved. Dispatch restored it on every load, so on 25 November it asked the server for jobs in 21 to 23 November and got none.

OTG prod log group `despatchweb-594-otgcargo-prod`, 25 Nov UTC, Dispatch user 13 (Ralph):

```
20:10:50  Job list query completed - returned 0 jobs, 0 total (Views: 51,59, DateRange: 2026-11-21 to 2026-11-23)
20:13:19  returned 0 jobs, 0 total (Views: 51,59, DateRange: 2026-11-21 to 2026-11-23)   <- 5s after Hub login 20:13:14
20:58:26  returned 0 jobs, 0 total (Views: 51, DateRange: 2026-11-21 to 2026-11-23)
20:59:41  returned 0 jobs, 0 total (Views: , DateRange: 2026-11-21 to 2026-11-23)
```

Same user from the incognito window, 26 Nov 01:49 UTC:

```
returned 23 jobs, 23 total (Views: 51, DateRange: 1969-12-31 to 2026-11-26)
```

No server errors. Other OTG users were loading 30+ jobs throughout.

## Why (code on develop)

- The applied range is saved in `localStorage` under `dateFilter-<page>-<contactId>` and the chosen option under `dateRangeOption-<page>-<contactId>`.
  - `DespatchWeb.Client/src/pages/dispatch/lib/dispatchFilters.ts:26` (`DATE_FILTER_KEY`), `loadDateFilter()`.
  - `DespatchWeb.Client/src/utils/dateFilterStorage.ts` `loadDateFilterFrom()`.
  - `DespatchWeb.Client/src/components/common/date-filter-menu/DateFilterMenu.tsx:105` (`storageKey`).
- `loadDateFilterFrom()` only recomputes the end date when the start is epoch ("All time"). A **Custom dates** range with real dates is restored exactly as saved, for ever.
- `DateFilterMenu` on init: for `custom_date` it returns early because "the parent already restored the applied range". Nothing checks whether that range is in the past.
- The keys are per contact, so logging out and in again restores the same range. Only clearing site data, or incognito, gets rid of it.
- The toolbar gives no sign that a custom range is active. The control is a plain calendar icon (`aria-label="Date filter"`). The range text (`rangeSummary`) only shows after the popover is opened.
- The empty grid says "No jobs found / No jobs match the current view." (`components/job-list/JobListTable.tsx:441`). It does not mention dates or offer a way out. Job Search already does this properly through `searchNoticeEmptyState` in `components/job-list/jobSearchNotice.ts` ("No jobs in these dates" plus an action button).

The same storage helper is used by the Domestic page (`pages/nationwide/lib/dateFilter.ts`, `NationwideScreen.tsx:44`), so it has the same fault.

## The fix

### 1. A saved Custom dates range expires when it is in the past

In `loadDateFilterFrom()` (so Dispatch and Domestic both get it):

- If the stored start is not epoch and the stored **end date is before the start of today** in the tenant time zone, do not restore it. Return the defaults (All time), remove the stored range, and set `dateRangeOption-…` to `all_time`.
- Return a flag (for example `expiredRange: {startDate, endDate}`) so the page can tell the user once: toast "Your saved date range (21 Nov to 23 Nov) has ended. Showing all jobs."
- A custom range that still includes today or a future date is restored as now.

This only runs on page load. A dispatcher who picks past dates on purpose keeps them until they reload or come back another time.

### 2. Show when a date filter is active

In `DateFilterMenu`, when the option is anything other than **All time**:

- Give the calendar button the filled / active style.
- Show the range beside it as a small chip, using the existing `rangeSummary` text (for example "Nov 21, 2026 — Nov 23, 2026", "Today", "Next 3 hours"), with a clear (x) that sets it back to All time.

### 3. Say why the grid is empty, and offer the way out

On Dispatch and Domestic, when the job list returns 0 jobs and the date option is not **All time**, replace "No jobs found" with:

- Title: `No jobs in these dates`
- Message: `The date filter is set to <range>.`
- Action: `Show all dates` (sets All time and refetches).

Follow the shape of `searchNoticeEmptyState`. Keep "No jobs match the current view." for an All-time list that is genuinely empty.

### 4. Tests

- `dateFilterStorage`: stored custom range ending yesterday returns defaults, clears the key and reports `expiredRange`; a range ending today or later is restored; epoch start still recomputes the end.
- `DateFilterMenu`: chip shows for Today / Time range / Custom dates and not for All time; clear sets All time and writes the key.
- Job list: 0 jobs with a custom range shows "No jobs in these dates" and the action resets the range.

## Out of scope

- Moving the date filter to server-side user preferences.
- Changing the default range.

## Milestones

| Key | Title | Done when |
|---|---|---|
| M0 | Reproduce on OTG staging | A Custom dates range ending in the past is saved, the page is reloaded the next day (or with the stored end date edited back), and Dispatch shows no jobs with no explanation. Posted in Slack. |
| M1 | Past custom range expires | `loadDateFilterFrom()` drops a custom range that ended before today, resets to All time and the page shows the one-off toast. Works on Dispatch and Domestic. |
| M2 | Active filter is visible | The calendar button is highlighted and a chip shows the range with a clear (x) whenever the option is not All time. |
| M3 | Empty state explains itself | 0 jobs with a date filter shows "No jobs in these dates" with "Show all dates". |
| M4 | Tests and staging check | Tests in section 4 pass. On OTG staging the M0 steps now land on All time with the toast. |
