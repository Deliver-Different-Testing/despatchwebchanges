# DespatchWeb tasks — create and stamp in the signed-in user's zone (Jacob + Garry)

**Date:** 23 Oct 2026 · **Owners:** Jacob (T1–T3, DespatchWeb) · Garry (T4–T5, SQL: dbmigrationsv2, live DB procs, driver-app writers) · **Baseline:** latest `master` on gitlab.com `deliver-different/despatchweb` at build time (read at `d96e4323`, 22 Oct).
**Context:** follows `TIMEZONE-AUDIT-2026-10-22.md` (branch `docs/timezone-audit-2026-10-22`) and the M0 spec `JACOB-DESPATCHWEB-TIMEZONE-M0-2026-10-22.md` (branch `docs/timezone-m0-2026-10-22`, coded by Jacob 22 Oct). Scope here is **tasks only** (`tucEvent` rows shown in the Tasks panel and Task Dashboard).

## The rule tasks must follow

A task's due time and its "sent" time are **tenant wall-clock** — the zone in the signed-in session's `TimeZone` claim (OTG = Eastern, Urgent = NZ). That is how the read side already works: `TaskRepository.GetAllTasksAsync` (`Repositories/TaskRepository.cs:62-83`) labels `UcevDueTime` with the tenant offset without converting it, and resolves "sent" from `ucevCreatedAtUtc` converted to tenant time. So every writer must store tenant wall-clock digits in `ucevDueTime` / `ucevDate` / `ucevTime`, and leave `ucevCreatedAtUtc` to its `GETUTCDATE()` default (or set it to UTC now).

Two writers break the rule today. Both were confirmed on 23 Oct.

## What is wrong

### W1 — "Add tasks" dialog stores the due time in UTC (DespatchWeb, Jacob)

Path: `EventGroupDialog.tsx` → `POST task/AddTasks` → `TaskRepository.CreateEventsForJobAsync`.

- `DespatchWeb.Client/src/components/dialogs/event-group-dialog/EventGroupDialog.tsx:97` sends `dueTime: dayjs(event.dueTime).format()`. That is the **browser's** offset (`+13:00` on a NZ PC, `-04:00` on an OTG dispatcher's PC), not the tenant's. Every other task write already goes through `formatDateForApi` (tenant zone): `tasksApi.ts:74-88` (`updateTaskDate` / `updateTaskTime`) and `add-event-dialog-react.module.tsx:53` (`eventDueDate: formatDateForApi(...)`).
- `Models/EventGroupViewModel.cs:13` declares `DateTime? DueTime`. With the app's Newtonsoft settings (`Program.cs:25-26`, `DateTimeZoneHandling.RoundtripKind`) an offset string bound to a `DateTime` is converted to **server local time**, and the pods run in UTC. Verified 23 Oct with a console harness on Newtonsoft.Json 13.0.3 and the same two settings:

  | Body `dueTime` | Bound `DateTime` (Kind=Local, pod is UTC) | What the dialog user meant |
  |---|---|---|
  | `2026-10-23T14:00:00+13:00` (NZ browser) | `2026-10-23 01:00` | 14:00 tenant time |
  | `2026-10-23T14:00:00-04:00` (Eastern browser) | `2026-10-23 18:00` | 14:00 tenant time |
  | same strings into `DateTimeOffset?` then `.DateTime` | `2026-10-23 14:00` | correct |

- `Repositories/TaskRepository.cs:432` stores it as-is: `UcevDueTime = eventGroup.DueTime ?? currentDate`. Result: an OTG dispatcher who picks 14:00 gets a task due **18:00 (EDT)** — UTC digits under a tenant label, four hours late; from a NZ browser the same pick lands thirteen hours early.
- The null branch is right (`currentDate` = `clock.TenantNow`), which is why tasks whose type has no default due offset look fine in prod. The bug only bites when a due time is set — by the user in the dialog, or by `GetEventTypeGroupsAsync` seeding `now.AddMinutes(x.DueTime)` (`TaskRepository.cs:348-355`) for types with a default offset.

### W2 — automation-created tasks are stamped with New Zealand time (SQL, Garry)

Read-only check on **OTG prod**, 23 Oct, `task/GetAllTasks` since 15 Sep 2026 (77 tasks, all with `ucevCreatedAtUtc`):

| Task type | Rows | `ucevDueTime` minus created (tenant time) | Writer |
|---|---|---|---|
| Job Completed (`ucevDescription` = "Automated job status notification") | 37 | **+17 h** | SQL, not DespatchWeb |
| Waiting to collect job - 5min | 5 | **+17 h** | driver app / MARS SQL |
| Web Updated | 1 | **+17 h** | SQL |
| Note to dispatch picked up | 34 | 0 h (correct) | DespatchWeb `AddEventAsync` (TenantNow) |

