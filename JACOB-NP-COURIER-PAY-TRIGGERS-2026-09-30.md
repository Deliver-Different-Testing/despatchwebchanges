# Jacob — Network partner pay: triggers + despatchweb display (2026-09-30)

## Source
Steve, 30 Sep 2026. Code checked against GitLab `despatchweb` master `a4b4a124` and `dbmigrationsv2` master `6e815c6` (29 Sep).
Full reasoning is in `network-partner-pay-visibility.md` **§2.7** (this repo, and the implementation copy in `Deliver-Different-Testing/Dispatch`). Read that section first; this note is the merge-and-test instructions.

## What you are merging
Two branches on the GitHub mirrors, both written and tested. **Part 1** (data) is a dbmigrationsv2 migration; **Part 2** (display) is a despatchweb branch. Part 1 must be deployed before or with Part 2, or the partner sees $0.

### Part 1 — the migration

- **Repo:** https://github.com/Deliver-Different-Testing/dbmigrationsv2
- **Branch:** `feat/np-courier-pay-triggers` (one commit on top of GitLab `master` `6e815c6`)
- **File:** `DatabaseScripts/Migrations/20260930090000_NetworkPartnerCourierPaymentTriggers.sql`

It passes the repo's `git-hooks/pre-commit` validation and `scripts/check-migration-collisions.sh` (both `COLLISION-REVIEWED` lines are in the header). No schema change. No despatchweb code change for this half.

The GitHub mirror's `master` is stale (June) — ignore it. The branch is based on current GitLab master, so it merges clean.

### To land it on GitLab
```bash
cd dbmigrationsv2
git remote add github https://github.com/Deliver-Different-Testing/dbmigrationsv2.git   # once
git fetch github feat/np-courier-pay-triggers
git checkout -b feat/np-courier-pay-triggers github/feat/np-courier-pay-triggers
git push origin feat/np-courier-pay-triggers      # then MR into develop/master as usual
```
If master has moved and someone has touched either courier-pay trigger since 11 June, the collision check will say so on commit — diff the bodies before you re-submit.

---

## Why (the bug)
1. When a job is allocated to a network partner (NP), only `tucJob.NpAgentId` is written (`NationwideJobRepository.AssignNpAgentToJobAsync`). `ucjbCourierID` stays blank, so `CourierPayment` is **0**. The partner is shown nothing, or the job revenue.
2. When the partner dispatches one of **their own** drivers from their board, it goes through the normal `JobRepository.AssignCourierToJobsAsync`, which writes `ucjbCourierID`. That fires `tucJob_InsertUpdate_CalculateCourierPayment`, which **recalculates `CourierPayment` from the driver's `uccrPercentage`** — overwriting what the tenant owes the partner with what the partner owes their driver. Tenant GP goes wrong silently.

## The rule (Steve, 30 Sep)
Two pay layers, two fields, never one calculation:

| Event | `CourierPayment` / `CourierFuel` (tenant → partner) | `NpCourierPayment` (partner → their driver) |
|---|---|---|
| Tenant allocates to NP (`NpAgentId` set) | `RawBaseAmount × pct`, pct = client `CourierPercentage` → else `tucAgents.DefaultCourierPayPercent` → else **0.4**. `CourierFuel = FuelSurchargeAmount`. | NULL |
| Partner dispatches own driver (`ucjbCourierID` set) | **untouched** | `CourierPayment × tucCourier.uccrPercentage` |
| Reprice (`RawBaseAmount` changes) | recalc as row 1 | recalc as row 2 |

`NpCourierPayment` is off **`CourierPayment`**, not `RawBaseAmount` — otherwise the driver gets paid the same as the partner. Percentages in this DB are fractions (`0.57` = 57%).

## What the migration does
1. **Two new triggers** — `tucJob_InsertUpdate_CalculateNetworkPartnerPayment` and `tucJobArchive_Update_CalculateNetworkPartnerPayment`. Only touch rows where `NpAgentId IS NOT NULL`. Layer 1 runs on `NpAgentId` / `RawBaseAmount` / `ucjbClientID` / `JobRelationshipTypeID` change (and insert); layer 2 runs on any of those **or** `ucjbCourierId`. NZ tenants only (`tblSetting.CountryCode = 'NZ'`), same scope as the existing cascade.
2. **Two-line change to each existing cascade trigger** (`tucJob_InsertUpdate_CalculateCourierPayment`, `tucJobArchive_Update_CalculateCourierPayment`), bodies re-submitted from `20260611143036_ActivateMasterSubForNZ.sql`:
   - early exit also fires on `UPDATE(NpAgentId)` — so **clearing** a partner puts the job back through the courier cascade;
   - the NZ cascade `INNER JOIN inserted` gains `AND inserted.NpAgentId IS NULL` — NP jobs never enter it.

   Diff against the June body is exactly those four lines; nothing else moved.
