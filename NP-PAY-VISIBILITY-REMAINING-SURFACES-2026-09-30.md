# Network partner pay visibility — the remaining surfaces (2026-09-30)

## Source
Steve, 30 Sep 2026. Code checked at despatchweb GitHub `main` `4998cf8d` (GitLab `master` `a4b4a124` + docs), routed-operations `ed53655`, inboundagent GitLab `master` (shallow clone, read-only).
Companion docs: `network-partner-pay-visibility.md` §2.7 / §3 (the rule and why), `JACOB-NP-COURIER-PAY-TRIGGERS-2026-09-30.md` (Parts 1 and 2, already built: the triggers, and the two DespatchWeb modals).

## The rule, once
A logged-in **network partner** (`ScopeContext.IsNetworkPartner`, ClientTypeId 3, with `NpAgentId`) is shown **what they are paid**, never what the tenant charges:

| Tenant figure | Partner sees |
|---|---|
| `ucjbAmount` / `Amount` / `Charge` (job revenue) | `CourierPayment + CourierFuel` |
| Base line of a breakdown | `CourierPayment` |
| Fuel line | `CourierFuel` |
| Cost, profit, margin, `RawBaseAmount`, PPD, bonus, run revenue / payout | **nothing** |
| Any write to pricing | **403** |

Both fields are on `tucJob` / `tucJobArchive` (and `tucJobBooking`), populated by the Part 1 triggers at allocation. DespatchWeb already has the helper — `JobRepository.GetNetworkPartnerPayAsync(jobId)` and `GetNetworkPartnerPayByJobAsync(ids)` in `Repositories/JobRepository.NetworkPartner.cs` — so every DespatchWeb item below is "call the helper at the projection point". Routed Operations needs its own copy of the same two-line rule.

Parts 1 and 2 covered the job detail modal and the split modal. This document is everything else a partner can reach. Ordered by leak size.

---

## Part 3 — DespatchWeb: lists, search, export, dialogs (owner: Jacob)

### 3.1 What leaks today

| # | Surface | Where the amount comes from | Rendered? | Leak |
|---|---|---|---|---|
| A | **Job search → Export CSV** (`/Job/PodSearchDownload`) | `JobRepository.PodSearchDownloadAsync` (line 2813) → `JobMappings.LiveJobDownloadMapping` / `ArchivedJobDownloadMapping` (`Helpers/JobMappings.Download.cs` 25-32, 89-95) → `JobReportService.GeneratePodSearchCsvAsync` columns (`Services/JobReportService.cs` 108-114) | **Yes — a file the partner keeps.** Columns `Amount`, `Fuel`, `Ppd`, `CourierPayment`, `CourierFuel`, `CourierBonus`, `RawBaseAmount` | **Full revenue plus the tenant's cost side, per job.** This is Q18 from the spec, confirmed. Button: `JobSearchPage.tsx` 341-355 `handleDownload` → `lib/exportUrls.ts` 36. Not NP-gated. |
| B | **Dispatch board job list** (`/job` Index) and **Nationwide job list** (`NationwideJobListNew` etc.) | `BaseJobRepository.DespatchQry` line 168 → `JobMappings.JobDispatchMapping` → `DispatchJobViewModel.Amount = j.UcjbAmount` (`Helpers/JobMappings.Dispatch.cs` 182) | Not as a grid column — but the JSON carries `amount` for every row, and `DispatchPage.tsx` 545-556 / `NationwidePage.tsx` 559 / `JobSearchPage.tsx` 436 hand `job.amount` to the Accessorial Charges dialog | Revenue for every job in the partner's list is in the API payload (DevTools, or any future column). |
| C | **Job search results** (`/Job/PODSearch`, live jobs) | `JobRepository.PodSearchAsync` → `JobMappings.PodSearchMapping` `Amount = j.UcjbAmount` (`Dispatch.cs` 182). Archived rows (`PodSearchArchivedMapping`, `Archive.cs` 374) carry **no** amount. | As B | As B, live rows only |
| D | **Accessorial Charges dialog** (job actions menu on Dispatch and Job Search, `available: job => !!job.accessorialChargeGroupId`) | `job.amount` passed in as the base (`AccessorialChargesDialog.tsx` 184-188) | Yes, when a job has an accessorial group (US tenants in practice) | Revenue on screen. Low frequency for NZ partners, but it is a screen. |
| E | **Client jobs report** (`/Job/ClientJobsReportDownload`, `JobController.cs` 819) and **Price detail report** (`/Job/PriceDetailReportDownload`, line 802) | `JobReportService.GenerateClientJobsReportCsvAsync` (`Raw Base Amount`, `Fuel Surcharge Amount`, `Charge Excl GST`, lines 219-221); `PriceReportService.GeneratePriceDetailReportAsync` | Files | Neither endpoint checks the caller's scope. A partner who finds the URL (it is built client-side in `exportUrls.ts`) gets tenant revenue by client. |
| F | **Dispatch job detail** (`/Job/DispatchJobDetail`, archived branch) | `GetDispatchJobDetailAsync` — the live branch was substituted in Part 2; the archived `TblJobs` projection was not (it does not currently set `Amount`, so nothing leaks, but it is one edit from doing so) | No | None today; note only |

