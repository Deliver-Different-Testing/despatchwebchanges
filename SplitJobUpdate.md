# Split Job Implementation Update

**Date:** 16 March 2026
**For:** Jacob (Developer)
**Context:** Fixes 5 bugs in the Split Job feature as reported by Steve

---

## Summary of Changes

The Split Job function allows dispatchers to split a single job into two legs (pickup leg A → meeting point, delivery leg B → final destination). The current implementation has 5 bugs. This package fixes all of them and replaces the stored procedure approach with direct EF Core inserts.

---

## Bugs Fixed

### Bug 1: Speed ShortName appended to child job numbers
**Was:** `CreateMinimalTucJobAsync` calls SP `DD_stpJob_Excelerator_Insert` which appends speed suffix → `E14984OB` becomes `E14984OB1hr`
**Fix:** Replaced SP with direct EF Core `context.TucJobs.Add()`. Job numbers are now set exactly as generated (parent number + A/B suffix, no speed suffix ever).

### Bug 2: Child A status hardcoded to Acknowledge
**Was:** `pickupJob.UcjbStatus = originalCourierId.HasValue ? (int)JobStatus.Acknowledge : job.UcjbStatus;`
**Fix:** `pickupJob.UcjbStatus = job.UcjbStatus;` — always copies parent's exact status. If parent was Accepted with acceptance time, Child A reflects that.

### Bug 3: No option to assign Leg B courier at split time
**Was:** `SplitJobRequest` only had `jobId` and `meetingPointAddress`. No way to specify a courier for the second leg.
**Fix:** Added `CourierIdForLegB` (nullable int) to both C# `SplitJobRequest` and TS `SplitJobRequest`. Frontend split dialog now shows an optional courier number field below the address. If provided, Child B gets that courier assigned.

### Bug 4: Speed validation fails ~50% of the time
**Was:** `GetValidSpeedIdAsync` returns null for some speed types → `ArgumentNullException.ThrowIfNull` kills the entire split.
**Fix:** Removed `GetValidSpeedIdAsync` entirely. Children use the parent's speed directly — `job.UcjbSpeed` and `job.UcjbSpeedNavigation` — since they inherit the same service level.

### Bug 5: Courier not moving from parent to Child A
**Was:** Courier 220 stayed on parent E14984O instead of moving to Child A. The code set `job.UcjbCourierId = parentJobCourierId` on the parent but also set pickup courier correctly — the issue was that `CreateMinimalTucJobAsync` created a new row via SP and the courier assignment happened in a post-update that could be overwritten.
**Fix:** Direct EF Core insert means we build the complete entity in one place. Parent gets `parentJobCourierId` (system courier 1889). Child A gets the original courier. All in the same transaction, no SP interference.

---

## Architecture Change: SP → Direct EF Core Insert

**Removed:** `jobRepository.CreateMinimalTucJobAsync()` (calls `DD_stpJob_Excelerator_Insert`)
**Replaced with:** `context.TucJobs.Add(newChildJob)` with all fields set explicitly in C#

**Why:** The SP is designed for booking new jobs and includes logic for:
- Suburb lookups (unnecessary — we have all address data from parent)
- Pricing calculations (unnecessary — we re-rate after)
- Speed ShortName suffix appending (Bug 1)

Direct EF Core insert gives us full control over every field.

---

## Correct Split Job Process (per Steve)

1. Dispatcher clicks "Split" on a job
2. Confirmation dialog appears ("Are you sure?")
3. Address dialog opens pre-populated with delivery address — dispatcher sets the **meeting point**
4. Optional: dispatcher enters a courier number for Leg B
5. On submit:
   - Parent job retains same pickup/delivery info (client sees no difference)
   - Parent's courier replaced with system courier (1889)
   - Child A created: pickup → meeting point, gets original courier + parent's exact status
   - Child B created: meeting point → delivery, unallocated (or assigned if courier specified)
   - Prices split proportionally by distance ratio
   - Job numbers: parent number + "A" and + "B" (no speed suffix)
   - Parent/child linked via `ParentId`, `RootParentId` fields