+17 h is exactly NZDT (+13) minus EDT (−4): the due time digits are New Zealand wall-clock, written by `GETDATE()` on the RDS instance (which is `New Zealand Standard Time` for every tenant — audit §3). OTG staging shows the same +17 h on the same four types. The same rows look fine on the Delivery Journey because that reads `ucevCreatedAtUtc`; the Tasks panel and Task Dashboard read `ucevDueTime`, so a job completed at 16:45 shows a task due **tomorrow 09:45** and sorts a day away from where the dispatcher expects it.

Where the stamps come from:

- **Not in `dbmigrationsv2`.** The string "Automated job status notification" appears in no migration and in no local repo (despatchweb, configurator, Adminmanagerupdate searched). `MARS_stpCourierSupportEvent_Insert` is referenced by `MARS_stpJob_CourierResponse_*` (`20261007153215_ReturnParentDriverAppPriceFix.sql:1366`: "tblEvent is stamped in server time by MARS_stpCourierSupportEvent_Insert") but is not defined in the repo. These are legacy procs that exist only on the live databases. Find them with:
  ```sql
  SELECT OBJECT_SCHEMA_NAME(object_id) + '.' + OBJECT_NAME(object_id) AS obj
  FROM sys.sql_modules
  WHERE definition LIKE '%tucEvent%'
    AND (definition LIKE '%GETDATE()%'
         OR definition LIKE '%Automated job status notification%'
         OR definition LIKE '%Job Not Ready%');
  ```
  Run on `otgcargo` prod and `urgent` prod; the OTG list is the fix list.
- **Column default.** `DF_tucEvent_ucevDueTime DEFAULT GETDATE()` (`20250506120606_FixTucEventDueTime.sql:29`, mirrored at `EntityClasses/DespatchContext.cs:5162`). Any insert that omits `ucevDueTime` gets NZ time. Two linehaul procs do (`MARSWS_stpLinehaulLocationReceipt` in `20260629210000`, the `MARSWS_stpLinehaulRegionList` family in `20260701140000`); the other eleven `MARSWS_stpLinehaul*` procs write `GETDATE()` explicitly for `ucevDate`, `ucevTime` and `ucevDueTime`. Linehaul is Urgent-only today, so those are right by accident, not by design.
- **`sp_AutomationEngine` is not the culprit** for the +17 h rows: it stamps `DATEADD(hour, m.TimeZoneOffset, @CurrentUTCDate)` from `TimeZoneEffective` (`20260812150000_AutomationEngineDstAwareOffsets.sql:630-655`), i.e. job-zone local. Its remaining weakness is the `@TenantTimeZoneOffSetHours` fallback (default `-5`) for jobs with no zone row — documented in that migration's header and deliberately left.
- The function to use exists: `dbo.UTL_GetTenantLocalDateTime()` (`20260324092120_FixGetTeanantTime.sql`) returns `GETUTCDATE() AT TIME ZONE 'UTC' AT TIME ZONE <TenantSettings.TimeZone>`. It falls back to **New Zealand** when the tenant has no `TenantSettings` row with `SettingKey = 'TimeZone'`, so step T4.1 below is to confirm that row exists on every tenant DB before anything depends on it.

### Checked and fine (no change)

- `InsertEventAsync` (`TaskRepository.cs:668-756`): `ucevDate`/`ucevTime`/fallback due = `clock.TenantNow`, `ucevCreatedAtUtc = clock.UtcNow`, `UcevDueTime = dueTime?.DateTime` on a `DateTimeOffset` that `formatDateForApi` already put in the tenant zone. All DespatchWeb-created tasks (Add event dialog, follow-up, restore, price-change, late calls) stamp correctly — the 34 "Note to dispatch picked up" rows above prove it.
- `UpdateEventDueTimeAsync` (`:136-170`) with `updateTaskDate`/`updateTaskTime`: the client derives the new value from the task's existing tenant-offset `dueDate` and relabels with the tenant zone. Correct.
- `tucEventAudit.uceaChangedAt`: `DateTime.UtcNow` in code, `GETUTCDATE()` default in SQL, converted on read (`DeliveryJourneyService.cs:321`). Correct.
- Labels: `TaskItem.tsx:113-114` computes the tenant abbreviation at module load. It is safe only because `main.tsx` awaits `/api/context` before importing `App`, and `TaskItem` sits in a lazy screen chunk. Fragile, not broken — T3 moves it inside the component.
- Session zone fallback: `getTenantTimezone()` (`dateUtils.ts:21`) and `GetTenantTimeZone()` (`TenantInfoService.cs:268`) both default to `UTC` when the claim is missing. That is the audit's "labelled UTC" case (F8/M2), not a task-creation defect; out of scope here.