### 3.2 The change — one substitution point per query

All behind `Context.CurrentIsNetworkPartner` (the same switch Part 2 used), so tenant behaviour is untouched.

**A. Export** — `PodSearchDownloadAsync`. After the two `.Select(...)` projections (JobRepository.cs 2891, 2900), when NP:
```csharp
Amount        = row.CourierPayment ?? 0        // the partner's "Amount"
Fuel          = row.CourierFuel ?? 0
Ppd           = null
CourierBonus  = null
RawBaseAmount = null
```
and **drop the `CourierPayment` / `CourierFuel` columns** from the CSV for a partner (`GeneratePodSearchCsvAsync` column map) — they would be duplicates of Amount / Fuel and they leak the tenant's cost-side naming. Cheapest way: a second column map `NpCsvColumns` selected on scope, or filter the existing map by a `partnerHidden` set. `JobDownloadModel` already has `CourierPayment` / `CourierFuel`, so no DTO change.

Note `PodSearchDownloadAsync` opens its own contexts through `IDbContextFactory` (lines 28-29). `DynamicDespatchDBContextFactory.cs` 85-86 passes `IScopeProvider` into them, so the NP row filter **is** applied and `CurrentIsNetworkPartner` is available on those contexts. Worth an assertion in the test.

**B / C. Lists and search** — in `BaseJobRepository.DespatchQry` after line 168 (`allJobs` materialised) and in `PodSearchAsync` after the live projection (JobRepository.PodSearch.cs 211): when NP, load pay for the page's ids with `GetNetworkPartnerPayByJobAsync(pageJobIds)` and set `Amount = pay.Total` (null when the job is not in the dictionary). One extra query per page, keyed on the same ids already in hand. `DespatchQry` is `protected` on `BaseJobRepository`; the helper lives on `JobRepository`, so either move `GetNetworkPartnerPayByJobAsync` down to `BaseJobRepository` (it only needs `Context`) or expose it as a protected static taking a `DespatchContext`. Moving it is the smaller diff.

**D. Accessorial dialog** — no change needed once B / C land: `job.amount` will already be the partner's pay. But the dialog's own text says "amount" as the base for accessorial pricing; for a partner that base is meaningless. Hide the `accessorialCharges` action for NP (`DispatchJobActionsMenu.tsx` 37, `JobSearchJobActionsMenu.tsx` 29: add `&& !isNetworkPartnerSession()` to `available`). Accessorials are the tenant's pricing to manage, not the partner's.

**E. Reports** — return `403` for a partner at the top of `ClientJobsReportDownload`, `PriceDetailReportDownload` (and `RecurringJobsExportCsv`, line 757, for good measure). `JobController` does not currently take `IScopeProvider`; `PricingPermissionService` does (Part 2), so the cheapest gate is a new `IPricingPermissionService.CanExportPricingAsync()` returning `!CallerIsNetworkPartner`, used by those three actions — one constructor, one test class already in place. Hide the two report actions in `JobSearchPage.tsx` for NP as well (`handleClientReport` 357; the search actions menu), so the partner does not see buttons that 403.

**F.** Leave as is; covered by the test in 3.3 so a future `Amount = j.Amount` on the archived branch fails loudly.

### 3.3 Tests to add
- `JobRepositoryNetworkPartnerPricingTests` (exists): NP scope → `PodSearchDownloadAsync` rows have `Amount = CourierPayment`, `Fuel = CourierFuel`, null `Ppd` / `RawBaseAmount` / `CourierBonus`; `JobListAsync` / `NationwideJobListAsync` page rows have `Amount = CourierPayment + CourierFuel`; tenant scope unchanged.
- `JobReportServiceTests`: NP CSV has no `CourierPayment` / `CourierFuel` / `RawBaseAmount` / `Ppd` / `CourierBonus` header.
- `PricingPermissionServiceTests` (exists): `CanExportPricingAsync` false for NP.
- `JobControllerTests` (exists): the three report actions return 403 when the permission service says no.
- Jest: `DispatchJobActionsMenu` / `JobSearchJobActionsMenu` hide Accessorial Charges and the report actions when `window.IsNetworkPartner`.

