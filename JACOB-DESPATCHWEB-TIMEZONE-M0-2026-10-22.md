# DespatchWeb timezone M0 — stop the bleeding (Jacob)

**Date:** 22 Oct 2026 · **Owner:** Jacob · **Baseline:** latest `master` on gitlab.com `deliver-different/despatchweb` at build time (audit was done at `a01419d0`, 18 Oct; frontend is `DespatchWeb.Client/src`).
**Source:** `TIMEZONE-AUDIT-2026-10-22.md` on this repo, branch `docs/timezone-audit-2026-10-22` (findings F1, F2, F5, F7, F12, F13). Read §2 of the audit first: job times are naive wall-clock in the job's own zone, the tenant zone only labels tenant-side things.

## Why now

OTG (tenant zone Eastern) keeps reporting wrong zones in DespatchWeb. Screenshot P3779V: header `Oct/21 07:00 (EDT)`, "Pickup arrival time" dialog `04:50` with "Job timezone: Pacific Daylight Time". Three independent defects line up in that picture. All are frontend and fixable without an API or schema change. One backend null guard rides along because Urgent prod is throwing on it daily (66 times 8–21 Oct) even though Urgent has no display problem.

## Scope

In: F1 dialog zone frozen, F2 list label uses tenant zone, F7 abbreviation computed for today, F12/F13 hygiene in the same files, F5 null guard.
Out (M1+): now-in-job-zone for `Remain` / AI signals, resolver consolidation, `dbo.TimeZone` dedupe, `GETDATE()` columns, notes labelling, zones never null at creation.

## Changes

### C1 — `EditDateTimeDialog` takes its zone from props on every open (F1, F13)

`DespatchWeb.Client/src/components/dialogs/edit-date-time-dialog/EditDateTimeDialog.tsx`

- Today (`:56-59`): `resolvedTz` is computed from `defaultTimeZone`, then `const [selectedTimeZone] = useState(resolvedTz || getIanaTimezone())`. The host (`utils/reactDialogHost.tsx:73`) calls `root.render` with the same element and new props on every `open()`, so the `useState` initialiser only ever runs once per page and the zone is whatever the first dialog of the session used.
- Change: drop the `useState`. `const selectedTimeZone = useMemo(() => resolvedTz || getIanaTimezone(), [resolvedTz]);` and add `selectedTimeZone` to the seed effect deps (`:62-74`) so an empty field is seeded with now in the *current* job's zone.
- Type: `defaultTimeZone?: string | {text?: string}` in `types.ts` (`EditDateTimeDialogProps` and `EditDateTimeDialogOptions`) and in `services/editDateTimeDialogService.ts`. Remove the three `as any` casts in `components/common/job-details/hooks/useJobActions.ts:375,475,691`. Keep the duck-typing in the dialog (it is now the declared contract).
- Tests (`EditDateTimeDialog.test.tsx`): add one that renders with `defaultTimeZone: 'America/Los_Angeles'`, re-renders the same tree with `defaultTimeZone: 'America/New_York'` and `open: true`, and asserts (a) the zone panel reads "Eastern Daylight Time"/"Eastern Standard Time", (b) `onSubmit` result `timezone === 'America/New_York'`, (c) with `dateTime: undefined` the seeded hour equals `dayjs().tz('America/New_York').hour()`. Reuse the pattern at `:458-470`.

### C2 — Job list Time column shows the job's zone (F2)

`DespatchWeb.Client/src/components/job-list/JobListTable.tsx`

- Today: `getTimeZoneShort()` (`:99-106`, module-level cache of the tenant abbreviation) and `formatJobTime(booked)` (`:131-136`) append it to every row. `MetricsGrid.tsx:135-152` on the same job uses `job._pickUpTimeZoneStr`.
- Change: `formatJobTime(booked, jobTz?: string)` → label = `jobTz ?? getTimeZoneShort()`. Every caller passes `job._pickUpTimeZoneStr` (already on `DispatchJob`, set in `utils/dtoMappings.ts:168,189`). An empty string from a NZ job must stay empty, so the fallback is `??`, not `||`.
- One component, four pages (Dispatch, Current Work, Nationwide, Job Search) pick it up.
- Test (`JobListTable.test.tsx`): a row with `_pickUpTimeZoneStr: '(EDT)'` on a session whose `timeZone` is `Pacific Standard Time` renders `07:00 (EDT)`, and a row with `_pickUpTimeZoneStr: undefined` renders the tenant label.

### C3 — One abbreviation function, computed for the job's date (F7)