3. `CourierPaymentManualOverride = 1` still wins over layer 1, same as today.

## Test plan (staging, NZ tenant)
Pick a live job with no courier and no partner. Note `RawBaseAmount`, `FuelSurchargeAmount`, the client's `CourierPercentage`, the partner's `DefaultCourierPayPercent`, the driver's `uccrPercentage`.

| Step | Do | Expect |
|---|---|---|
| 1 | Allocate to an NP from Nationwide (`NpAgentId` set) | `CourierPercentage` = client % if set else partner default else 0.4; `CourierPayment = RawBaseAmount × that`; `CourierFuel = FuelSurchargeAmount`; `NpCourierPayment` NULL |
| 2 | Log in as that partner, dispatch one of their drivers | `CourierPayment`, `CourierFuel`, `CourierPercentage` **unchanged**; `NpCourierPayment = CourierPayment × uccrPercentage` |
| 3 | Reprice the job (change weight/items so `RawBaseAmount` moves) | both layers recalc from the new base |
| 4 | Set `CourierPaymentManualOverride = 1` and reprice | layer 1 untouched; layer 2 still recalcs from the (frozen) `CourierPayment` |
| 5 | Clear `NpAgentId` (un-allocate) | courier cascade runs again — with a driver on the job, `CourierPayment` goes back to the driver-cascade value; `NpCourierPayment` is left as-is (see follow-ups) |
| 6 | Archive the job, then repeat 3 on `tucJobArchive` | archive twin behaves the same |
| 7 | Regression: normal tenant job, dispatch to a tenant courier | unchanged behaviour (NP triggers exit early on `NpAgentId IS NULL`) |

SELECT-only check after each step:
```sql
SELECT ucjbID, NpAgentId, ucjbCourierID, RawBaseAmount, FuelSurchargeAmount,
       CourierPercentage, CourierPayment, CourierFuel, NpCourierPayment, CourierPaymentManualOverride
FROM tucJob WHERE ucjbID = @JobId;
```

---

## Part 2 — despatchweb: what the partner sees in the job detail modal

- **Repo:** https://github.com/Deliver-Different-Testing/despatchwebchanges
- **Branch:** `feat/np-pay-display` (one commit on top of GitHub `main`, which is GitLab `master` `a4b4a124` plus docs)
- **Scope (Steve, 30 Sep):** the job detail modal and the split job detail modal only. Job lists, job search export and Routed Operations are **not** in this change (see follow-ups).

### The rule
When the logged-in user is a network partner (`ScopeContext.IsNetworkPartner`, i.e. ClientTypeId 3):

| Surface | Tenant sees | Partner sees |
|---|---|---|
| Pricing tile on the job detail modal | `ucjbAmount` | `CourierPayment + CourierFuel`, tile labelled **Your Pay** |
| Price Breakdown dialog | PricingBreakdown rows with revenue / cost / profit / margin, summary cards, add / edit / delete | **Your Pay** dialog: two rows, Base = `CourierPayment`, Fuel = `CourierFuel`, amount column only, view-only |
| Split job (parent or leg) | split grid: per-leg revenue / cost / GP | the same **Your Pay** dialog for the job they clicked — never the grid |
| Add / update / delete price component, split breakdown save, simple reprice | allowed | **403** |

### Where it is done — server first
The substitution is server-side so the tenant's figures never reach the browser for a partner session.