### 3.4 Order
A first (it is a file). Then E (two-line gates). Then B / C together. D and F fall out.

---

## Part 4 — Routed Operations (owner: Kevin)

Routed Operations already knows who a partner is and already filters rows: `Core/Application/Services/Np/NpScopeResolver.cs` (`NpScope(IsAdmin, NpAgentId)`, resolved from the `IsNetworkPartner` / `NpAgentId` / `ClientTypeId` claims) and `NpScopeGuard.cs` (per-row checks, 403 on miss). The Route Viewer procedures take `@NpAgentId`. What is missing is the **amount rule** — and the Route Builder side has no NP concept at all.

`Core/Domain/Despatch/TucJob.cs` already exposes `CourierPayment` (334), `CourierFuel` (372), `NpAgentId` (490), `NpCourierPayment` (492). No entity change.

### 4.1 What leaks today

| # | Surface | Where | Rendered? | Leak |
|---|---|---|---|---|
| G | **Route Viewer mobile job detail** `/route-viewer/mobile` | `wwwroot/app/react/pages/route-viewer/Mobile.tsx` 473-481 "Charge" row, `job.amount.toFixed(2)`. Calls `useAuth()` (line 33) but never checks `isNetworkPartner` | **Yes** | Revenue on the partner's phone. The desktop equivalent `RvJobDetail.tsx` 231-236 already hides the Pricing tile for NP ("per master Section 7.11") — mobile was missed. |
| H | **Route Viewer job / run-job payloads** | `RouteViewerJobService.GetBulkJobAsync` (`Amount = r.Amount`, line 101, from `RVW_stpBulkJob`); `RouteViewerRunService.MapRawBulkJobRowToDto` (line 330, from `RVW_stpBulkRunJobs` / `RVW_stpJobSiblings`); `GetLinehaulJobsAsync` 421-437 (`RVW_stpLinehaulJobs`); DTO `Dtos/RouteViewer/BulkJobDto.cs` 170 `Amount` | Desktop hides it; mobile shows it | Revenue in every NP-scoped job payload |
| I | **Route Viewer CSV reports** | `RouteViewerReportService.RunReportAsync` 251-270: `RVW_stpRunAllocationReport`, `MissingScan`, `MissingRunScan`, `MissingTransitScan` — copies every column the proc returns, and does **not** pass `@NpAgentId`. Controller `RunViewerReportController` policy `RouteViewer.Admin`, which a partner passes (`Program.cs` 305-316 only require a tenant) | Files | Unknown columns (proc bodies are not in the repo — they are in dbmigrationsv2) and **unscoped rows**: a partner could pull other partners' jobs. Row leak first, money leak second. The Woop XLSX (`b.Amount`, line 59) is already blocked for NP. |
| J | **Route Builder / cockpit** | Policies `RouteBuilder.Read/Build/Admin` (`Program.cs` 257-285) only check tenant and not-courier — **a partner is not excluded**. `JobService.cs` 217 `Amount` (from `tblBulkJob.Amount`), editable via PATCH `/api/jobs/{id}` `case "Amount"` (406); `RunService.cs` 237-238 `Revenue` / `Payout`, 274 `Amount`; UI `components/cockpit/JobDetail.tsx` 112-113 (editable Pricing), `RunBuilder.tsx` 161/169 (Revenue / Payout totals), `lib/csvExport.ts` 28 (Amount column), `BulkImport.tsx` 402/479/662 | Yes, and **editable** | Tenant revenue and run payout, with write access. Route Builder is the tenant's planning tool; a partner has no business in it (this matches the configurator decision to remove Schedules / Recurring Routes from the NP lane, 16-17 Sep). |

### 4.2 The change

**J first — shut the door.** Deny the `RouteBuilder.Read/Build/Admin` policies when the `IsNetworkPartner` claim is `"True"` in `Program.cs`, and hide the Route Builder / cockpit / bulk import entries in `Sidebar.tsx` / `App.tsx` for `user.isNetworkPartner`. That removes the whole of J without touching any projection. Confirm with Steve that no partner is meant to build routes; the 16-17 Sep configurator changes say they are not.

