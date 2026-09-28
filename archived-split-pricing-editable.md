# Archived split jobs: Price Breakdown locked when it shouldn't be

**For:** Jacob · **From:** Steve · **Date:** 28 Sep 2026
**Branch:** `fix/archived-split-pricing-editable` (off GitLab master as of `9b493e12`, 28 Sep 16:33)

## The bug

Open the Price Breakdown on an archived split parent from last week (e.g. **E2142V**) and the per-leg grid opens **"view only"**. Every share %, revenue and cost field is disabled, even when the parent isn't invoiced and neither leg is settled.

Rule we want: **archived is not a lock.** Only these lock, per §7.5 of `job-splitting-price-breakdown.md`:

| Lock | Trigger |
|---|---|
| Revenue + Share | Parent invoiced (`UcjbInvoiceNo` or `InvoiceProcess.UcipDone`) |
| Share | Any leg settled (`CourierSettlementBatchId`) |
| That leg's cost | That leg settled |
| Whole grid | Job `Locked` (`UcjbLocked`) — same as the flat dialog |

## Root cause

1. **Front end.** `useJobActions.ts` `handlePricingClick` opened the grid with `readOnly: isSplitChild || splitParentIsArchived`. That was added in `cb920f9d` (25 Sep). Before that commit, archived split parents fell back to the flat dialog, which is only gated on `!!j.locked`. So this is a regression.
2. **Back end.** `UpdateSplitPricingBreakdownAsync` rejects anything that isn't a *live* split parent. It also only writes to `PricingBreakdowns` / `PricingBreakdownAllocations` / `TucJobs`. Removing the front-end flag on its own would just turn this into a 409 on save.

`GetSplitPricingLockStateAsync` already reads the archive tables for invoiced/settled, so the lock rules themselves were right. They were being overridden by the blanket `readOnly`.

## What the branch changes

### Back end
- **`UpdateSplitPricingBreakdownRequest.IsArchived`** (new). The save targets the archive tables when it's true.
- **`SplitPricingBreakdownDto.IsArchived`** (new). It's set from the read path so the grid can echo it back on save.
- **`JobRepository.UpdateSplitPricingBreakdownAsync`** branches on `IsArchived`:
  - It gets current legs from the new `GetEditableArchivedSplitLegIdsAsync`. That's the non-void children in `TucJobArchives` ∪ `TucJobs`, because a leg can lag its parent into archive.
  - The lock checks, share-sum and fuel-rename validation are unchanged and shared by both paths.
  - Item revenue/name writes go to `PricingBreakdownArchives`, scoped to `JobId == parent && ChildJobId == null`.
  - Share/cost-override writes go to `PricingBreakdownAllocationArchives`, scoped to the parent's own items.
  - It finishes with `RewriteArchivedAllocationsForParentAsync` instead of the live rewrite.
- **`GetEditableArchivedSplitLegIdsAsync`** (new, private) refuses the save (`InvalidOperationException` → 409) unless every root item has a persisted archive allocation row for every current leg. A pre-feature split only has the equal split synthesised on read, and there's nothing in the archive to write it back to. See open question 1.
- **`PricingBreakdownAllocationService.RewriteArchivedAllocationsForParentAsync`** (new, also on `IPricingBreakdownAllocationService`) mirrors the live rewrite against the archive tables:
  - It re-derives each allocation's `ChargeAmount` / `CostAmount` from `SharePercent` / `CostOverride`.
  - It writes each leg's `UcjbAmount`, `FuelSurchargeAmount` and `CourierPayment` to whichever of `TucJobArchives` / `TucJobs` holds the leg.
  - It never inserts or deletes rows.

### Front end
- **`useJobActions.ts`**: `readOnly: isSplitChild || !!j.locked`. Split children stay view-only by design.
- **`SplitPricingBreakdownDialog.tsx`**:
  - New `canChangeItems = canEdit && !breakdown.isArchived` hides **Add Item** and **Delete** for archived parents, since those still go through the live-only `PricingBreakdown` endpoints.
  - Revenue, name, share and cost stay editable within the locks.
  - Save sends `isArchived`.
- **`interfaces/splitJobs.ts`**: optional `isArchived` on `SplitPriceBreakdown` and `UpdateSplitPricingBreakdownRequest`.

### Tests
- **xUnit** (`JobRepositoryPricingBreakdownTests`):
  - The archived DTO is flagged as archived.
  - A revenue + rename edit on an archived parent that isn't invoiced or settled re-derives the archived legs.
  - A share + cost-override edit is applied.
  - An invoiced parent rejects a revenue edit and writes nothing.
  - With one leg settled, that leg's cost is rejected and the other leg's cost is accepted.
  - A pre-allocation archived split is rejected.
- **Jest**:
  - The `useJobActions` archived test is flipped (archived, not locked → editable), and a locked-archived test is added.
  - Two dialog tests: an archived parent hides Add/Delete but keeps fields editable, and save sends `isArchived`.

## Verification status

This branch sits directly on GitLab `master` `9b493e12` (28 Sep), so it's two commits you can merge or cherry-pick as they are.

- **C# build:** succeeds, with no new warnings in the changed files.
- **xUnit:** the full suite passes, 3283/3283. That includes the 6 new archived-split tests in `JobRepositoryPricingBreakdownTests` (62/62).
- **Jest:** 109/109 pass across `SplitPricingBreakdownDialog.test` and `useJobActions.test`. The 3 new or changed assertions fail on the pre-fix code.
- **Pre-push hook:** lint, `tsc`, .NET tests and Jest all passed on push.
- **Not yet done:** a manual check in a running app against a real archived split, e.g. E2142V from last week.

## Open questions for Jacob

1. **Pre-feature archived splits.** These have root items but no `PricingBreakdownAllocationArchive` rows, and they still 409 on save. To support them we'd insert the synthesised rows. Is `PricingBreakdownAllocationArchive.PricingBreakdownAllocationID` an identity column, or does the archive job copy IDs across from live? EF currently assumes identity. Answer that and it's a small follow-up.
2. **Add/Delete item on archived parents.** These are hidden for now. Do we need them, or is editing existing items enough?
3. **Parent `UcjbAmount`.** Neither the live nor the archive split save updates the parent's own amount after a revenue edit. This is existing behaviour and I left it alone. Is that intended, with the parent total always derived from the legs?
4. **Live path scoping (existing, untouched).** Live `UpdateSplitPricingBreakdownAsync` updates `PricingBreakdowns` by `PricingBreakdownId` alone, without checking the item belongs to `request.JobId`. The archive branch scopes it. Worth tightening live the same way.
