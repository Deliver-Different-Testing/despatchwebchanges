# Urgent Couriers pricing tickets — likely root causes (for Kerran)

_1 Oct 2026. Read-only code research; no database was queried and nothing was changed._

Covers the 11 PRICING tickets Marcus escalated in Urgent Connection on 30 Sep:
#208, #213, #215, #216, #217, #218, #219, #224, #225, #226, #820.

## How to read this

- **Hypotheses, not diagnoses.** Everything here comes from reading code. Each item has a SELECT-only query or staging test that confirms or kills it. Run those first.
- **"Latest definition"** means the last migration in `dbmigrationsv2` that redefines the object. Prod can drift from migrations.
- **Spot-checked** means the quoted line was re-read directly after the research pass. Everything else is as traced, not independently re-verified.
- **Updated 2 Oct:** the WebAPI (`api`) and booking portal (`booking`) were cloned from GitLab and read. What that changed is in [WebAPI and booking portal findings](#webapi-and-booking-portal-findings-2-oct); where it conflicts with a ticket section below, that section wins.
- **Still not available locally:** Client Manager, the courier portal, the original bulk importer (BulkImportHyper) and the World Tracer integration code. Anything about those is second-hand from `dfrnt-ops` reference notes.

Path shorthand:

| Short | Path |
|---|---|
| `DW` | this repo (`despatchwebchanges`, `main` @ 50e37cb4) |
| `MIG` | `dbmigrationsv2/DatabaseScripts/Migrations` (read on `feat/np-courier-pay-triggers` @ c37f639) |
| `CRE` | `MIG/20260818182434_ClientReferenceExpansion.sql` (40k lines; holds the latest definition of most legacy rating objects) |
| `RO` | `routed-operations` (`fix/bulk-import-route-builder-0922`) |
| `API` | `api` (GitLab `urgent-couriers/api`, `master` @ 48225a2, same as `develop`); `JobRepo` = `API/Models/Repository/JobRepository.cs` |
| `BK` | `booking` (GitLab `urgent-couriers/booking`, `master`; `develop` is 2 commits ahead, neither touches pricing) |

Related existing docs in this repo: `pricing-breakdown-gap-analysis.md` (courier pay vs PricingBreakdown, parent/child model) and `extra-charges-deep-dive.md` (the two accessorial systems, PricingBreakdown triggers).

## Summary

| # | Ticket | Most likely cause | Confidence | Fix lives in |
|---|---|---|---|---|
| [218](https://deliver-different-testing.github.io/1on1/#/tickets/218) | Return parent total shows one leg | Parent total is a one-time snapshot; courier-app events and Despatch re-rates overwrite it with one leg | Medium-high | SQL + `DW` |
| [216](https://deliver-different-testing.github.io/1on1/#/tickets/216) | 90-min collection leg from Wellington at $0 | Regional rate silently returns 0 when the client's available-speed row drops out (time window) | Medium-high, conditional on client/speed | SQL / config |
| [820](https://deliver-different-testing.github.io/1on1/#/tickets/820) | Dimension pricing overridden after booking | Quote, insert and re-rate pass different dimension inputs; any re-rate (including a client edit in the booking job list) drops them and overwrites the price | Medium-high | SQL + `DW` + API |
| [208](https://deliver-different-testing.github.io/1on1/#/tickets/208) | P2P on a schedule priced at Client Manager rates | NZ schedule inserts have no P2P rating branch, and the P2P re-rate branch is commented out, so Recalculate cannot correct them | High on code | SQL |
| [224](https://deliver-different-testing.github.io/1on1/#/tickets/224) | Time change doesn't re-rate after-hours fee | Post-edit price probe silently skips `RatedManually` jobs; Recalculate clears the flag | Medium-high | `DW` |
| [225](https://deliver-different-testing.github.io/1on1/#/tickets/225) | After-hours fuel: Auckland yes, P2P no | NZ after-hours block in the P2P engine adds the fee flat, after fuel and PPD | High | SQL |
| [215](https://deliver-different-testing.github.io/1on1/#/tickets/215) | Recurring insert: raw base + fuel + PPD | Main change has landed; raw-base edit on a template never adds fuel and then switches fuel off | High | `DW` + SQL |
| [217](https://deliver-different-testing.github.io/1on1/#/tickets/217) | Eden Office bulk import extra item charge | Something hands the rater Qty 2; best fit is item rows landing on the wrong bulk job via an ID collision | Medium | SQL / importer |
| [213](https://deliver-different-testing.github.io/1on1/#/tickets/213) | Client Manager courier % ignored | Value is saved but never read; courier-pay cascade has no zone or rate-code term | High (feature gap) | SQL |
| [226](https://deliver-different-testing.github.io/1on1/#/tickets/226) | Air NZ dry ice DG charge | Hard-coded `83` cost for all DG; class never reaches rating | High | SQL + booking |
| [219](https://deliver-different-testing.github.io/1on1/#/tickets/219) | World Tracer 74c per item | New capability; no durable WT flag, and NZ has no "no courier pay / no fuel" line type | n/a (design) | Accounts or SQL |

## Cross-cutting themes

Five patterns account for most of the tickets. Fixing them as patterns closes more than fixing tickets one by one.

1. **Re-rate paths carry less context than the original rating.** The booking quote and insert pass cubic/weight lists, booked time and schedule context. The re-rate payload (`DW/Models/UrgentRerateObject.cs`) and the SQL re-rate procs drop some of it. Drives #820, part of #224, and possibly #217.
2. **`RatedManually` means two things.** It is used both as "a human pinned this price" and as "a fixed amount was supplied at insert". Re-rate probes and the recurring fuel reprice both skip on it. Drives #224 and #215.
3. **Parent totals are not maintained for return parents.** The roll-up trigger sums PricingBreakdown rows stored on the parent. Return parents have none. Drives #218, and likely #207/#211/#315.
4. **Rating failures return $0 silently.** Missing zone row, missing rate code or missing available-speed row all yield 0 with no error, and `DW` refuses to save a re-rate unless `Rate > 0`, so $0 sticks. Drives #216.
5. **Server clock used instead of the job's time.** `GETDATE()` in the schedule pickup rating and `tenantNow` in the schedule re-rate payload. Drives #220/#224 on scheduled jobs and the 1hr pickup figure in #217.
6. **The quote is not the price** (added 2 Oct). The booking page does not carry the quoted amount into the booking; SQL re-rates at insert from a different input set. Then any later edit that re-rates can overwrite the amount again. Quote, insert and re-rate share no mapping code in the API. Drives #820 and feeds #216, #224 and #226.

## WebAPI and booking portal findings (2 Oct)

Read from `API` and `BK`. Thirteen of the lines quoted here were re-read directly and matched; the recurring `RawBaseAmount` expression under #215 was not re-verified.

### How pricing actually flows on NZ

1. **Quote.** `POST /api/Rates` → `GetNZRatesAsync` (`JobRepo:515-844`) fires five rating calls in parallel and merges the rows: `WS_stpJobType_Rates`, `DD_stpGetExceleratorRates`, `NP_stpGetNationwideRates`, `NP_stpGetSDShorthaulRates`, GSS (and NZ Post if enabled).
2. **Book.** The page sends `fixedAmount` only when `speedId === 0` (`BK/wwwroot/App/Components/Home/desktopHomeControl.js:5010`). For every Urgent speed it is undefined, so `@FixedAmount` is null and **SQL rates the job again at insert**. Nothing compares the result with the quote.
3. **Breakdown.** The API writes no PricingBreakdown rows for any job kind (zero references). The booking portal writes none at booking either; its only write is on job-list edit (`BK/Core/Application/Services/JobService.cs:2643`). For NZ local, P2P and regional jobs the SQL calls are commented out in `UTL_stpJob_Insert_Rated` (`CRE:31915, 31930`). So a plain NZ job has no rows until something re-rates it.
4. **Items.** Job item rows are inserted after the insert proc has priced the job, by separate calls on a new connection (`JobRepo:4866-4891`). There are no transactions anywhere in the API.
5. **Re-rate.** `POST /api/Rates/GetRerateAmount` calls one proc, `NET_stpJob_Rate_Described_All` (`JobRepo:2438`), which dispatches by speed grouping. The 17 Sep migration header calls this proc "currently unused"; it is the live NZ re-rate path.
6. **Job-list edit (booking portal).** If the re-rate differs from the stored amount by 0.01 or more and the user's permission is not `Min`, saving **any** edit overwrites the amount and rewrites the breakdown (`BK/wwwroot/App/Components/JobList/jobListControl.js:560-562`; `JobService.cs:2181`). The amount save and the breakdown write are separate calls, not one transaction.

### Inputs differ between quote, insert and re-rate

| Input | Quote (`WS_stpJobType_Rates`) | Insert (`WS_stpJob_Insert`) | Re-rate (`NET_stpJob_Rate_Described_All`) |
|---|---|---|---|
| Per-unit cubic list | yes | yes | **no** |
| Per-unit weight list | yes | yes | **no** |
| DimensionsType | **no** | yes | **no** |
| StockSizeId | **hard-coded null** (`JobRepo:1396`) | yes, default sizes only (`JobRepo:4278-4281`) | **no** |
| DG class | **no** (not on the request model) | yes | **no** |
| Dry ice weight | no | **no** (not mapped for NZ) | no |
| Time | ready time as `@Date` | `GETDATE()` as `@Date`, ready time as `@Booked` | `DateTime` as sent, no timezone handling |
| Weight | decimal sum | sum | `int` (`API/Models/Request/RerateRequest.cs:41`) |
| Quantity | sum of units | sum of units | as sent |

The re-rate request model has no fields for the missing inputs, so this is a contract change across `API`, `DW` and `BK`, not a one-line fix.

### What changed per ticket

| # | Change |
|---|---|
| 820 | **Stronger, and a new leading trigger.** Confirmed the re-rate passes none of the dimension inputs. New: the quote and the insert already disagree (StockSizeId null on quote, real on insert; DimensionsType on insert only), so the price can move at booking. New: a client edit in the booking portal's job list re-rates without the lists and overwrites the amount. That fits "auto reprices after booking" better than a Despatch action. Also flag: NZ sends cubic in m³ (e.g. 0.027) into SQL parameters typed `NUMERIC(18,0)` and commented as cm³; if the bands are cm³ the value rounds to 0. Needs a data check. |
| 208 | **Confirmed, and Recalculate cannot fix it.** For an NZ speed grouped `US P2P`, the re-rate branch is commented out in the API (`JobRepo:2398-2426`) and in SQL. The API returns 404 "No Rates Found". Booking-page bookings of these speeds go through `DD_stpJob_InsertExcelerator`, which is why manual bookings are right and scheduled ones are not. |
| 218 | **Order confirmed; H3 narrowed.** The connect call runs in leg 2's success handler, after both legs are inserted and priced (`desktopHomeControl.js:640-641`). So the snapshot is only short if leg 2 was $0 at insert. H1 and H2 stand. New: the "Return for" flow from the job list has its connect call commented out (`:642-643`), so those pairs are never linked. |
| 216 | **Time-window hypothesis strengthened.** Leg 2's ready time is leg 1's ready time plus leg 1's speed minutes (`desktopHomeControl.js:3240-3249`), so the collection leg is always later in the day. Leg 2 reuses the last manually selected speed. Nothing guards against a $0 rate: the API filters only on availability and the page's bad-rate filter ignores amount. |
| 224 / 220 | **New quote-versus-insert difference.** The quote passes the ready time as the rating date; the insert passes `GETDATE()` as the date and the ready time as booked time. If after-hours keys on the date argument, a later-ready job is quoted at one rate and inserted at another. The re-rate does no timezone conversion. |
| 215 | **Supports H3.** A recurring local template is stored with `ucbkAmount` rated at insert (base + fuel + PPD), `RawBaseAmount` equal to that full amount, no fuel column and no breakdown rows. Schedule recurring templates do get rows. (The `RawBaseAmount` expression was not re-verified.) |
| 217 | **H2 partly ruled out.** The API passes quantity as sent and never adds package units to it. Still open: with no per-package weight the vehicle size may default to Car regardless of the job's size, and a fractional weight may fail to bind to the `int` field. The API's own bulk import does not rate; it copies `tblBulkClientDefault.Amount`. |
| 226 | **Located.** DG class is not on the quote or re-rate request models, so no quote can price by class. The lbs default is `desktopHomeControl.js:5437`, set before the country is known; `setCountryCodeOptions()` (`:1219-1242`) is where to set kg for NZ. The page converts dry ice weight to lbs before sending, and the NZ insert drops it. For NZ local jobs DG does not change the price at all. |
| 219 | **Easier than thought.** A caller can already set `SourceId` on `POST api/Jobs` with no whitelist (`API/Controllers/JobsController.cs:396`). Adding a World Tracer value to `JobSource` gives the durable marker. |
| 213, 225 | No change. |

Two side defects worth a look, both unverified at runtime: the NZ Excelerator quote does `int.Parse` on a ZipCode field that NZ addresses may not populate (`JobRepo:1598`), and booking-time accessorials on a recurring booking are added using an id that may be the prebook id, not a job id.

---

## Group A — parent/child return jobs

### #218 Return job parent total only shows one leg

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/218>

**How a booking-page return is built** (second-hand for the booking side; proc read directly):
the booking page books two ordinary jobs, then calls `ConnectReturnParts`, which runs `DD_stpJob_CreateReturnParent` (`CRE:4923-5159`).

- Parent total is a one-time snapshot: `@TotalAmount = Amount` from leg 1, then `@TotalAmount = @TotalAmount + Amount` from leg 2 (`CRE:5063`, `CRE:5077`; spot-checked).
- A new parent row is inserted with relationship type 5 (ReturnParent); legs become type 6. `ParentID`, `RootParentID` and `InformationParentID` are set on both legs and on the parent itself.
- No PricingBreakdown rows are written to the parent.

**Why the roll-up can't maintain it:** `TR_PricingBreakdown_tucJob_Sync` (`MIG/20260728102944_CourierFuelInPricingBreakdownTrigger.sql:6-99`) sets `ucjbAmount` to the sum of breakdown rows where `JobID` or `ChildJobID` is the job. That fits split and nationwide parents. A return parent has no rows, so nothing re-sums the legs, and the first breakdown write keyed to the parent replaces the snapshot.

`DW` has no return-family handling either: `JobRelationshipTypes.ReturnParent/ReturnChild` exist in `DW/Enums/JobRelationshipTypes.cs:8-9` and are referenced nowhere else.

**H1 — courier app events overwrite the parent with the child's amount (medium-high).**
`MARS_stpJob_CourierResponse_PickUp` (`CRE:16028-16057`; spot-checked) updates the information parent's `ucjbAmount` to the child's `@JobAmount`, unless the parent type is UrgentTonight, MedicalRun or SplitParent, or the job is `RatedManually`. ReturnParent is not excluded. The same pattern is in `_Delivery` (`CRE:14408-14431`) and `_Accepted` (`CRE:13448-13466`). It needs no dispatcher action and produces exactly "parent = one leg".

Unknown: the value of `tblJobRelationshipType.UpdateJobInformationParentFromDevice` for type 6 (seed data), and whether booking-page jobs carry `RatedManually = 1`, which would block this.

```sql
SELECT JobRelationshipTypeID, SystemName, UpdateJobInformationParentFromDevice, AutoVoid
FROM tblJobRelationshipType WHERE JobRelationshipTypeID IN (5,6);

SELECT p.ucjbID, p.ucjbNumber, p.ucjbAmount AS ParentAmt,
       c.ucjbID AS ChildID, c.ucjbNumber AS ChildNo, c.ucjbAmount AS ChildAmt,
       c.RatedManually, c.ucjbStatus, c.PickUpTime, c.ucjbComplTime
FROM tucJob p
JOIN tucJob c ON c.ParentID = p.ucjbID AND c.ucjbID <> p.ucjbID
WHERE p.JobRelationshipTypeID = 5 AND p.ucjbVoid = 0
ORDER BY p.ucjbID DESC;
```

Staging test: book a return, note the parent amount, accept or pick up leg 1 on a device, re-read the parent.

**H2 — re-rating a leg in Despatch writes that leg's breakdown onto the parent (defect confirmed in code; medium that it is what the ticket saw).**
- `DW/EntityClasses/DespatchContext.Partial.cs:55-60` defines the effective job as `j.ParentId ?? j.UcjbId` (spot-checked). For a return leg that is the return parent.
- `UpdateUrgentJobRateAsync` (`DW/Repositories/JobRepository.RatingOperations.cs:208-351`) sets the leg's amount, then calls `DD_InsertPricingBreakdown` with the effective (parent) job id.
- That proc deletes the parent's non-accessorial rows and inserts the leg's lines, so the trigger sets the parent to that leg only. The leg's own rows go stale.
- Triggered by `ApplyRecalculatedJobRate`, arrival-time edits (`DW/Services/ArrivalWaitRerateService.cs:45-46`) and bulk recalculate (`DW/Services/RateJobService.cs:368`).
- Likely the shared root of #207/#211.

```sql
SELECT pb.* FROM PricingBreakdown pb
JOIN tucJob p ON p.ucjbID = pb.JobID
WHERE p.JobRelationshipTypeID = 5;
```
Any rows on a return parent prove a post-booking write.

**H3 — snapshot taken while leg 2 was $0, then never refreshed (medium).** Links #216 to #218: if the collection leg is $0 at connect time and is later fixed, the parent stays at leg 1.

**H4 — accessorial or price component added after linking (medium-low here, real defect).** `sp_AddJobAccessorial` (`MIG/20260306100000_FixAccessorialPricingBreakdownChildJobs.sql:144-149`) inserts on the parent with `ChildJobID` set, and the parent then recalculates to the accessorial rows only. `RecalculateJobAmountFromBreakdownAsync` (`DW/Repositories/JobRepository.cs:6107-6126`) drops a return leg's own base rows from its total. Plausibly related to #315.

**Fix direction:** either give return parents a real roll-up (sum of type-6 children by `ParentID`, maintained by trigger), or exclude ReturnParent from the courier-response overwrite and make `GetEffectiveJobId` return the leg itself for return children. The second is smaller.

### #216 90-min collection leg on returns from Wellington at $0

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/216>

The ticket has no description. **A job number is needed** to know the client and whether "90 min" is speed 24 (local, `tblClient.Rate90min`) or speed 100 (regional). Every ranking below is conditional on that.

**H1 — regional client, available-speed row drops out, silent $0 (medium-high).**
- Regional clients (`tucClient.SiteID IN (2,3,5,10,14,19,20,21,32)`) price from the client's available-speed sale price: `UTL_fncJob_Regional_RateAndDescription`, `CRE:26595-26608`. No row means 0 (`CRE:27524`).
- The "Service is disabled for this client" guard is skipped for regional clients (`CRE:27755`), so there is no message.
- `UTL_fncJob_GetClientAvailableSpeed` (`MIG/20251210162920_ClientAvailableSpeedPerfFix.sql:74-131`) drops the row when the booked time plus processing time is outside the speed's start/end window, or when the visibility flag for the caller is off.
- A collection leg booked for later in the day can fall outside the window while the outbound leg is inside it. That is the best explanation for "only the collection leg".

**H2 — reversed direction has no zone row or no rate code (medium).** `UTL_fncJob_RateAndDescription` looks up `tblZone` directionally (`CRE:25586`) and reads `Rate90min` for speed 24 (`CRE:25637-25641`). Either missing gives $0 with no error.

**H3 — client-default return path (low-medium).** Only if the job came through `WS_stpJob_Insert` with `@ReturnJob = 1` (not the booking-page path). Part 2 is passed Part 1's output amount and never rated for the reversed direction. Signature: "Return Job Part 1/2" in the leg notes.

**Why $0 isn't corrected later:** `DW/Services/RateJobService.cs:65-76` only saves a re-rate when `Rate > 0`.

```sql
SELECT j.ucjbID, j.ucjbNumber, j.ucjbSpeed, j.ucjbDate, j.ucjbTime, j.ucjbAmount,
       j.RatedManually, c.ucclCode, c.SiteID,
       dbo.UTL_fncClient_IsRegionalClient(c.ucclID) AS IsRegional
FROM tucJob j JOIN tucClient c ON c.ucclID = j.ucjbClientID
WHERE j.ucjbNumber = '<leg number>';

SELECT * FROM tblClientAvailableSpeed WHERE ClientID = <id> AND SpeedID = <leg speed>;
SELECT * FROM tblClientDefault_AvailableSpeed
WHERE Name = 'API - Web Integration' AND SpeedID = <leg speed>;

SELECT z.* FROM tblZone z
WHERE (z.FromAreaID = <A> AND z.ToAreaID = <B>) OR (z.FromAreaID = <B> AND z.ToAreaID = <A>);
```
Then call the rating function for the leg's actual booked time; the Description column says which branch fired. Note the result depends on the DB login used.

---

## Group B — wrong rate applied, or no re-rate

### #820 Joyfood dimension pricing overridden after booking

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/820>

The only per-client dimension multiplier in SQL is in `fncT_BulkZoneRate_WithLinehaul` (`CRE:10018`). It needs both `@CubicList` and `@WeightList` and looks up `BulkZonePackageRate.CubicRate`. Without the lists it prices `base + addon% x (Qty - 1)`.

- **Quote and insert pass the lists:** `WS_stpJobType_Rates` (`MIG/20260908154525_ScheduleDepotFilter.sql:328,353`) and `WS_stpBulkScheduleJob_Insert` (`MIG/20260925100000_F19a_WS_stpBulkScheduleJob_Insert_FirstLegTime.sql:403`). This is why the booking page is right.
- **Every re-rate path drops them:**
  - `NET_stpJob_BulkZoneRate_Described` (`CRE:16681`) passes `null, null, null`. Its caller passes weight in the cubic slot: `MIG/20260909143613_NPAgentFlightMFVPPD.sql:444`, with the comment `--Weight in cubic spot?` (spot-checked).
  - `fncT_StpBulkZoneRate_GetAmountByJobID` has the lists commented out: `CRE:10429`, `--@CubicList = ... these can cause the price to be very wrong.` (spot-checked). It is used by `WS_stpBulkJob_Update` (`CRE:37457`), which then overwrites the amount and the breakdown.
  - `DW`'s re-rate payload has no dimension data: `JobMappings.Rating.cs:112` reads `CalculateDimsOncePerJob = job.DimensionsType == 2` but `MapToUrgentRerateObject` never forwards it.
- **The 25kg conversion** is the overweight surcharge in the legacy zone functions: `CRE:25816-25837`, `CEILING(@Weight/25.00) - FLOOR(@StartingWeightExcess/25.00)`. 250kg gives 10 - 1 = 9 extra units, which is exactly the ticket's "1 x item + 9 x additional + FAF".

**H1 (medium-high):** a post-booking re-rate goes through a path that cannot see the multiplier. Which formula it lands on depends on Joyfood's speed grouping.
**H2 (medium):** the trigger is `WS_stpBulkJob_Update` (item/quantity update from RunViewer or the booking portal). It is the one path found that reprices without anyone pressing Recalculate.
**H3 (medium):** a Despatch field edit plus accepting the price-change prompt, or bulk price upload in recalculate mode.
**H4 (low):** DB trigger re-rate. `tucJob_Update_RecalculateAmount` is disabled by `MIG/20260626130000_DisableTucJobTriggersToMatchProd.sql:50`; worth one check that it still is.

```sql
SELECT * FROM PricingBreakdown WHERE JobID = <jobId>;
-- 'Plus Weight Excess' = legacy 25kg path; 'Delivery Amount' / 'Additional box amount' = bulk path
SELECT * FROM BulkZonePackageRate WHERE ClientId = <clientId>;
SELECT name, is_disabled FROM sys.triggers
WHERE name IN ('tucJob_Update_RecalculateAmount','tucJob_ChangeAmount','tucJob_ChangeWeight');
```
Also read the job notes: a `DW` re-rate writes "Rate updated to X from Y". No such note points at `WS_stpBulkJob_Update`.

### #208 P2P speed on a schedule priced at Client Manager rates

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/208>

- Schedule materialisation branches on tenant country, not on the speed's rating method: `UTL_stpJobBooking_InsertSchedule`, `MIG/20260914143000_FixInsertScheduleTucJobItemsFallbackDelete.sql:485-606` (spot-checked). Non-NZ goes to `DD_stpJob_InsertExcelerator` (the P2P engine); NZ goes to `WS_stpJob_Insert`.
- Inside that, a schedule speed goes to `WS_stpBulkScheduleJob_Insert`, which has two rate sources chosen by `tucJobType.ZoneRated`: `BulkZoneRate`, or client rate codes via `UTL_fncJob_Rate` (`MIG/20260925100000_...:328, 378-403`). There is no P2P branch.
- The US twin does use the P2P engine (`MIG/20260925100100_F19a_DD_stpBulkScheduleJob_Insert_FirstLegTime.sql:321`).
- The re-rate dispatcher has its P2P branch commented out (`MIG/20260909143613_NPAgentFlightMFVPPD.sql:470`).

**H1 (high on code):** on NZ every schedule-created job is forced down the legacy engine. This is the "existing limitation" Marcus refers to.
**H2 (medium):** the template's price and breakdown are copied forward, so a template priced on the wrong engine repeats every occurrence.
**H3 (low-medium):** Recalculate may not fix these either, if the API's NZ re-rate returns NULL for P2P.

**Staging trap:** comments in `MIG/20260925132718_FixErroneousAH.sql:959-962` say NZ staging has `tblSetting.CountryCode = NULL`. That sends staging down the P2P branch, so staging may not reproduce the prod bug.

```sql
SELECT jt.ucjtID, jt.ucjtName, g.GroupingName, jt.ZoneRated
FROM tucJobType jt LEFT JOIN tucJobTypeGrouping g ON g.GroupingID = jt.GroupingId
WHERE jt.ucjtID IN (<WILRO / MOUMI schedule speed ids>);
SELECT CountryCode FROM tblSetting;
```
Compare the breakdown of E23564T (28 May) with a manually booked equivalent: legacy text lines versus `Base=` / `Distance (` lines.

Decision needed from Steve/Marcus: fix on the existing stack, or carry into Kevin's schedules rebuild. Marcus's comment asks for it to be solved now.

### #224 (and #220) After-hours fee not re-rated on time change

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/224>

- Live job edits do not re-rate server-side (`DW/Controllers/JobController.cs:2000-2108`). The client probes and asks the user to accept the change: `useJobActions.ts:469-475`.
- **The probe silently skips manually-rated jobs:** `useJobUpdate.ts:177` and `:236` (spot-checked).
- **Recalculate clears the flag first:** `JobController.cs:2730`, `SetJobRatedManuallyAsync(jobId, isBooking, false)`, then rates.
- `RatedManually` is set at insert whenever a fixed amount is supplied.
- For any job with a schedule, the re-rate payload sends now, not the edited time: `DW/Services/RateJobService.cs:854`, `DateTime = dto.BulkScheduleId.HasValue ? tenantNow : dto.BookedDate` (spot-checked).
- The schedule pickup leg is always rated at clock time: `CRE:10211`, `DECLARE @PickupBookDateTime datetime = Getdate() -- Book pickup as NOW`.
- `WS_stpJob_Insert` clamps ready time to server `GETDATE()`.

**#224 H1 (medium-high):** the job is `RatedManually = 1`, so the probe drops it silently while Recalculate works. Matches the ticket exactly.
**#224 H2 (medium):** working as coded; it is a confirm prompt, not an auto-rerate, and can be dismissed.
**#224 H3 / #220 H1 (high for scheduled jobs):** line 854 and `CRE:10211` both use now.

```sql
SELECT ucjbID, ucjbNumber, RatedManually, ScheduleID, ucjbDate, ucjbTime, CreatedTime, ucjbAmount
FROM tucJob WHERE ucjbNumber = '<ticket job>';
```
Test: on a non-manual, non-schedule job change the booked time 22:00 to 10:00 and watch for the price-change dialog and the `RecalculateJobRates` response. Repeat on a job with `ScheduleID` set.

### #225 After-hours fuel: Auckland yes, P2P no

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/225>

- Legacy path applies fuel and PPD to the after-hours fee explicitly (`CRE:26032-26034`).
- The P2P engine's NZ block adds `tblAfterHours.Amount` flat, after fuel, PPD and markup are already calculated: `MIG/20260925132718_FixErroneousAH.sql:999-1006`, `TotalJobAmount = TotalJobAmount + @PickupAfterhoursAmount` (spot-checked).
- A second, configurable after-hours charge exists via ExtraCharges, where fuel is a per-row flag (`ExtraCharges.ApplyAfterHoursFuel`).

**H1 (high):** fix location is that NZ block in `UTL_fncJob_ExceleratorRate`.
**H2 (medium):** if the fee comes from ExtraCharges instead, it is the flag — config, not code.
Side observation: a P2P job can get two after-hours lines if both `tblAfterHours` and the rate card's ExtraCharges row match.

```sql
SELECT ChargeName, ChargeAmount, CostAmount FROM PricingBreakdown WHERE JobID = <P2P after-hours job>;
-- 'Pickup Afterhours Fee' equal to tblAfterHours.Amount exactly => H1; an 'After Hours' line => check H2
```

---

## Group C — recurring and bulk import

### #215 Recurring insert-to-live: raw base + fuel + PPD

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/215>

**The requested change has largely landed.** Sequence: `MIG/20260610120000` (adds `RawBaseAmount`), `20260720155642_FixRecurringFuel`, `20260721170000_RecurringFuelToggle`, then `20260820121330_RecalcFuelNZFuelLinePriceBreakdown` with the matching C# commit 0c5701db (20 Aug). Marcus's "$10 stays $10" test was 25 Jun, before the first of these, so **it needs re-running**. No unmerged branch for #215 was found.

What insert-to-live does today:
- `DW/Repositories/RecurringJobRepository.cs:275-375` materialises the job, then per new job runs `UTL_stpJob_ApplyRecurringFuelReprice @JobID, @RawBaseAmount`.
- Raw base is resolved as: template `RawBaseAmount`; else parent template's; else `UcbkAmount - FuelSurchargeAmount` (lines 742-780).
- Templates with `RatedManually = 1` are skipped (line 707).
- The reprice proc (`MIG/20260820121330_...:12-85`) computes fuel from the live job's own date, then total = raw + fuel + PPD.
- The nightly path (`UTL_stpJobBooking_Monitor`) gets the proc reprice only, not the C# step.

**H1 — editing a recurring price by raw base never adds fuel, then switches fuel off at insert (high).**
- `RepriceJobWithBaseAmountAsync` (`DW/Repositories/JobRepository.cs:2196-2226`) calls `UTL_fncJob_RawBaseToAmount(data.JobId, data.BaseAmount)` with the **booking** id, then sets `RatedManually = true` and `UcbkAmount = totalAmount` (spot-checked). It writes neither `RawBaseAmount` nor `FuelSurchargeAmount`.
- That function reads `tblJob` (live + archive jobs). A booking id isn't in it, so fuel and PPD come back NULL and the raw base is returned unchanged. If a live job happens to share the numeric id, the fuel comes from that unrelated job.
- `RatedManually = 1` then makes both the proc and the C# plan skip the reprice.
- Gross mode and bulk price upload also set `RatedManually = true` for prebooks.

```sql
SELECT ucbkID, ucbkJobNumber, ucbkAmount, RawBaseAmount, FuelSurchargeAmount, RatedManually
FROM tucJobBooking WHERE ucbkJobNumber LIKE 'P7683%';
```
Test: set raw base $10 on a recurring booking, read back `ucbkAmount` (expect 10.00, not 10 + fuel + PPD), then Insert to Live.

**H2 — manual push and nightly push use different raw bases (high that the code does this; medium that it explains Draeger).**
The only write to template `RawBaseAmount` is the self-heal at `RecurringJobRepository.cs:351-356`. Recalculate, inline amount edits and breakdown sums update `UcbkAmount` without touching it. Manual push prices off the stale `RawBaseAmount`; nightly prices off `ucbkAmount - FuelSurchargeAmount`.

```sql
SELECT ucbkID, ucbkJobNumber, ucbkClientID, ucbkAmount, FuelSurchargeAmount, RawBaseAmount,
       ucbkAmount - ISNULL(FuelSurchargeAmount,0) AS NightlyRawBase, RatedManually
FROM tucJobBooking
WHERE ucbkActive = 1 AND RawBaseAmount IS NOT NULL
  AND ABS(RawBaseAmount - (ucbkAmount - ISNULL(FuelSurchargeAmount,0))) > 0.01;
```

**H3 — fuel charged on a fuel-inclusive amount (medium).** For NZ the breakdown trigger sets `ucbkAmount = SUM(ChargeAmount)` including fuel but leaves `FuelSurchargeAmount` alone; the schedule path uses `@RprRawBase = ucjbAmount` with no subtraction. This is Deane's original complaint.

**H4 — copied template breakdown overrides the repriced total (medium-low).** Both insert procs copy template breakdown rows to the live job and the trigger re-sums them.

**Open design questions from the ticket, as the code stands:**

| Edit mode | Current behaviour |
|---|---|
| Recalculate | Clears `RatedManually` and re-rates via the API. Doesn't refresh `RawBaseAmount` (H2). |
| Raw base | Broken as in H1. |
| Gross | Pins the price with no fuel float. The procs call this intended. Needs a business decision. |

Dead code: `tucClient.RecalcRecurringFuel` is still on the entity but nothing reads it.

### #217 Eden Office bulk-imported jobs: extra item charge

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/217>

Importer evidence is from the port in `RO/Core/Application/Services/BulkImport/`. Whether production runs the port or the original BulkImportHyper is unknown.

What is established:
- **Release from hold does not re-rate.** `UTL_stpJob_InsertFromTblBulkJob` (`MIG/20260928180300_Bug2_...`) inserts the live job with `tblBulkJob.Amount` and `Qty`, copies items and breakdown rows.
- **No off-by-one in the item formulas.** Zone, rule-based and importer all use `Quantity - 1`. So an extra item charge on a 1-item job means a rater was handed Qty = 2.
- After release, `trg_UpdateLiveJobTotals` sets `ucjbQty = SUM(Items)` from `tucJobItems`.

**H1 — item rows from another import land on the EO bulk job via an ID collision (medium; best fit to the symptom pattern).**
`NET_stpBulkJobItems_Insert` (`MIG/20260513171303_JobItemTypes.sql:151`; spot-checked) takes one `@JobID` and tests it first as a `tblBulkJob.BulkJobID` booked in the last 7 days. The on-demand import path passes a `tucJob` id. If the two id ranges overlap, another job's items are upserted onto the bulk job: item 0 overwrites, items 1+ are added. A 1-item victim gains rows whenever the other job has 2+ items; a 3+ victim almost never does. That matches "intermittent, mostly 1–2 item jobs, nobody changed the quantity".

```sql
-- kills or keeps H1 in one query
SELECT (SELECT MAX(BulkJobID) FROM tblBulkJob) AS MaxBulkJobID,
       (SELECT MAX(ucjbID) FROM tucJob) AS MaxUcjbID;

-- a foreign barcode on the EO job is the tell
SELECT b.BulkJobID, b.JobNumber, b.Qty, b.Amount, i.ItemID, i.Items, i.Barcode
FROM tblBulkJob b LEFT JOIN tblBulkJobItems i ON i.JobID = b.BulkJobID
WHERE b.JobNumber LIKE 'EO2607048814%' ORDER BY b.BulkJobID, i.ItemID;
```

**H2 — a Despatch re-rate after release writes the wrong breakdown (medium).** Only jobs touched after release are re-rated, which gives the intermittency. The payload sends both `Quantity` and one `Packages` entry per item row; if the API counts both, you get an extra item. For schedule jobs it rates at `tenantNow` (line 854 again). A "Rate updated to X from Y" note on the job identifies the triggering edit.

**H3 — the "1hr $62.03" line is the schedule's pickup leg (medium for that figure; doesn't explain the extra item).** `fncT_BulkZoneRate_WithLinehaul` (`CRE:10181-10272`) rates the pickup at speed 1 (one hour) by default, at `GETDATE()`, then grosses up for PPD. That is a different job from the booking page's 1hr $36.99. Line 10229 also puts the full pickup base into `AdditionItemTotalAmount` when Qty = 1.

```sql
SELECT BulkRunScheduleId, Name, BookPickup, PickupRatingSpeed, PickupDepotId, AutoBook
FROM tblBulkRunSchedule
WHERE BulkRunScheduleId = (SELECT TOP 1 ScheduleID FROM tblBulkJob WHERE JobNumber = 'EO2607048814');
```

**H4 — breakdown doubled between import and release (low).** Release copies once and a second release is a no-op.

Side defects seen: `INT_stpJob_BulkInsert` uses an unassigned `@Date` in its fuel call (`CRE:10548`, `10630`); the archive procs disable the breakdown sync trigger table-wide while they run, so a release in that window would not sync.

Overlap: `WS_stpBulkJob_Update` (`CRE:37349-37611`) is the only place that rewrites child quantities and breakdowns on a quantity change, so it is the likely link to #310/#322 and to #820.

---

## Group D — config and feature gaps

### #213 Courier percentage in Client Manager ignored

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/213>

Courier pay is computed by trigger `tucJob_InsertUpdate_CalculateCourierPayment` as `RawBaseAmount x pct`, with this precedence (read on the NP branch file, `MIG/20260930090000_NetworkPartnerCourierPaymentTriggers.sql:61-71`):

1. relationship type doesn't post to courier → 0
2. no courier → 0
3. internal courier → 0
4. `tucJob.CourierPercentageOverride`
5. `tblClientAvailableSpeed.CourierPercentage` (client + speed)
6. `tucJobType.CourierPercentage` (speed)
7. `tucClient.CourierPercentage` (Admin Manager client level)
8. `tucCourier.uccrPercentage`
9. 0.4

There is no zone, depot, postcode or rate-code term. Client Manager writes its value to `BulkZoneRate.CourierPercentage`, and the research found no read of that column in any migration or local C#. **This claim was not independently re-verified** and Client Manager's source isn't local; confirm before relying on it.

**Conclusion (high, with that caveat):** feature gap, not a bug. The 70% is saved and displayed but never consumed.

**NP interaction:** on `feat/np-courier-pay-triggers`, jobs with `NpAgentId` set skip this cascade and use the new NP trigger, which ignores `CourierPercentageOverride`. If the Gisborne driver is paid as a network partner (not verified), an override-based fix does nothing after that merge.

**Smallest change:** where the zone rate is already resolved (`WS_stpBulkScheduleJob_Insert`, `MIG/20260925100000_...:403`, and `WS_stpBulkScheduleJob_InsertChildJobs`), also resolve the matched `BulkZoneRate.CourierPercentage` and stamp it into `CourierPercentageOverride` when that is NULL. The trigger needs no change. Limits: zone-rated schedule jobs only; granularity is zone, so Marcus's single-postcode case needs its own zone.

**Config-only stopgap:** set `tblClientAvailableSpeed.CourierPercentage = 0.70` per client and speed (step 5). It applies in every depot, not just Gisborne.

```sql
SELECT * FROM BulkZoneRate WHERE CourierPercentage IS NOT NULL;
```
Then pull the Gisborne driver's recent jobs for the three clients and check `CourierPercentageOverride` is NULL and `NpAgentId`.

### #226 Air NZ dry ice DG charge

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/226>

- The fee is hard-coded in `NP_stpGetNationwideRates`: `MIG/20260918110000_NationwideFlightBreakdownMissingPPD.sql:208`, `WHEN @DangerousGoods = 1 THEN 83 --Also need to add case for 21 for dry ice` (spot-checked), divided by `tucClient.AirNZMargin`.
- DG class never reaches rating. `NP_stpJob_NationWideFlight_Insert` takes `@DGClass`, collapses it to a bit (`MIG/20260901132615_CustomJobNumberSuffix.sql:2074-2078`), and stores the class on the job unpriced.
- $100 = 83 / a margin of 0.83 (inference). On the same reading the comment's 21 gives about $25, not $30, so **the dry-ice cost figure needs confirming with Deane**.

**Hotfix:** add `@DGClass int = NULL` to `NP_stpGetNationwideRates`, branch on class 9, and pass it from the two SQL callers and the booking quote call. Class 9 is "Miscellaneous", not dry-ice-only, so the rule may need class 9 **and** dry-ice weight > 0.
**Proper fix (Deane's proposal):** replace the constants with a DG rates table (class x service) joined at the same line.

The lbs/kg default is in the `booking` repo's AngularJS front end (Confirm DG modal), which isn't local.

```sql
SELECT ucclID, AirNZMargin, AirNZKnownShipper, 83 / NULLIF(AirNZMargin, 0) AS DgChargeBeforePPD
FROM tucClient WHERE ucclID = <client>;
```

### #219 World Tracer 74c per item

Ticket: <https://deliver-different-testing.github.io/1on1/#/tickets/219>

This is new capability, not a bug. Three things block the obvious approaches:

- **No durable World Tracer marker.** `JobSource` has no WorldTracer value. The only link is `IntMgrWorldTracerBdoSync.JobId`, which is nulled when the job archives.
- **NZ has no "no courier pay / no fuel" line.** `RawBaseAmount = ucjbAmount - fuel - PPD`, and courier pay is a percentage of that, so the courier would be paid on the 74c.
- **Accessorials overwrite legacy-rated jobs.** `sp_AddJobAccessorial` inserts a breakdown row and the sync trigger then sets `ucjbAmount` to the sum of breakdown rows. A baggage job with no breakdown rows would be left at just the accessorial. (That baggage jobs have no rows is inferred.)

Options:
1. **Durable marker** (needed for any option): a `JobSource` value or bit column set at booking.
2. **Bill outside `ucjbAmount` (lowest risk):** an invoice-time line in Accounts, bags or items on WT-flagged jobs x 0.74. Leaves raw base, fuel and courier pay untouched. No existing per-item invoice-line hook was located; needs scoping.
3. **In-job line (higher risk):** a breakdown row plus a change to the NZ raw-base derivation to exclude non-commissionable rows.

Open question for Marcus/Deane: does "per item" mean bags (BDO rows) or job quantity?

---

## US cross-check

Kerran, you wrote the US rating path and the breakdown functions, so this section doesn't describe them. It only lists where NZ diverges from them, because several of these tickets are that divergence.

### The three differences that matter

| | US (Excelerator path) | NZ today |
|---|---|---|
| **Breakdown rows at insert** | Always written. `DD_stpJob_Excelerator_Insert` calls `DD_InsertPricingBreakdown` (`MIG/20260925132718_FixErroneousAH.sql:580,591`), including a `Manually Rated=` line for fixed amounts (`:237`). | The core on-demand insert `UTL_stpJob_Insert` writes none (`CRE:29774+`). Rows exist only where another path adds them: bulk/schedule, prebook, a later Despatch re-rate, or the API after booking (not visible locally). |
| **Breakdown is authoritative** | `TR_PricingBreakdown_tucJob_Sync` derives `ucjbAmount`, `CourierPayment`, `FuelSurchargeAmount` and `CourierFuel` from the rows. | Same trigger, but for NZ it derives only `ucjbAmount` (`MIG/20260728102944_...:34-37`). Courier pay comes from the percentage cascade trigger; fuel and raw base from separate `tucJob` triggers. |
| **One engine, one call** | `UTL_fncJob_ExceleratorRate` returns Rate, Fuel, DriverPay, DriverFuel and the line items together (`FixErroneousAH:241`), and quote, insert and re-rate all use it. | Quote, insert and re-rate use different procs that take different inputs. Insert calls the scalar `UTL_fncJob_Rate` and discards the description (`CRE:29930`). |

### Ticket by ticket

| # | US behaviour | What that means for the NZ fix |
|---|---|---|
| 820 | **US had the same bug and it was fixed on 17 Sep.** `MIG/20260917150000_WireCubicListIntoRateDescribed.sql`: "per-package cubic excess charging silently never applied when repricing through this path". It adds `@CubicList` to `DD_stpJob_Rate_Described`, sourced in despatchweb via `BaseJobRepository.GetCubicListAsync`. | Port the same pattern to the NZ re-rate: `NET_stpJob_BulkZoneRate_Described`, `fncT_StpBulkZoneRate_GetAmountByJobID` and the `UrgentRerateObject` payload. The NZ dispatcher `NET_stpJob_Rate_Described_All` has no `CubicList` reference at all. |
| 208 | The US schedule insert rates through the P2P engine: `DD_stpBulkScheduleJob_Insert` calls `DD_stpGetExceleratorRates` (`MIG/20260925100100_...:321`). | The NZ twin `WS_stpBulkScheduleJob_Insert` needs the equivalent branch for P2P-grouped speeds. The US proc is the reference implementation. |
| 225 | After-hours via ExtraCharges carries a per-charge fuel flag (`ExtraCharges.ApplyAfterHoursFuel`, `MIG/20260914160000_...:157,303`). | The NZ block bolted onto the same function (`FixErroneousAH:965-1008`) bypasses that and adds `tblAfterHours.Amount` flat. Either apply MFV/PPD in that block or move NZ after-hours onto the ExtraCharges row. |
| 213 | Driver pay is a rate on the rate card (`ZoneCombo.DriverRate`, `DistanceRates.BaseChargeDP`) and lands in `CostAmount` per line. | NZ courier pay is a percentage of raw base with no zone term. A zone-level courier % is natural under the US model and awkward under the NZ cascade. |
| 219 | A non-commissionable, non-fuel line is just a row with `CostAmount` NULL and a name without "Fuel". | On NZ the same row raises `ucjbAmount`, hence raw base, hence courier pay. This ticket needs the NZ derivation changed or the charge kept off the job. |
| 215 | Fuel is a line; re-rating regenerates it. | NZ reconstructs raw base by subtracting stored fuel from stored totals, which is where the stale-value defects come from. |
| 218 | **Same exposure.** `DD_stpJob_CreateReturnParent` is shared and has no country branch (`CRE:4923-5159`); the parent gets a snapshot and no rows. | Not an NZ-only problem. Worth checking whether US return parents show the same drift; the fix belongs in the shared proc. |
| 224 | US re-rate bypasses the API (`JobRepository.RatingOperations.cs:407`) and passes the job's date. | NZ goes via the API and substitutes `tenantNow` for schedule jobs (`RateJobService.cs:854`). The `RatedManually` probe skip is in shared React code and applies to both. |
| 216 | Not checked on the US side. | The silent-$0 paths are in the NZ legacy and regional functions. |
| 217 | Not checked on the US side. | The item-insert proc `NET_stpBulkJobItems_Insert` is shared, so the id-collision hypothesis would apply to US bulk imports too. |
| 226 | `UTL_fncJob_ExtraRate` has `DangerousGoodsCharge` and `DryIceCharge x @DryIceWeight` from ExtraCharges (`MIG/20260914160000_...:162-165,266-271`). | The NZ flight proc `NP_stpGetNationwideRates` hard-codes 83. The US ExtraCharges columns are a ready-made model for the rate table Deane proposed. |

**Takeaway:** #820, #208, #225 and #226 each already have a working answer on the US path. #218 and possibly #217 are shared defects, not NZ ones.

---

## Adding price breakdowns to all NZ jobs

The question: if every NZ job carried PricingBreakdown rows the way US jobs do, would these tickets go away? Short answer: it removes the cause of two, shrinks two more, and makes the rest diagnosable, but only if it is done as "one engine returns the breakdown", not as "also write some rows".

This builds on `pricing-breakdown-gap-analysis.md` (18 Mar), which sets out the four-phase path (populate, reconcile, edit path, make authoritative). That doc's open question 1, the source of the courier-pay trigger, is now answered: the cascade is in `MIG/20260930090000_NetworkPartnerCourierPaymentTriggers.sql:61-71` and summarised under #213 above.

### Where NZ jobs get rows today

| Path | Rows written? | Evidence |
|---|---|---|
| On-demand insert (`UTL_stpJob_Insert`) | No | No PricingBreakdown reference in the proc; it calls scalar `UTL_fncJob_Rate` and adds fuel to the total (`CRE:29908-29932`) |
| Booking page and WebAPI, at booking | No | Read 2 Oct: the API has no PricingBreakdown write; the booking portal's only write is on job-list edit (`BK/.../JobService.cs:2643`). The `Base=Amount~0.00` note in `extra-charges-deep-dive.md` was not found in either repo |
| Booking portal job-list edit | Yes, from the re-rate description | `BK/wwwroot/App/Components/JobList/jobListControl.js:560-562` |
| Bulk / schedule (`WS_stpJob_Insert` bulk branches) | Yes, via `PricingBreakdownBulk` | `MIG/20260908142042_BulkContactID.sql:407, 3742-3751, 3887-3896` |
| Prebook / recurring template | Yes | same file `:612` |
| Recurring insert-to-live | Yes, copied from template, then Fuel and PPD lines replaced | `MIG/20260820121330_...:12-85` |
| Despatch re-rate | Yes, rebuilt from the API's description | `DW/Repositories/JobRepository.RatingOperations.cs:264, 345-350` |
| Truck, nationwide, from-parent inserts | Calls present but commented out | `CRE:21317, 21332, 31915, 31930, 33596, 33614, 34090, 34107` |
| Return parent | No | `CRE:4923-5159` |
| Baggage (World Tracer) | Inferred no | `WS_stpJob_Insert` only touches the table in its bulk branches |

So coverage is partial and depends on how a job was created and whether anyone has re-rated it since. That inconsistency is itself a cause: the sync trigger sets `ucjbAmount = SUM(rows)`, so the first write of any row to a job that had none replaces the amount with just that row (the #219 blocker, and #218 H2/H4).

A coverage query to size the gap before deciding anything:

```sql
SELECT g.GroupingName, jt.ucjtName,
       COUNT(*) AS Jobs,
       SUM(CASE WHEN pb.JobID IS NULL THEN 1 ELSE 0 END) AS NoBreakdown,
       SUM(CASE WHEN pb.JobID IS NOT NULL AND ABS(pb.Total - j.ucjbAmount) > 0.01 THEN 1 ELSE 0 END) AS RowsDontSum
FROM tucJob j
JOIN tucJobType jt ON jt.ucjtID = j.ucjbSpeed
LEFT JOIN tucJobTypeGrouping g ON g.GroupingID = jt.GroupingId
LEFT JOIN (SELECT JobID, SUM(ChargeAmount) AS Total FROM PricingBreakdown GROUP BY JobID) pb
       ON pb.JobID = j.ucjbID
WHERE j.ucjbVoid = 0
GROUP BY g.GroupingName, jt.ucjtName
ORDER BY NoBreakdown DESC;
```

### What has to change

**1. The legacy engine's output is not in the parser's format.**
`UTL_fncJob_RateAndDescription` already itemises, but as display text: `'Plus Weight Excess = $' + ...`, `'Pickup Afterhours Fee = $' + ...`, `'Saturday Fee = $5.25'` (`CRE:24767-26300`). `DD_InsertPricingBreakdown` splits on `CHAR(13)`, `=` and `~` and expects `Name=Amount~Cost` (`MIG/20260224141710_AccessorialJobListPB.sql:12-80`). The legacy lines have spaces, a `$`, and no cost part. Either the function gains a second, parser-format output column, or an adapter normalises it. A second column is cleaner and leaves the display text alone.

**2. Fuel and PPD are folded into each line, not separate.**
Legacy lines are `...WithSurcharge` amounts: fuel is applied per component inside the function, and again on the whole amount at insert (`CRE:29930-29931`). The NZ triggers then back fuel and PPD out of the total to get raw base (`MIG/20260810100000_...:311-317`). For rows to be useful they need raw base lines plus explicit `Fuel` and `PPD` lines, which is the shape `UTL_stpJob_ApplyRecurringFuelReprice` already writes for recurring jobs. That proc is the working precedent on NZ.

**3. Every insert path has to write rows, in the same transaction as the job.**
`UTL_stpJob_Insert` is the main gap; the commented-out calls in the truck, nationwide and from-parent procs are the rest. A job that exists without rows, even briefly, is exposed to the overwrite problem above.

**4. Parent and child placement needs one rule.**
Split and nationwide parents hold rows on the parent with `ChildJobID`. Return legs hold their own rows and the parent holds none. `GetEffectiveJobId` (`DW/EntityClasses/DespatchContext.Partial.cs:55-60`) assumes the first model for every family. Pick one model per relationship type and make the trigger, the proc and `DW` agree. Section 6 of the gap-analysis doc proposes the data model.

**5. Decide whether cost moves onto the rows (phase 4 of the gap-analysis doc).**
- **Charge side only** (rows written everywhere, NZ courier pay still from the percentage cascade): low risk, no change to what couriers are paid. Fixes the overwrite problem and gives an audit trail. Does not help #213 or #219.
- **Cost side too** (NZ branch of the sync trigger derives `CourierPayment` and fuel from rows, as US does): this is what makes #213 and #219 clean. It means retiring `tucJob_InsertUpdate_CalculateCourierPayment` and the raw-base trigger for NZ, and it collides directly with the NP courier-pay triggers on `feat/np-courier-pay-triggers`, which extend that cascade. That branch should merge, or be reshaped, before this starts.

**6. Edits and re-rates have to regenerate rows, not totals.**
`RepriceJobWithBaseAmountAsync`, `SimpleRepriceJobManualAsync` and the bulk price upload write `UcbkAmount`/`ucjbAmount` directly and set `RatedManually`. Under an authoritative breakdown they would write a `Manually Rated=` row instead, as the US insert does. That also gives `RatedManually` a single meaning (theme 2).

**7. Backfill.**
Archived and in-flight jobs without rows either stay as they are (reports must tolerate both) or get a synthetic single `Base` row. `sp_JobArchive` already copies rows to `PricingBreakdownArchive`, and disables the sync trigger while it runs.

### What it would and wouldn't fix

| Ticket | Effect | Why |
|---|---|---|
| 219 | Unblocked | Accessorial no longer overwrites a job with no rows; with cost on rows, a `CostAmount` NULL line pays no courier |
| 213 | Unblocked, cost side only | Zone rate can carry its own driver rate per line |
| 215 | Mostly | Raw base and fuel are rows, so nothing is reconstructed from stale totals. The `RatedManually` skip still needs its own fix |
| 218 | Partly | Removes the "first write replaces the snapshot" failure once the parent/child rule is settled. The courier-app overwrite (H1) is separate |
| 225 | Only if after-hours moves to ExtraCharges | The bug is in the engine, not in storage |
| 217 | Diagnosis | The extra item would be visible as a line, with a timestamp |
| 820, 208, 216, 224, 226 | No | Wrong inputs, wrong engine, silent zero, flag handling and a hard-coded fee. A breakdown of the wrong price is still the wrong price |

### Recommendation

Treat this as two pieces of work, in this order:

1. **Unify the NZ rating call first.** One function used by quote, insert and re-rate, returning total plus parser-format lines, taking the same inputs each time (cubic and weight lists, booked time, schedule context). This is what closes #820, #224 and the re-rate half of #217, and it is the US design.
2. **Then write rows on every NZ insert, charge side only.** Low risk once step 1 exists, because the lines come from the same call that produced the amount.
3. **Cost side last, and only after the NP pay branch has landed.** It changes how couriers are paid and needs its own reconciliation run against the current cascade before switching over.

Doing step 2 without step 1 would store, faithfully, the output of three paths that disagree.

Open questions for Kerran:
- Answered 2 Oct: the WebAPI does not transform the legacy description. It returns SQL's `@Description` verbatim, and both `DW` and the booking portal feed that string to `DD_InsertPricingBreakdown`. So the legacy display text is already being parsed into rows on re-rate; worth checking what those rows look like for a legacy speed.
- Are the commented-out `DD_InsertPricingBreakdown` calls in the truck, nationwide and from-parent procs disabled for a known reason?
- Is `tblSetting.CountryCode` really NULL on NZ staging? If so the NZ branches of the sync trigger and the schedule insert are not being exercised there.

---

## Two-week plan

Steve has allocated about two weeks to NZ rating. This plan assumes Claude drafts the code and queries, and Kerran reviews, merges to GitLab and deploys. It is a proposal for Kerran to correct, not a commitment.

### Is fixing tickets wasted if breakdown-on-all-jobs is the goal?

Mostly not. Five tickets are untouched by breakdown rows and need fixing anyway. The work that would be thrown away is small:

| Fix | Survives the breakdown work? |
|---|---|
| #225, #226, #224, #217, #216 data fix | Yes; the breakdown work doesn't touch them |
| #218 | Yes; settling the parent/child rule is a prerequisite |
| #820, #208 | Yes, if done as input and engine parity, which is step 1 of the breakdown work |
| #215 raw-base edit | Partly; small, but the arithmetic it patches goes away once fuel is a row |
| #213 override stamp, #219 in-job line | No. Hold these for the cost side; use the config stopgap for #213 |

### What the API read changed about sizing

- **The core fix is input parity, and it is a contract change.** Quote, insert and re-rate each build their own proc arguments (three copy-pasted insert builders, a separate quote builder per engine, a re-rate that shares nothing). The re-rate request model lacks the fields. Fixing it touches `API`, `DW`, `BK` and SQL.
- **There is no test safety net.** The API tests cannot execute stored procs and none assert the arguments passed to one (`API/WebAPICore.Tests/TestSupport/SqliteDbContextFactory.cs:19`). Argument-mapping tests need writing first.
- **Scope of consolidation:** 9 NZ rating call sites over 8 SQL objects, plus 7 insert procs that rate implicitly.
- **Breakdown rows at insert are closer than expected.** The calls exist and are commented out in `UTL_stpJob_Insert_Rated`, `UTL_stpJob_Truck_Insert` and `NP_stpJob_SDShorthaul_Insert`. The work is the description format and finding out why they were disabled.

### Week 1 — confirm, contain, and get re-rate parity

| Days | Work | Closes |
|---|---|---|
| 1 | Run the confirm queries (needs read access to the Urgent DB): #218 relationship-type flag, #217 max-id comparison, #215 template mismatch, #213 `BulkZoneRate` rows, breakdown coverage query, cubic units in `BulkZonePackageRate`, and `tblSetting.CountryCode` on staging | Settles the leading hypotheses |
| 1–3 | Contained fixes: #225 after-hours fuel block; #226 hotfix (class through quote, insert and flight proc) plus kg default; #218 exclude ReturnParent from the courier-response overwrite and fix the effective-job id for return legs; #224 probe skip and `RateJobService.cs:854`; #215 raw-base edit; #216 data fix plus a zero-rate guard on the booking page | #225, #226, #218, #224, #215 H1, #216 |
| 3–5 | Re-rate parity: add cubic list, weight list, DimensionsType and StockSizeId to `RerateRequest`, pass them through `NET_stpJob_Rate_Described_All` to the bulk-zone proc, and send them from `DW` and the booking job list. Restore the `US P2P` re-rate branch. Write argument-mapping tests alongside | #820 (re-rate), #208 (Recalculate) |

### Week 2 — quote/insert parity and rows at insert

| Days | Work | Closes |
|---|---|---|
| 6–7 | One request-to-arguments mapper in the API used by quote, insert and re-rate. Pass StockSizeId and DimensionsType on quote. Align the date arguments between quote and insert | #820 (quote vs insert), #220 |
| 7–8 | P2P branch in `WS_stpBulkScheduleJob_Insert`, using the US twin as reference | #208 |
| 8–9 | Breakdown rows at insert, charge side only: parser-format output from the legacy functions, restore the commented-out calls, one parent/child rule for return jobs | Foundation for #219, #213 |
| 9–10 | Reconcile on staging: new amount and row totals against existing amounts for a sample of recent jobs per speed grouping; release | |

### After the two weeks

- **Cost side on the rows** (courier pay and fuel derived from breakdown on NZ). Needs the NP pay branch merged first and a parallel run across at least one weekly pay cycle. Delivers #213 and #219.
- **DG rate table** (Deane's proposal) to replace the #226 hotfix.
- **#217**, if the confirm query points at the importer rather than the shared item-insert proc.

### Risks and dependencies

- **Review load on Kerran.** With drafting done for him, his review and deploy time is the bottleneck, across four repos.
- **Staging may not exercise NZ paths** if `tblSetting.CountryCode` is NULL there. Check on day 1.
- **Database access for Claude is not set up.** Without it the day-1 queries fall to Kerran.
- **`api` and `booking` have no GitHub mirror.** They are local clones from GitLab only, and GitLab is read-only for Claude, so drafts for those two repos need a delivery route agreed (patch files, or mirrors created by Steve).
- **Week 2 is the part most likely to slip.** If it does, week 1 still stands on its own: the leakage fixes are in and re-rates stop corrupting dimension-priced jobs.

## Needed from the business

- **#216:** a job number (the ticket is title-only).
- **#225:** an example job (title-only).
- **#226:** dry-ice cost figure, from Deane.
- **#219:** bags or job quantity; preferred billing route.
- **#215:** what entering a gross amount on a recurring job should do.
- **#208 / #213:** fix now, or carry into the schedules rebuild.
