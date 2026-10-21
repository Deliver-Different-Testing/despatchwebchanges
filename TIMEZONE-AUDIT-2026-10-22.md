# DespatchWeb timezone audit — 2026-10-22

Audited at GitHub mirror `main` `5baf3565` (19 Oct 2026) = gitlab.com `deliver-different/despatchweb` master `a01419d0` (18 Oct) plus mirror merges; develop = master. The old CustomD remote (`git.customd.com`) stopped at `db2ea48d` on 6 Oct and is stale. Frontend is the Vite SPA under `DespatchWeb.Client/src`.

Trigger: continual OTG reports of times showing in the wrong zone. Example screenshot = job P3779V (Carlstadt NJ, Eastern) whose header reads `Oct/21 07:00 (EDT)` while the "Pickup arrival time" dialog reads `04:50` with "Job timezone: Pacific Daylight Time".

## 1. What the screenshot actually shows

Three separate defects line up in that one picture:

| What you see | Cause | Finding |
|---|---|---|
| Dialog says **Pacific** for an **Eastern** job | `EditDateTimeDialog` stores the zone in `useState` once on first mount and the dialog host re-renders the same component for every later open, so the zone is frozen at whatever the first dialog of the session used (tenant zone when a field had no zone). | F1 |
| Dialog seeded with **04:50** | Empty field → seeded with `dayjs().tz(selectedTimeZone)` = now in that frozen Pacific zone; 04:50 PDT = 07:50 EDT. | F1 |
| Current-work / job list rows show `07:00 (P…` while the detail shows `07:00 (EDT)` | The list labels every row with the **tenant** zone abbreviation; the detail uses the **job's** zone. Same wall-clock, two labels. | F2 |

## 2. The model as it actually is (not as anyone documented it)

- **Job times are naive wall-clock in the job's own zone.** `tucJob.UcjbDate/UcjbTime`, `PickUpTime`, `DeliverByTime`, `UcjbComplTime`, `PickupArrivalTime`, `DeliveryArrivalTime`, `FollowupTime` are `datetime` with no offset. The zone lives beside them as `PickupTimeZoneId` / `DeliverByTimeZoneId` → `dbo.TimeZone`.
- **Writes strip the offset.** Every job date edit does `DateTimeOffset.Parse(value).DateTime` (`Repositories/JobRepository.EditOperations.cs`, 19 sites). The browser sends `2026-10-21T07:00:00-04:00`; the server keeps `07:00` and discards `-04:00`. So the zone the UI attaches on save is **cosmetic for storage** but still matters for DST-gap edge cases and for partner change requests (sent as an instant).
- **Reads pass wall-clock through.** `Helpers/JobMappings.Core.cs` / `JobMappings.Dispatch.cs` copy the `DateTime` as-is; Newtonsoft `RoundtripKind` (`Program.cs:25`) serialises `Kind=Unspecified` with no offset; `parseDateFromApi` keeps the wall-clock. Display = stored digits + a zone label.
- **"Now" is tenant-zone**, not job-zone: `ITenantClock.TenantNow` = UTC now converted with the `TimeZone` JWT claim (`Services/TenantInfoService.cs:142`). Used for `Remain`, follow-up defaults, note stamps, task due dates.
- **Audit / event stamps** are a mix: `CreatedDateUtc`, `ucevCreatedAtUtc`, `EditedAtUtc`, `UpdatedAt`, manual-message UTC (added 9 Oct, `98b98800`) are UTC and converted at read; `CreatedDate`, `tucNote.CreatedDate`, courier login/logout, `tucEvent` due/ETA are tenant wall-clock. The UTC-twin work for tucEvent was reverted on 5 Oct 2026 (`18149c6c`) except `ucevCreatedAtUtc`.
- **Zone identifiers come in two formats.** `dbo.TimeZone.Name` = IANA (`America/New_York`), `DisplayName` = Windows name (`Eastern Standard Time`). The Hub `TimeZone` claim = Master Controller `Tenant.TimeZone` (format to confirm; the SPA defaults it to `New Zealand Standard Time`, tests use Windows names, Hub calls `FindSystemTimeZoneById` on it directly). Frontend `getIanaTimezone` and backend resolvers accept both, each with different fallbacks (F6).

## 3. Server clocks (the "main server is NZT" question)