---

## Files Changed

| File | Change |
|------|--------|
| `SplitJobService.cs` | Complete rewrite — direct EF Core inserts, all 5 bug fixes |
| `SplitJobRequest.cs` | Added `CourierIdForLegB` nullable int property |
| `ISplitJobService.cs` | Added `courierIdForLegB` parameter to `SplitJobAsync` |
| `JobController.cs` | Pass `request.CourierIdForLegB` to service |
| `splitJobApi.ts` | Added `courierIdForLegB` to TS interface |
| `dispatch-core.service.ts` | Added `courierIdForLegB` to splitJob method |
| `job-context-menu.service.ts` | Added courier input to split flow |

**No DB migration needed** — all fields (`ParentId`, `RootParentId`, `UcjbCourierId`, etc.) already exist on `tucJob`.

---

## Implementation Checklist for Jacob

- [ ] Replace `Services/SplitJobService.cs` with the new version
- [ ] Replace `Models/RequestModels/SplitJobRequest.cs` with the new version
- [ ] Replace `Interfaces/ISplitJobService.cs` with the new version
- [ ] Update `Controllers/JobController.cs` SplitJob action (line ~1084) — see patch below
- [ ] Update `wwwroot/app/react/services/splitJobApi.ts` — see new version
- [ ] Update `wwwroot/app/services/dispatch-core.service.ts` — see patch below
- [ ] Update `wwwroot/app/services/job-context-menu.service.ts` — see patch below
- [ ] Test: split a job with courier assigned → courier moves to Child A, parent gets 1889
- [ ] Test: split a job with no courier → both children unallocated
- [ ] Test: split with Leg B courier specified → Child B gets that courier
- [ ] Test: verify child job numbers have NO speed suffix
- [ ] Test: verify Child A status matches parent's status exactly
- [ ] Test: verify price split adds up to parent's original amount
- [ ] Test: speed validation no longer crashes (removed entirely)

---

## Controller Patch

In `JobController.cs`, update the `SplitJob` action:

```csharp
[HttpPost]
public async Task<IActionResult> SplitJob([FromBody] SplitJobRequest request)
{
    try
    {
        var staffInfo = await infoService.GetStaffInfoAsync();
        await splitJobService.SplitJobAsync(
            request.JobId,
            staffInfo.Text,
            request.MeetingPointAddress,
            request.CourierIdForLegB);
        return Ok();
    }
    catch (Exception e)
    {
        Log.Error(e, "{Message}", ErrorMessageStringFormatter.Format(e));
        return StatusCode(500, ErrorMessageStringFormatter.Format(e));
    }
}
```

## dispatch-core.service.ts Patch

```typescript
async splitJob(
    jobId: number,
    meetingPointAddress: IAddressViewModel,
    courierIdForLegB?: number | null
): Promise<void> {
    const data = {
        jobId,
        meetingPointAddress,
        courierIdForLegB: courierIdForLegB ?? null
    };

    await this.$http.post(`job/splitJob`, data);
}
```

## job-context-menu.service.ts Patch

After getting `meetingPointAddress` and before the API call, add a prompt for Leg B courier:

```typescript
// After meetingPointAddress validation, before API call:
let courierIdForLegB: number | null = null;
const courierInput = prompt("Optional: Enter courier number for Leg B (leave blank for unallocated):");
if (courierInput && courierInput.trim()) {
    const parsed = parseInt(courierInput.trim(), 10);
    if (!isNaN(parsed)) {
        courierIdForLegB = parsed;
    }
}

// Updated API call:
await this.DispatchData.splitJob(
    job.id,
    meetingPointAddress,
    courierIdForLegB
);
```

> **Note:** The `prompt()` approach is a simple MVP. For a better UX, this should be replaced with a proper Material dialog with courier search/autocomplete. The React `splitJobApi.ts` already supports the field for when a React dialog is built.