**H — substitute at the mapping.** The RVW procedures return `Amount` from `tblBulkJob` / `tucJob`. Two options; the second is preferred:
1. In `MapRawBulkJobRowToDto` and `GetBulkJobAsync`, when `NpScope.IsAdmin == false`, look up `tucJob.CourierPayment + CourierFuel` by the row's tucJob id and overwrite `Amount`. Works today; one extra query per page.
2. Add `CourierPayment` and `CourierFuel` columns to `RVW_stpBulkJob`, `RVW_stpBulkRunJobs`, `RVW_stpJobSiblings`, `RVW_stpLinehaulJobs` (dbmigrationsv2), map them onto `RawBulkRunJobRow` / `BulkJobDto` as `PartnerPay`, and set `Amount = NpScope.IsAdmin ? Amount : PartnerPay` in the two mappers. No extra query; one migration, same repo the Part 1 triggers live in. **Pair it with `Amount = null` for NP when `PartnerPay` is null** so a job without pay shows blank rather than revenue.

Either way the rule is in the service, not the React code, so every consumer (desktop, mobile, siblings, linehaul) gets it.

**G — relabel, don't hide.** Once H lands, `Mobile.tsx` 473-481 is showing the partner's pay. Change the row label to "Your Pay" when `user.isNetworkPartner` (mirror what `RvJobDetail.tsx` does at 231, but show it rather than hide it — the partner should see their pay; the tenant decision in Section 7.11 was made before there was a pay figure to show). Decide with Steve whether `RvJobDetail`'s hidden Pricing tile should now show "Your Pay" too; the consistent answer is yes.

**I — scope the reports.** `RunReportAsync`: pass `@NpAgentId` to the four procedures (add the parameter in dbmigrationsv2, defaulting NULL so admin calls are unchanged) **or** return 403 for NP in `RunViewerReportController` until that is done. The 403 is a one-liner and should go in immediately; the scoped version can follow. When the procs are scoped, check their column lists for `Amount` / `Revenue` / `Payout` / `CourierPayment` and apply the same substitution or drop the columns for NP — the proc bodies are the source of truth and they are not in this repo.

### 4.3 Tests
- Policy tests: NP claim denied on `RouteBuilder.*`; allowed on `RouteViewer.*`.
- `RouteViewerRunService` / `RouteViewerJobService`: NP scope → `BulkJobDto.Amount == CourierPayment + CourierFuel` (or null); admin scope unchanged.
- `RunViewerReportController`: NP → 403 (interim) or rows limited to `NpAgentId` (final).
- Jest: `Mobile.tsx` Charge row labelled "Your Pay" for NP; Sidebar hides Route Builder for NP.

---

## Part 5 — Agent Portal (`inboundagent`, GitLab `urgent-couriers/inboundagent`) — verified, no change

DespatchWeb builds a per-job encrypted link (`Services/InboundAgentLinkService.cs`, `tblSetting.InboundUrl` + `EncryptJobIdReversible(jobId)`) that the assigned agent opens in the Agent Portal. Checked the portal source:

- `Controllers/JobController.cs` `Details` (line 59) loads the full `TucJob` entity (`jobRepository.GetByIdAsync`) and hands it to the view.
- `Views/Job/*.cshtml` render **no** amount, price or charge field.
- No DTO trims the entity, so `UcjbAmount`, `RawBaseAmount`, `CourierPayment` are all *available* to the template — nothing reads them today.

**No leak today.** Two cheap hardenings if anyone touches this app: project the job into a view model without money fields, and if an amount is ever wanted on the portal, it is `CourierPayment + CourierFuel` labelled as the agent's pay. Recorded so the next person does not add `@Model.UcjbAmount` in good faith.

---

## Part 6 — Not in scope, flagged
- **Partner Pricing Modes / cross-tenant partner jobs** (`IsPartnerJob`, `PartnerAgreedRate`): a different mechanism (§5 of the spec). A connected-tenant partner sees `PartnerAgreedRate`, not `CourierPayment`. Nothing here changes that path.
- **Courier Portal / driver app**: the partner's own drivers see whatever the NP shows them; `NpCourierPayment` is the field for that, and no surface reads it yet. Separate spec when the NP driver app is designed.
- **Configurator "Default Pay %" display bug** (`AgentWorkspace.tsx` ~1044 shows `0.57%` for 57%): Garry, one-liner, unrelated to leaks.

## Suggested sequence
1. Part 3A (export) and 3E (report 403s) — the files. Half a day.
2. Part 4J (Route Builder policy) and 4I interim 403 — one-liners, remove the largest unknown.
3. Part 3B/C (lists) and 4H (Route Viewer mapping, with the RVW proc columns in dbmigrationsv2). A day each.
4. Part 4G / RvJobDetail "Your Pay" label — after Steve confirms partners should see pay in Route Viewer.
5. Part 4I scoped reports — when the RVW report procs are next touched.