## Changes

### T1 — Add tasks dialog sends the tenant zone; server binds `DateTimeOffset` (Jacob)

- `DespatchWeb.Client/src/components/dialogs/event-group-dialog/EventGroupDialog.tsx:97`: `dueTime: event.dueTime ? formatDateForApi(event.dueTime) : undefined`. `formatDateForApi` takes the wall-clock digits the user sees in the picker (browser-local `Date`) and labels them with the tenant's IANA zone — the same contract `add-event-dialog-react.module.tsx:53` uses. Import from `utils/dateUtils`.
- `Models/EventGroupViewModel.cs:13`: `public DateTimeOffset? DueTime { get; init; }`.
- `Repositories/TaskRepository.cs:432`: `UcevDueTime = eventGroup.DueTime?.DateTime ?? currentDate` (mirrors `:751`).
- `GetEventTypeGroupsAsync` (`:348-355`) keeps returning `now.AddMinutes(...)` as an unspecified `DateTime` — the browser parses it as local digits, the picker shows those digits, and T1 relabels them as tenant on save. Add a one-line comment there saying so, because it looks wrong.
- Tests:
  - `DespatchWeb.Client/src/components/dialogs/event-group-dialog/EventGroupDialog.test.tsx`: with session `timeZone: 'Eastern Standard Time'` and a fake browser zone of `Pacific/Auckland` (`process.env.TZ` in the jest config, or `dayjs.tz.setDefault`), pick 14:00 and assert `onSave` receives `dueTime` ending `-04:00` with `14:00:00` digits.
  - `DespatchWeb.Tests/Repositories/TaskRepositoryAddTests.cs`: `CreateEventsForJobAsync` with `DueTime = new DateTimeOffset(2026,10,23,14,0,0, TimeSpan.FromHours(-4))` stores `UcevDueTime == 2026-10-23 14:00`; with `DueTime = null` stores `TenantNow`.
  - `DespatchWeb.Tests/Controllers/TaskControllerTests.cs`: model-bind `{"dueTime":"2026-10-23T14:00:00+13:00"}` through the real `AddNewtonsoftJson` options and assert `DueTime.Value.DateTime == 14:00` (this is the regression the table above describes; it fails on `DateTime?`).

### T2 — One rule in one place (Jacob)

Add `TaskRepository.ToTenantWallClock(DateTimeOffset? value, DateTime fallback) => value?.DateTime ?? fallback` (internal static) and use it at `:432` and `:751`. Doc-comment it with the rule from the top of this spec so the next writer does not reach for `.UtcDateTime` or `.ToLocalTime()`.

### T3 — Task labels read the session at render time (Jacob, hygiene)

`TaskItem.tsx:113-114`: move `ianaTimeZone`/`timeZoneShort` into the component as `useMemo(() => getTimezoneAbbreviation(getIanaTimezone(getTenantTimezone())), [])`, the pattern `TaskHistory.tsx:141-144` already uses. No behaviour change today; removes the dependence on chunk load order.

### T4 — SQL writers stamp tenant local time (Garry, dbmigrationsv2 + live DB)