| Layer | Zone | Evidence | Impact |
|---|---|---|---|
| DespatchWeb pods (EKS) | **UTC** | `Dockerfile` has no `TZ`; none of the 19 `.gitlab/*-auto-deploy-values.yaml` set env; base image `mcr.microsoft.com/dotnet/aspnet:10.0` is UTC. | Only one code path uses server-local: `Repositories/NationwideJobRepository.cs:1129,1135` falls back to `TimeZoneInfo.Local` (= UTC in prod; the log line says "local"). Everything else goes through the tenant clock. Good. |
| RDS `urgent-couriers-sql-server` (ap-southeast-2) | **Unknown — to confirm** (SSO token expired during audit) | `GETDATE()` is the default on **80** columns in `EntityClasses/DespatchContext.cs` (incl. `tucJob.CreatedTime`, `tucNote`, `tucNoteArchive`, `tucJobArchive`, `tucJobBooking`, `tucJobNationwide`, `tucMessage`, accessorial/extra charge tables) and in the `trg_tucJob*` update triggers in dbmigrationsv2. | If the instance is NZ: every row written by a DB default or trigger carries NZ wall-clock, while the same columns written by the app carry tenant wall-clock (Pacific for OTG). Mixed semantics inside one column, invisible to the UI. If the instance is UTC the mix is UTC vs tenant instead. Either way it is wrong for every non-NZ tenant and needs a decision (§5 rule 7). |
| Browser | user's OS zone | `parseDateFromApi` on an offset-less string → `dayjs(str)` = browser-local; harmless while everything is formatted as wall-clock, but `.isBefore(dayjs())` compares job wall-clock against browser now (`components/common/task-item/TaskItem.tsx:186`, `task-calendar-view/TaskCalendarView.tsx:81`, `pages/task-dashboard/TaskDashboardPage.tsx:299`). | Wrong overdue flags for a dispatcher whose PC zone ≠ tenant zone (OTG staff in NJ on a Pacific tenant). |

Commands to confirm (run after `aws sso login --profile dfrnt-sso`):

```bash
aws rds describe-db-instances --profile dfrnt-sso --region ap-southeast-2 \
  --query 'DBInstances[].[DBInstanceIdentifier,Engine,Timezone]' --output table
```

```sql
-- on any tenant DB (SELECT only)
SELECT SYSDATETIMEOFFSET() AS server_now, GETDATE() AS getdate_now, GETUTCDATE() AS utc_now,
       DATEDIFF(minute, GETUTCDATE(), GETDATE()) AS server_offset_minutes;
SELECT Id, Name, DisplayName, Code, OffsetHours, WindowsTimeZoneId FROM dbo.TimeZone ORDER BY Name, Id;
SELECT COUNT(*) AS jobs_without_pickup_zone FROM dbo.tucJob WHERE PickupTimeZoneId IS NULL AND UcjbVoid = 0;
-- on Master Controller
SELECT TenantId, Code, CountryCode, TimeZone FROM dbo.Tenant;
```

## 4. Findings

Severity: **H** = wrong data or wrong decision for a user; **M** = misleading display; **L** = hygiene / latent. Frontend paths are relative to `DespatchWeb.Client/src/`.

