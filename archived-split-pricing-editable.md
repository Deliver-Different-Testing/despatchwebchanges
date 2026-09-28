# Split job Price Breakdown: editable when archived, from any leg, parent kept in step

**For:** Jacob · **From:** Steve · **Date:** 28 Sep 2026
**Branch:** `fix/archived-split-pricing-editable`, based directly on GitLab `master` `9b493e12` (28 Sep 16:33)

## Get the code (it's already written and tested, so don't recode it)

- **All changes in one diff:** https://github.com/Deliver-Different-Testing/despatchwebchanges/compare/9b493e12...fix/archived-split-pricing-editable
- **Branch:** https://github.com/Deliver-Different-Testing/despatchwebchanges/tree/fix/archived-split-pricing-editable
- **The 3 code commits** (the other 2 commits on the branch only touch this doc):
  1. [`6e66f5bd`](https://github.com/Deliver-Different-Testing/despatchwebchanges/commit/6e66f5bd860bb61d748536c1b4659f9f5c1be00c): archived split parents editable unless invoiced, settled or locked; archive-table save path
  2. [`aebbdcc8`](https://github.com/Deliver-Different-Testing/despatchwebchanges/commit/aebbdcc8b78233ff972dc51cc3e7086401b8d75a): Add/Delete item on archived split parents; parent `UcjbAmount` kept equal to its items, live and archived
  3. [`b6958c86`](https://github.com/Deliver-Different-Testing/despatchwebchanges/commit/b6958c865831b41d73f517e94c22ff1d4b1d3019): editable from either leg (not just the parent)

**To pull it into GitLab.** These three commits cherry-pick cleanly onto `develop` `fd7af78b`; that was checked on 28 Sep.

```bash
git fetch https://github.com/Deliver-Different-Testing/despatchwebchanges.git fix/archived-split-pricing-editable
git checkout -b fix/archived-split-pricing-editable origin/develop
git cherry-pick 6e66f5bd aebbdcc8 b6958c86
```

**Changed files:**
- `Repositories/JobRepository.cs`
- `Services/PricingBreakdownAllocationService.cs`
- `Interfaces/IPricingBreakdownAllocationService.cs`
- `Models/Dto/SplitPricingBreakdownDto.cs`
- `Models/RequestModels/UpdateSplitPricingBreakdownRequest.cs`
- `wwwroot/app/react/components/common/job-details/hooks/useJobActions.ts`
- `wwwroot/app/react/components/dialogs/split-pricing-breakdown-dialog/SplitPricingBreakdownDialog.tsx`
- `wwwroot/app/react/components/dialogs/split-pricing-breakdown-dialog/split-pricing-breakdown-dialog-react.module.tsx`
- `wwwroot/app/react/interfaces/splitJobs.ts`
- Tests in `DespatchWeb.Tests/Repositories/JobRepositoryPricingBreakdownTests.cs`, `useJobActions.test.ts` and `SplitPricingBreakdownDialog.test.tsx`

## The bug

Open the Price Breakdown on an archived split parent from last week (e.g. **E2142V**) and the per-leg grid opens **"view only"**. Every field is greyed out, even though the parent isn't invoiced and neither leg is settled.

## Steve's rules (decided 28 Sep)

1. **One modal for the whole split.** It's the same grid and equally editable whether it's opened from the parent or from either leg. Revenue lives on the parent; the cost columns belong to the legs.
2. **Archived is not a lock.** Only these lock (§7.5):

   | Lock | Trigger |
   |---|---|
   | Revenue + Share (and Add/Delete item) | Parent invoiced (`UcjbInvoiceNo` or `InvoiceProcess.UcipDone`) |
   | Share | Any leg settled (`CourierSettlementBatchId`) |
   | That leg's cost | That leg settled |
   | Whole grid | Job or its split parent `Locked` (`UcjbLocked`), same as the flat dialog |

3. **Add/Delete item** is allowed on archived split parents, within the locks.
4. **A revenue change updates the parent's amount** and is divided across the legs by their share, which starts from the mileage split. **The legs must always sum to the parent.**
5. **Splits archived before the per-leg editor existed stay as they are.** They have no allocation rows, and Steve confirms they're all invoiced.

## Root cause

- **Front end.** `useJobActions.ts` opened the grid with `readOnly: isSplitChild || splitParentIsArchived`. The archived part came in with `cb920f9d` (25 Sep, released 25 Sep 14:00) and is a regression: before that, archived split parents fell back to the flat dialog, which is only gated on `locked`.
- **Back end.** `UpdateSplitPricingBreakdownAsync` rejected anything that wasn't a *live* split parent, and only wrote to the live tables.
- **Existing parent-amount gap, on live jobs too.** Split-grid saves and add/update/delete on a split parent re-derived the legs but never updated the parent's `UcjbAmount`.
  - `sp_JobArchive` (migration `20260916141729`, lines 138–151) skips any family where `ABS(parent.ucjbAmount − SUM(child amount)) > 1`.
  - So a big enough revenue edit on a live split would stop that family from ever archiving. This branch fixes that as well.

## What the branch changes (3 code commits + this doc)

### Back end
- **`UpdateSplitPricingBreakdownRequest.IsArchived` / `SplitPricingBreakdownDto.IsArchived`** (new). The read path sets the DTO flag and the grid echoes it back on save.
- **`UpdateSplitPricingBreakdownAsync`** branches on `IsArchived`:
  - Archived saves write to `PricingBreakdownArchives` / `PricingBreakdownAllocationArchives`, scoped to the parent's own root items.
  - Lock, share-sum and fuel-rename validation are shared by both paths.
  - Both paths end by setting the parent amount.
- **`GetEditableArchivedSplitLegIdsAsync`** refuses an archived *grid save* (409) unless every root item has an archive allocation row for every current leg. That covers rule 5.
- **Archived `AddJobPriceBreakdownAsync` / `DeleteJobPriceBreakdownAsync`** on a split parent that has allocation rows (`IsEditableArchivedSplitParentAsync`):
  - They refuse if the parent is invoiced.
  - Add seeds the new item's allocation rows.
  - Delete removes the item's allocation rows explicitly, because the archive table has no FK cascade.
  - Both then re-derive the legs and update the parent amount.
  - Anything else keeps the existing flat behaviour.
- **`SetSplitParentAmountFromItemsAsync`** (new) sets parent `UcjbAmount` = the sum of its root items' `ChargeAmount`. It's called after every split-grid save and every add/update/delete on a split parent, live and archived.
- **`PricingBreakdownAllocationService.RewriteArchivedAllocationsForParentAsync`** (new, also on `IPricingBreakdownAllocationService`) is the archive-table version of the live rewrite:
  - It seeds a new item's rows at each leg's average share across the other items, as the live rewrite does.
  - It re-derives each allocation's revenue/cost using `PricingBreakdownAllocationCalculator.DistributeAmount`, which puts the rounding remainder on one leg so the legs sum exactly.
  - It writes each leg's `UcjbAmount`, `FuelSurchargeAmount` and `CourierPayment` to whichever of `TucJobArchives` / `TucJobs` holds that leg, since legs can lag their parent into archive.
- Confirmed in `dbmigrationsv2` (`20260916090100`): `PricingBreakdownAllocationArchive.PricingBreakdownAllocationID` is `IDENTITY(1,1)` with no FKs, so the inserts are safe.

### Front end
- **`useJobActions.ts`**: `readOnly: !!j.locked || !!parentJob?.locked`. The same grid is editable from the parent or a child, and a child still gets its own leg highlighted.
- **`SplitPricingBreakdownDialog.tsx`**:
  - Add/Delete are available whenever the grid is editable.
  - Save sends `isArchived`.
  - The banner now reads "One breakdown for the whole split, the same from the parent or either leg…", replacing the "child jobs show these figures read-only" wording.
- **`split-pricing-breakdown-dialog-react.module.tsx`**: add, delete and refetch pass `isArchived`.
- **`interfaces/splitJobs.ts`**: optional `isArchived` on `SplitPriceBreakdown` and `UpdateSplitPricingBreakdownRequest`.

### Tests
- **xUnit** (`JobRepositoryPricingBreakdownTests`, 14 new):
  - Archived grid save: revenue + rename, share + cost override, invoiced rejects, settled leg rejects only that leg's cost, and pre-allocation split rejects.
  - Parent amount updates after live and archived saves and after a live add.
  - Archived add seeds the leg rows and updates the amounts; archived add on an invoiced parent is rejected.
  - Archived delete removes the leg rows and updates the amounts.
  - **Legs sum to the parent** after an uneven-share (33.333333 / 66.666667) revenue edit, on both live and archived.
- **Jest:**
  - Archived and not locked → editable, including Add/Delete; archived and locked → read-only.
  - A split child → editable with its leg highlighted; a child whose parent is locked → read-only.
  - Save sends `isArchived`.

## Verification
- C# build: clean. **xUnit full suite 3291/3291.**
- **Jest 125/125** on the dialog and hook suites. `tsc --noEmit` clean. ESLint: no errors.
- Pre-push hook (lint, tsc, .NET tests, Jest): passed on push.
- **Not done yet:** a manual check against a real archived split, e.g. E2142V.

## Deploy note
Apply **`20260928120000_GrantPricingBreakdownAllocationArchivePermissions`** on every tenant before this goes out. Without it, reading an archived split fails with a SELECT permission error, and this branch also needs INSERT/UPDATE/DELETE on that table.

## Open item
- Live `UpdateSplitPricingBreakdownAsync` still updates `PricingBreakdowns` by `PricingBreakdownId` alone, without checking the item belongs to `request.JobId`. This isn't changed here; the archive branch is scoped. Worth tightening the live path the same way.