1. **Pre-check (SELECT only):** on every tenant DB, `SELECT SettingValue FROM dbo.TenantSettings WHERE SettingKey = 'TimeZone'`. Expected: a Windows id matching MC `Tenant.TimeZone` (otgcargo = `Eastern Standard Time`). Where the row is missing or wrong, that is its own small migration first — `UTL_GetTenantLocalDateTime()` silently returns NZ without it.
2. **Default constraint migration:** drop `DF_tucEvent_ucevDueTime`, re-add as `DEFAULT (dbo.UTL_GetTenantLocalDateTime())`. Schema-only; existing rows untouched. Regenerate the EF default string at `DespatchContext.cs:5162` (`HasDefaultValueSql("(dbo.UTL_GetTenantLocalDateTime())", ...)`) in the despatchweb repo in the same release so the model matches — or leave EF's string alone if the team does not run model diffs against this table (confirm with Jacob).
3. **Legacy writers (live DB, not in repo):** for each proc the `sys.sql_modules` query returns on `otgcargo` prod, replace `GETDATE()` in the `tucEvent` insert with `dbo.UTL_GetTenantLocalDateTime()` for `ucevDate`, `ucevTime`, `ucevDueTime` (and `ucevResponseTime` where set); leave `ucevCreatedAtUtc` to its default. Bring each proc into `dbmigrationsv2` as a `CREATE OR ALTER` migration while doing so, so the body is finally under source control. Start with whatever writes "Automated job status notification" (37 of 43 bad rows) and the Job Not Ready writer.
4. **Linehaul procs** (`MARSWS_stpLinehaul*`, 13 procs, Urgent-only): same substitution, lower priority — correct on Urgent today because tenant = NZ.
5. **Backfill (optional, OTG only, Garry to run):** rows where the writer stamped "now" can be corrected from the UTC column:
   ```sql
   UPDATE e
   SET ucevDueTime = CONVERT(DATETIME, ucevCreatedAtUtc AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time'),
       ucevDate    = CONVERT(DATETIME, ucevCreatedAtUtc AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time'),
       ucevTime    = CONVERT(DATETIME, ucevCreatedAtUtc AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time')
   FROM dbo.tucEvent e
   WHERE e.ucevCreatedAtUtc IS NOT NULL
     AND ABS(DATEDIFF(minute, DATEADD(hour, 17, e.ucevCreatedAtUtc), e.ucevDueTime)) <= 2  -- +13 NZDT vs -4 EDT: "due = created" written in NZ time
     AND e.ucevType IN (116, 87, 88, 89, 90, 91, 73);                                      -- Job Completed, Waiting to collect job *, Web Updated
   ```
   Re-check the `17` constant on the day it runs: NZ and US DST both move in early November, after which +13/−5 = 18 h. Steve decides whether the open-task noise is worth the write; closed rows can stay.

### T5 — `sp_AutomationEngine` fallback (Garry, later)

Replace `@TenantTimeZoneOffSetHours INT = -5` as the last `COALESCE` with the offset implied by `TenantSettings.TimeZone` (`TimeZoneEffective`-style `AT TIME ZONE` arithmetic), once T4.1 confirms the row exists everywhere. Already flagged in the 12 Aug migration header as "needs the TenantSettings audit first"; T4.1 is that audit.

## Acceptance

1. **OTG staging, job E2984D2D** (fixture from the M0 spec): Tasks → Add tasks → pick a group, set a due time of 14:00 today, save. The task shows **14:00 (EDT)** in the Tasks panel and Task Dashboard from (a) a browser set to Eastern and (b) a browser set to NZ. Today (b) shows 01:00 the same day and (a) shows 18:00.
2. Same job, Add event dialog with a due time: unchanged behaviour (already correct) — regression guard.
3. After T4.2 + T4.3 on OTG staging: complete a job from the driver app; the generated "Job Completed" task is due at the completion time in EDT, not +17 h. `SELECT TOP 5 ucevDueTime, ucevCreatedAtUtc FROM tucEvent ORDER BY ucevID DESC` shows `ucevDueTime = ucevCreatedAtUtc − 4 h` (− 5 h after 1 Nov).
4. Urgent staging: the same checks show NZ time with no label (NZ shows none); Urgent dispatchers see no change.
5. `cd DespatchWeb.Client && npx jest --no-coverage` green; `DespatchWeb.Tests.exe` green.

## Milestones

| M | Deliverable | Done when |
|---|---|---|
| T1 | Add-tasks dialog sends tenant zone; `DueTime` is `DateTimeOffset?`; three tests | Acceptance 1 on OTG staging from a NZ browser and an Eastern browser |
| T2 | `ToTenantWallClock` helper used at both insert sites | Tests from T1 still green; no `.DateTime` on request offsets outside the helper |
| T3 | `TaskItem` zone label computed at render | `TaskItem.test.tsx` passes with the session set after import |
| T4 | TenantSettings `TimeZone` row verified per tenant; `DF_tucEvent_ucevDueTime` → `UTL_GetTenantLocalDateTime()`; OTG legacy writers converted and committed to dbmigrationsv2; optional backfill | Acceptance 3 on OTG staging; `GetAllTasks` on OTG prod shows no new +17 h rows for a week after deploy |
| T5 | `sp_AutomationEngine` fallback from `TenantSettings.TimeZone` | Jobs with null zone ids on a non-NZ tenant get a local-time task |

## Not in this spec

Remain / AI "late" minutes against job-zone now (M1), one backend resolver + UTC fallback when the claim is missing (M2), `dbo.TimeZone` duplicate rows (M3), notes labelling and the Pickup Notes `TimeSpan.Zero` offset (M4) — all in the audit, decisions still owed by Steve.