| # | Sev | Where | What | Effect |
|---|---|---|---|---|
| F1 | H | `components/dialogs/edit-date-time-dialog/EditDateTimeDialog.tsx:59,71,74` + `utils/reactDialogHost.tsx:73` | `useState(resolvedTz \|\| getIanaTimezone())` runs once; the host calls `root.render` with the same element and new props, so `selectedTimeZone` never updates. The seed `useEffect` deps are `[open, initialDateTime]` only. | Zone label wrong; "now" seed for empty fields in the wrong zone (the 04:50); `result.timezone` wrong → partner change requests carry the wrong instant. `EditDateTimeDialog.test.tsx` covers `defaultTimeZone` on a fresh mount only; nothing opens the dialog twice with different zones. |
| F2 | M | `components/job-list/JobListTable.tsx:99-103,131-134` | `formatJobTime` appends the **tenant** abbreviation (`getTimeZoneShort()`, module-level cache) to every row, ignoring `job._pickUpTimeZoneStr`. `components/common/job-details/components/MetricsGrid.tsx:44-46,135-152` (detail) uses the job zone. Same list component drives Dispatch, Current Work, Nationwide and Job Search. | List says `(PDT)`, detail says `(EDT)` for the same wall-clock. This is the headline OTG complaint. |
| F3 | H | `Repositories/BaseJobRepository.cs:252-256,1072` (`CalculateRemainTime`), also called from `JobRepository.cs:3576`, `JobRepository.PodSearch.cs:106` | `job.Booked` (job-zone wall-clock) minus `clock.TenantNow` (tenant-zone wall-clock). | `Remain` and the red overdue colour are off by the zone delta for any job outside the tenant zone (3 h for an OTG NJ job). Late-pickup / late-delivery statuses set by the same arithmetic elsewhere share it. |
| F4 | H | `Services/AiSummarizationService.cs:341,362,415,450` → `Services/AiJobSignalCalculator.cs:64-95` | `now = DateTimeOffset.UtcNow`, then `now.DateTime` (UTC digits) compared with job wall-clock. | AI summary "late by N min" signals are off by the full UTC offset (7 h for Pacific, 12–13 h for NZ). |
| F5 | H | `Services/TenantInfoService.cs:153-159`; callers `JobRepository.EditOperations.cs:512,521,529,541,889,909`, `JobRepository.cs:6045-6047` | `GetCurrentTimeFromTimeZone(TimeZone)` dereferences `timeZone.Name` with no null guard, no IANA↔Windows fallback, and caches by name for a day. `PickupTimeZoneId`/`DeliverByTimeZoneId` are nullable and DespatchWeb's own Quick Add (`BuildQuickAddInputModel` `JobRepository.cs:5399` → `DD_stpJob_InsertExcelerator`) never sets them. | Status → Picked Up / Delivered / Undeliverable / POD on a zone-less job = `NullReferenceException` → 500. Zone-less jobs also display with the tenant abbreviation (`MetricsGrid.getTzStr` fallback to `getSession().timeZone`), which is the *other* way OTG sees "(PDT)" on an East-coast job. |
| F6 | M | `Helpers/TimeZoneHelper.cs:32`, `Services/TenantInfoService.cs:95`, `Extensions/DateExtension.cs:44`, `TenantInfoService.cs:159`, `NationwideJobRepository.cs:1129` | Five resolvers of "string → TimeZoneInfo": one uses `TZConvert` and throws, two use `TryConvertIanaIdToWindowsId` and fall back to **UTC silently**, one does neither, one falls back to **server local**. | An unknown/misspelt zone degrades to UTC in some paths and 500s in others. Nobody can reason about it. |
| F7 | M | `utils/dateUtils.ts:268-283`, duplicate `utils/timezoneShort.ts:10-29` (used by `utils/dtoMappings.ts:168,189`) | Abbreviation computed from `dayjs()` (today), not the job's date. | A January job viewed in October reads `(EDT)`; both copies have the same bug; NZ special-case is string-matched on "nz". |
| F8 | M | `Repositories/NoteRepository.cs:20-80,704`, `BaseJobRepository.cs:1244`, `api/notesApi.ts:23-24,101` | Notes, task due dates, courier login/logout, delivery-journey rows are tenant-zone with **no zone label**, rendered beside job-zone times. | The `Oct 21, 2026 5:01 PM` notes in the screenshot are Pacific; the job header is Eastern; nothing says so. Dispatcher mentally mixes them. |
| F9 | M | dbmigrationsv2 `20251102152847_InsertMissingTimeZoneReocrds.sql`, `20251106150550_FixMissingDaylightTimezones.sql`; booking procs `SELECT @PickupTimeZoneID = Id FROM TimeZone WHERE [Name] = @PickupTimeZone` | "Daylight" variants were inserted as **separate rows with the same `Name`** (`Pacific/Auckland` ×2, offsets 12 and 13; US rows guarded on `DisplayName` so can duplicate too). No unique index on `Name` (only `IX_TimeZones_NameCode`). `OffsetHours`/`Code`/`OffsetString` are not read anywhere in DespatchWeb. | Booking procs resolve an ambiguous id; `GetTimeZoneOptions` shows duplicates. DST is a property of a zone, not a second zone. |
| F10 | M | `Controllers/JobController.cs:2872,2889` | Only the two Delivery Journey endpoints accept a `timeZone` query override (`SetTenantTimeZoneOverride`); everything else relies on the claim, and a missing claim silently becomes UTC (`TenantInfoService.ResolveTimeZoneInfo` → `TimeZoneInfo.Utc`). | A session without the claim (older Hub cookies, API tokens built with an empty zone) gets UTC "now" with no warning. |
| F11 | L | `pages/dispatch/DispatchScreen.tsx:28`, `pages/nationwide/NationwideScreen.tsx:21`, `pages/job-search/JobSearchScreen.tsx:120`, `components/common/date-filter-menu/DateFilterMenu.tsx:107` vs `api/session.ts:51,65` (`''`) vs `utils/dateUtils.ts:21` (`'UTC'`) vs backend (`UTC`) | Frontend defaults a missing tenant zone to `New Zealand Standard Time` in four places, to `''`/`UTC` in two, backend to `UTC`. | Three different answers to "no zone". |
| F12 | L | `utils/dateUtils.ts:29` (`getSession().isUsCustomer ?? true`) vs `edit-date-time-dialog-react.module.tsx:61` (`?? getIsUSCustomer()` → false) | `isUSCustomer` default disagrees. | Zone panel hidden/shown and date order flips when the session is absent (tests, error page). |
| F13 | L | `components/common/job-details/hooks/useJobActions.ts:375,475` pass `{id,text}` as `defaultTimeZone` via `as any`; dialog duck-types it; `types.ts` says `string`. | Type lie; the duck-typing is what masks F1 in tests. |
| F14 | L | `Repositories/JobRepository.OverviewOperations.cs:478,531,535` (`dto.PickupTimeZone ?? tenantTimeZone`) vs `CourierRepository.cs` (tenant only, 8 sites) vs `JobRepository.cs:3397` (PickedUpDate stamped tenant) | Inconsistent choice of job-zone vs tenant-zone when stamping an offset on the same kind of value. | Overview and reports disagree with job detail for out-of-zone jobs. |
| F15 | L | `TblAirport.Timezone` (string, format unchecked) → `FindSystemTimeZoneById` with `TimeZoneInfo.Local` (UTC) fallback (`NationwideJobRepository.cs:1125-1135`) | Nationwide cargo cut-off uses UTC when an airport zone is blank. | Wrong cut-off warnings for flights. |
| F16 | L | `Controllers/AiController.cs` (13 actions) | `var tenantId = tenantInfo.GetTenantTimeZone();` — the zone is passed around under the name `tenantId`. | Readability only, but it hides that the AI endpoints are zone-aware at all. |