- `DespatchWeb.Client/src/utils/dateUtils.ts:268-298` `getTimezoneAbbreviation(timezone, at?: Date | Dayjs)`: use `at ?? new Date()` in `Intl.DateTimeFormat(...).format(...)`; drop the `now.tz(...)` round-trip (the formatter already takes the instant). Keep the NZ short-circuit and the `(${timezone})` fallback.
- `DespatchWeb.Client/src/utils/timezoneShort.ts` is the same function with the same bug. Delete it; `utils/dtoMappings.ts:168,189` call `getTimezoneAbbreviation(dto.pickUpTimeZone.text, booked)` / `(dto.deliveryTimeZone.text, deliverByTime ?? booked)`. Move the two cases in `timezoneShort.spec.ts` into `dateUtils.test.ts`.
- Call sites that label a job time pass that time (`MetricsGrid.tsx`, `RecurringJobFields.tsx`, `RecurringJourneyRunRow.tsx`, `PodPhotoViewer.tsx`, `TaskItem.tsx`, `TaskHistory.tsx`, `EventGroupDialog.tsx`, `NoteManagementDialog.tsx`, `jobChangeRequestFormatting.ts`). Call sites that label "now" (`JobListTable.getTimeZoneShort`, `JobDetails.tsx` read-tracker line) stay as they are.
- Test (`dateUtils.test.ts`): `getTimezoneAbbreviation('America/New_York', dayjs('2026-01-15'))` → `(EST)`, same zone with `dayjs('2026-07-15')` → `(EDT)`, `'Pacific/Auckland'` → `''`.

### C4 — `isUSCustomer` defaults agree (F12)

- `DespatchWeb.Client/src/utils/dateUtils.ts:29` returns `getSession().isUsCustomer ?? true`; `components/dialogs/edit-date-time-dialog/edit-date-time-dialog-react.module.tsx:61` falls back to `getIsUSCustomer()` which defaults `false`. Pick one. Recommendation: `false` everywhere (NZ is the base case, a missing session should not show the US zone panel) — change `dateUtils.ts:29` to `?? false` and fix whichever tests relied on `true`.

### C5 — `GetCurrentTimeFromTimeZone` null-safe (F5, backend, one method)

`Services/TenantInfoService.cs:153-163`

```csharp
public DateTime GetCurrentTimeFromTimeZone(TimeZone? timeZone)
{
    if (timeZone is null || string.IsNullOrWhiteSpace(timeZone.Name))
    {
        return GetCurrentTenantTime();
    }
    var cacheKey = $"timezone_info_{timeZone.Name}";
    var timeZoneInfo = cache.GetOrCreate(cacheKey, entry =>
    {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1);
        return ResolveTimeZoneInfo(timeZone.Name);   // existing private helper at :95, already IANA/Windows tolerant, UTC on unknown
    });
    return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZoneInfo);
}
```

- Update the parameter on `Interfaces/ITenantInfoService.cs:10` to `TimeZone?`. Callers (`JobRepository.EditOperations.cs:512,521,529,541,889,909`, `JobRepository.cs:6047`) need no change.
- Prod evidence: CloudWatch `despatchweb-594-urgent-prod`, stack `TenantInfoService.cs:155 ← JobRepository.ParsePodTime ← UpdatePodDetailsAsync` (42×) and `← UpdateTucJobWithEntityAsync :520` (24×), 8–21 Oct. Urgent has 6,350 live jobs with null `PickupTimeZoneId`/`DeliverByTimeZoneId`.
- Tests (`DespatchWeb.Tests/Services/TenantInfoServiceTests.cs`, NSubstitute): null → tenant time; `Name = "America/New_York"` and `Name = "Eastern Standard Time"` both resolve; `Name = "Nope/Zone"` → UTC (not a throw).

## Acceptance

1. OTG, job P3779V-style (pickup zone `America/New_York`, delivery zone `America/Los_Angeles`): open "Deliver by" (shows Pacific), close, open "Pickup arrival time" → shows Eastern; with the field empty the seeded time is now in Eastern.
2. Same job: list row and detail header show the same abbreviation; a NZ job on an Urgent session shows none.
3. Any job dated 15 Jan viewed in October shows `(EST)` in list and detail.
4. Urgent: POD save and Delivered on a job with null zone ids succeeds, stamps tenant-zone time, and `despatchweb-594-urgent-prod` shows no new `GetCurrentTimeFromTimeZone` null references after deploy.
5. `cd DespatchWeb.Client && npx jest --no-coverage` green; `DespatchWeb.Tests.exe` green (xUnit v3 executable, not `dotnet test`).

## Milestones

| M | Deliverable | Done when |
|---|---|---|
| M0.1 | C1 dialog zone per open + type fix | New two-open test passes; acceptance 1 on staging OTG |
| M0.2 | C2 list label from job zone | `JobListTable.test.tsx` cases pass; acceptance 2 |
| M0.3 | C3 single abbreviation function with date; `timezoneShort.ts` deleted | `dateUtils.test.ts` EST/EDT cases pass; acceptance 3 |
| M0.4 | C4 + C5 | `TenantInfoServiceTests` null/unknown cases pass; acceptance 4 after prod deploy (note the despatchweb prod deploy is a manual pipeline gate) |

## Not in this spec, on purpose

Remain / AI "late" minutes against job-zone now, one backend resolver, `dbo.TimeZone` duplicate rows, `GETDATE()` columns on a NZ instance, notes and tasks labelled with the tenant zone. All in the audit M1–M4 with decisions still owed by Steve.
