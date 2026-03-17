# Frontend Patches

## 1. `dispatch-core.service.ts` — Update splitJob method

Find the `splitJob` method (~line 528) and replace with:

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

## 2. `job-context-menu.service.ts` — Add courier input to split flow

In the `splitJobAction` method (~line 491), after the meeting point address validation and before the API call, add the courier prompt:

Replace this block (~line 553-556):
```typescript
// Single API call to split job with meeting point
await this.DispatchData.splitJob(
    job.id,
    meetingPointAddress
);
```

With:
```typescript
// Optional: ask dispatcher for Leg B courier
let courierIdForLegB: number | null = null;
const courierInput = prompt("Optional: Enter courier number for Leg B (leave blank for unallocated):");
if (courierInput && courierInput.trim()) {
    const parsed = parseInt(courierInput.trim(), 10);
    if (!isNaN(parsed)) {
        courierIdForLegB = parsed;
    }
}

// Single API call to split job with meeting point and optional Leg B courier
await this.DispatchData.splitJob(
    job.id,
    meetingPointAddress,
    courierIdForLegB
);
```

> **Note:** The `prompt()` is an MVP approach. A proper Material dialog with courier search/autocomplete would be better UX. This can be improved in a follow-up iteration.