Not a finding but worth knowing: the git history has **15+ "timezone fix" merges** (`fix/timezone-datetimes`, `fix/timezone-improvements`, `feature/delivery-journey-timezone-fixes`, UTC twins added then reverted…). Each fixed a symptom in one surface. None set a rule, which is why the reports keep coming.

## 5. The rule to adopt

1. **Job times are wall-clock in the job's zone.** Keep the storage model (changing 20+ columns and every proc is not worth it) but make it explicit in one place.
2. **"Now" for a job is now in that job's zone.** One helper, `clock.NowIn(job.PickupTimeZone ?? tenant)` / `NowIn(job.DeliverByTimeZone ?? tenant)`, used by Remain, late flags, AI signals, follow-up defaults.
3. **Every rendered time carries the abbreviation of the zone it is in**, computed for that date, from the job's zone when it is a job time and from the tenant zone when it is an audit/note/task time. Never the tenant zone on a job time.
4. **Audit stamps are UTC and converted at read.** Keep `*Utc` columns authoritative where they exist; stop adding tenant-wall-clock twins.
5. **One resolver.** `string → TimeZoneInfo` lives in one static with one fallback policy (log + tenant zone, never silent UTC, never server local). Frontend mirror: one `getIanaTimezone` and one abbreviation function with a date argument; delete `timezoneShort.ts`.
6. **Zones are never null on a job.** Quick Add and every proc default to the tenant zone; add a null guard anyway.
7. **DB defaults do not decide the zone.** Either the RDS instance is UTC and `getdate()` defaults are replaced with app-supplied values, or the columns get `*Utc` twins. Decide after the RDS check in §3.

## 6. Milestones

| M | Scope | Findings | Notes |
|---|---|---|---|
| M0 | Stop the bleeding (frontend only, no API change) | F1, F2, F7, F12, F13 | Dialog: derive zone from props per open (`useMemo` on `defaultTimeZone`, or `key` the dialog per open in the host). List: `job._pickUpTimeZoneStr ?? tenant`. Abbreviation takes the date. Add a test that opens the dialog twice with different zones. |
| M1 | Now-in-job-zone | F3, F4, F5, F14 | `ITenantClock.NowIn(TimeZone?)`; `Remain`, late statuses, AI signals, POD/pickup stamps all go through it; null guard + tenant default; Quick Add sets both zone ids. |
| M2 | One resolver each side | F6, F10, F11, F15, F16 | Single backend resolver with logged fallback to tenant; single frontend default; `TimeZone` claim required at login (Hub) rather than optional everywhere. |
| M3 | Reference data | F9 | dbmigrationsv2: dedupe `dbo.TimeZone` on `Name`, drop daylight rows, unique index, remap any job ids pointing at removed rows. Coordinate with Booking/Configurator since their procs resolve by `Name`. |
| M4 | Tenant-zone surfaces | F8 + §3 RDS decision | Label notes/tasks/courier times with the tenant abbreviation, or convert to the selected job's zone on the job panel (product call). Replace `getdate()` defaults once the RDS zone is confirmed. |

## 7. Open items for Steve

- Run the §3 commands: RDS instance zone, `dbo.TimeZone` rows on OTG and Urgent, and `Tenant.TimeZone` format in Master Controller. The audit assumed the claim is a Windows name; if it is IANA, F6/F11 shrink.
- Confirm with OTG whether their dispatchers' PCs are on Pacific or Eastern (affects the browser-now row in §3 and whether task overdue flags are part of their reports).
- Product call for M4: do notes/tasks show tenant time with a label, or the open job's zone?