| File | Change |
|---|---|
| `Repositories/JobRepository.NetworkPartner.cs` (new) | `GetNetworkPartnerPayAsync` (live row, then archive, both behind the NP query filter), `GetNetworkPartnerPriceBreakdownAsync` (the two synthetic rows, ids `-1` / `-2`, `CostAmount` null), `ApplyNetworkPartnerCharges` (rewrites `Charge` on the job and every related job) |
| `Models/NetworkPartnerPay.cs` (new) | `record NetworkPartnerPay(CourierPayment, CourierFuel)` with `Total` |
| `Repositories/JobRepository.cs` | `GetJobByIdAsync` (feeds `job/Detail`): substitutes `Charge` for NP. `GetJobPriceBreakdownAsync`: returns the pay rows for NP. `GetSplitPricingBreakdownAsync`: returns `null` for NP, which sends the client down the flat-dialog path. `GetDispatchJobDetailAsync`: substitutes `Amount` for NP. |
| `Services/PricingPermissionService.cs` | now takes `IScopeProvider`; `CanModifyPricesAsync` / `CanModifyPriceBreakdownAsync` return false for NP. Every price mutation on `JobController` already gates on these, so no controller changes. |

Client side, so the dialog reads as the partner's pay rather than a locked tenant breakdown:

| File | Change |
|---|---|
| `useJobActions.ts` | new option `isNetworkPartner`; `handlePricingClick` short-circuits before the invoiced / partner-job / split branches and opens the flat dialog with `{partnerView: true}` |
| `JobDetails.tsx` | passes `isNetworkPartner: isNetworkPartnerSession()` (reads `window.IsNetworkPartner`, same flag the dispatch dialog uses) |
| `PriceBreakdownDialog.tsx` | new `partnerView` prop: title *Your Pay*, subtitle *What you will be paid for this job*, no summary cards, columns Item Name + Amount only, no Actions column, forced read-only, partner-worded empty state |
| `price-breakdown-dialog-react.module.tsx`, `types/global.d.ts` | `open(...)` gains a trailing `options?: {partnerView?: boolean}` |
| `MetricsGrid.tsx` | Pricing tile label becomes *Your Pay* for a partner session |

### Tests (all green on the branch)
- `DespatchWeb.Tests/Repositories/JobRepositoryNetworkPartnerPricingTests.cs` — SQLite, NP scope vs tenant scope: pay rows not revenue rows; archive path; other partner's job returns nothing; split returns null; charge substitution nulls what the partner cannot see.
- `DespatchWeb.Tests/Services/PricingPermissionServiceTests.cs` — NP cannot modify; Internal / Customer / Tenant / DfAdmin still can.
- Jest: `PriceBreakdownDialog.test.tsx` (partner view columns, view-only, empty state), `useJobActions.test.ts` (NP opens partner view; never asks for the split grid even on a split child; invoiced job still shows pay), `MetricsGrid.test.tsx` (tile label).

### To land it on GitLab
```bash
cd despatchweb
git remote add github https://github.com/Deliver-Different-Testing/despatchwebchanges.git   # once
git fetch github feat/np-pay-display
git checkout -b feat/np-pay-display github/feat/np-pay-display
git push origin feat/np-pay-display      # then MR into develop as usual
```
The pre-push hook (lint, type-check, .NET tests, Jest) passes on the branch.

### Manual check (staging, after Part 1 is deployed)
1. Log in as the Golden Black Taxis (Palmerston North) NP user. Open a job allocated to them.
2. Pricing tile reads **Your Pay** and shows `CourierPayment + CourierFuel`, not the job amount.
3. Click it: **Your Pay** dialog, two rows (Base, Fuel), no cost / profit / margin, no Add / Edit / Delete, Close only.
4. Open a leg of a split job allocated to them: same dialog, not the split grid.
5. Log in as tenant staff: everything unchanged (Price Breakdown dialog, split grid, editing).

## Follow-ups
- **Other NP-facing amounts** — Part 2 covers the two modals only. The NP dispatch board / nationwide job list amount columns, the job search download / export (Q18 — it shows full revenue and is built from its own query), the Agent Portal per-job link, and Routed Operations still show tenant figures. Same rule, same `GetNetworkPartnerPayAsync`; each is its own change.
- **Path A jobs** (an agent rate priced the delivery, §2.3) — layer 1 will overwrite a rate-derived `CourierPayment`. Today the cascade zeroes those anyway, so no regression, but once the Path A speed set is settled (Q13) layer 1 needs a gate.
- **`NpCourierPayment` on un-allocate** — step 5 leaves a stale value. Harmless (partner no longer sees the job) but worth a `SET NpCourierPayment = NULL` in the cascade if you're in there.
- **Non-NZ tenants** — out of scope; their `CourierPayment` comes from rating procs.
- **Configurator display bug (Garry)** — "Default Pay %" on the agent card renders the stored fraction with a `%` suffix, so 57% shows as `0.57%` (`AgentWorkspace.tsx` line ~1044).
