# PricingBreakdown Gap Analysis: Courier Pay & GP Reconciliation

**Date:** 18 March 2026
**Author:** Steve Bonnici / EasyEA
**Status:** Issue Identified — Needs Architecture Decision
**Priority:** High — Foundational to accurate GP reporting across all DFRNT tenants

---

## 1. Problem Statement

Courier pay and client charge are calculated and stored through **two disconnected paths**, making it impossible to reconcile the itemised breakdown with the actual job-level totals. This creates:

- A Price Breakdown modal that shows costs that **don't match** the courier payment on the job line
- No granular audit trail for how courier pay was determined
- GP calculations that can't be verified at the line-item level
- A system that works "well enough" for simple A→B jobs at Urgent but **will break** for multi-tenant DFRNT deployments with different cost structures

### Real Example (Job KT516VANS)

| Source | Amount |
|---|---|
| Price Breakdown popup — Total Cost | **$18.50** (After Hours $10 + AH Fuel $2.50 + Congestion $6) |
| Job line — Courier Pay | **$41.26** |
| Job line — Courier Fuel | **$14.51** |
| **Unexplained gap** | **$37.27** |

The $37.27 gap is the **base courier rate** — the largest component of courier pay — which is calculated by the trigger and written directly to `CourierPayment` without ever appearing in the PricingBreakdown table.

---

## 2. Current Architecture

### How Client Charges Work (Revenue Side) ✅
The revenue side is already granular. `PricingBreakdown` stores every component of the client charge:

```
Base = $67.37
After Hours = $10.53
After Hours Fuel = $2.63
Congestion = $9.00
```

`ucjbAmount` (total client charge) = SUM of all `ChargeAmount` values. **This reconciles.**

### How Courier Pay Works (Cost Side) ❌
The cost side is fragmented across multiple mechanisms:

| Component | Where It's Calculated | Where It's Stored | In PricingBreakdown? |
|---|---|---|---|
| **Base courier rate** | Trigger on `tucJob` (rate codes, speed, courier %) | `CourierPayment` on `tucJob` | ❌ No — shows as `Base=67.37~0.00` |
| **Courier fuel (FAF)** | Trigger / rating code | `CourierFuel` on `tucJob` | ❌ No |
| **After hours (driver pay)** | `UTL_fncJob_ExtraRate` via `ExtraCharges.AfterHoursDP` | `PricingBreakdown.CostAmount` | ✅ Yes |
| **Weight excess (driver pay)** | `UTL_fncJob_ExtraRate` via `ExtraCharges.WeightExcessDP` | `PricingBreakdown.CostAmount` | ✅ Yes |
| **Congestion (driver pay)** | `UTL_fncJob_ExtraRate` via `CongestionCharges.DriverRate` | `PricingBreakdown.CostAmount` | ✅ Yes |
| **Wait time (driver pay)** | `UTL_fncJob_ExtraRate` via `ExtraCharges.WaitTimeExcessDP` | `PricingBreakdown.CostAmount` | ✅ Yes |
| **Extra stop (driver pay)** | `UTL_fncJob_ExtraRate` via `ExtraCharges.ExtraStopDP` | `PricingBreakdown.CostAmount` | ✅ Yes |
| **Holiday (driver pay)** | `UTL_fncJob_ExtraRate` via `ExtraCharges.HolidayChargeDP` | `PricingBreakdown.CostAmount` | ✅ Yes |
| **Courier bonus** | Manual / rule-based | `CourierBonus` on `tucJob` | ❌ No |

**The accessorial driver pay amounts are stored correctly via `UTL_fncJob_ExtraRate`.** The function builds a string in the format `ChargeName=ChargeAmount~CostAmount` which `DD_InsertPricingBreakdown` parses and stores. This works.

**The base courier rate and FAF are NOT in PricingBreakdown.** They go directly to `CourierPayment` and `CourierFuel` on the job record with no itemisation.

### Why It "Works" Today at Urgent

For a simple Urgent A→B courier job:
- Base courier pay = courier percentage × base charge (or flat rate from rate code)
- FAF = passed through at 100% to the courier
- Only two cost components, both derivable from the job record
- GP = `ucjbAmount - CourierPayment - CourierFuel - CourierBonus` — close enough

**But this breaks when:**
- A tenant doesn't pass FAF through at 100% (different driver fuel percentages per `VehicleSize.FuelPercentage`)
- Base driver pay uses zone rates or distance rates with separate driver rates (`ZoneCombo.DriverRate`, `DistanceRates.BaseChargeDP`)
- Multiple base components exist (base + distance + base fuel + distance fuel — all calculated in `UTL_fncJob_ExceleratorRate`)
- Someone edits a price item and expects the courier pay to update
- Finance needs to audit why a courier was paid a specific amount
- A new tenant has completely different cost allocation rules

---

## 3. The Multi-Tenant Problem (DFRNT)

The `ExtraCharges` table already has full dual-column architecture: every charge type has both a client amount and a driver pay amount. The `UTL_fncJob_ExtraRate` function already calculates both sides and builds the breakdown string with `~` separators.

**The pattern is right. It's just not applied to base rates and fuel.**

For DFRNT tenants using the Excelerator rating engine (`UTL_fncJob_ExceleratorRate`), the base rate calculation already computes:
- `BaseChargeAmount` (client) and `DriverBaseChargePay` (courier)
- `ChargedDistanceAmount` (client) and `DriverChargedDistancePay` (courier)
- Base fuel and distance fuel for both sides

And it already builds a notes string with the `Amount~DriverPay` format:
```
Base=150.00~95.00
Base Fuel=22.50~14.25
Distance (10 mi incl., 5 mi charged)=25.00~15.00
Distance Fuel=3.75~2.25
Weight (25 lbs incl., 3x25lbs charged)=28.35~14.19
...
```

**This string is passed to `DD_InsertPricingBreakdown` which stores it.** The architecture is already there — it just needs the NZ P2P / local courier rating path to do the same thing.

---

## 4. Proposed Solution

### Principle
**`PricingBreakdown` becomes the single source of truth for both charge and cost on every job.** Every component — base, fuel, accessorials — gets a row with both `ChargeAmount` and `CostAmount`. The job-level fields become derived totals.

### 4.1 Add Base Rate & Fuel to PricingBreakdown

When a job is rated (whether by trigger, SP, or C# code), include base courier pay and fuel in the pricing breakdown string:

**Current (NZ P2P simple job):**
```
Base=67.37~0.00
After Hours=10.53~10.00
After Hours Fuel=2.63~2.50
Congestion=9.00~6.00
```

**Proposed:**
```
Base=67.37~41.26
Fuel=14.51~14.51
After Hours=10.53~10.00
After Hours Fuel=2.63~2.50
Congestion=9.00~6.00
```

The `~0.00` on Base becomes the actual driver base rate. Fuel gets its own line with cost = driver fuel amount.

### 4.2 Make Job-Level Fields Derived

Once PricingBreakdown is complete:

```
ucjbAmount = SUM(ChargeAmount)                    -- already true
CourierPayment = SUM(CostAmount) WHERE non-fuel   -- new: derived from breakdown
CourierFuel = SUM(CostAmount) WHERE fuel items     -- new: derived from breakdown
```

Or simpler: add a `CostType` column to PricingBreakdown (`Base`, `Fuel`, `Bonus`, `Accessorial`) so the system can split the total into the right job-level fields.

### 4.3 Editing Updates the Total

When a user edits a `CostAmount` in the Price Breakdown modal:
1. Update the PricingBreakdown row
2. Recalculate `CourierPayment = SUM(CostAmount)` from all PricingBreakdown rows for that job
3. Write back to `tucJob.CourierPayment`
4. GP recalculates automatically

This gives users the behaviour they expect: **edit a cost line item → courier pay updates → GP updates**.

### 4.4 Schema Changes

**PricingBreakdown table — add columns:**

| Column | Type | Purpose |
|---|---|---|
| `CostType` | `nvarchar(20)` | Categorise: `Base`, `Fuel`, `Accessorial`, `Bonus` |
| `IsDriverPay` | `bit` | Flag to include in courier payment total |

**Or** keep it simple and use the charge name convention (anything with "Fuel" in the name → fuel component). The existing `ChargeName` values are already descriptive enough.

---

## 5. Implementation Path

### Phase 1: Populate (Non-Breaking)
- Modify the rating code path for NZ P2P / local jobs to include base courier pay and fuel in the PricingBreakdown string
- No changes to how `CourierPayment` / `CourierFuel` are written — they continue as-is
- PricingBreakdown gains complete data without changing any downstream behaviour
- **Validation:** For every new job, verify `SUM(CostAmount)` ≈ `CourierPayment + CourierFuel`

### Phase 2: Reconcile (Read Path)
- Update the Price Breakdown modal to show all items including base and fuel
- Add a reconciliation check: flag jobs where `SUM(CostAmount) ≠ CourierPayment + CourierFuel`
- Build a report/view showing discrepancies across historical jobs

### Phase 3: Edit Path
- Allow editing `CostAmount` on any PricingBreakdown row
- On save: recalculate `CourierPayment` and `CourierFuel` from PricingBreakdown totals
- Log the edit in `JobDeliveryJourney` for audit trail

### Phase 4: Make Authoritative
- `CourierPayment` and `CourierFuel` on `tucJob` become calculated fields derived from PricingBreakdown
- Remove or deprecate the direct-write path in the trigger
- All cost changes go through PricingBreakdown → recalculate → write to job

---

## 6. Parent/Child Job Breakdown — The Nationwide Problem

### The Challenge

A nationwide/Excelerator job typically has **three or more legs**:

```
Parent Job (KT1234NW) ← Client sees this on invoice
  ├── Child A: Pickup leg        (local courier, own base rate + accessorials)
  ├── Child B: Linehaul leg      (linehaul courier, own base rate + accessorials)
  └── Child C: Delivery leg      (local courier, own base rate + accessorials)
```

Each child leg has its own:
- Base courier rate (from distance/zone rates)
- FAF / fuel surcharge
- Weight excess charges
- After hours / holiday charges
- Congestion charges
- Wait time charges

**The client only sees the parent job on their invoice.** They don't know about the legs. They expect a single coherent price breakdown — not three sets of duplicated charge names.

### What the Client Should NOT See

```
❌ Base (Pickup) = $45.00
❌ Base (Linehaul) = $150.00  
❌ Base (Delivery) = $55.00
❌ FAF (Pickup) = $6.75
❌ FAF (Linehaul) = $22.50
❌ FAF (Delivery) = $8.25
❌ Weight Excess (Pickup) = $9.45
❌ Weight Excess (Delivery) = $9.45
```

Three FAF lines, three weight charges — confusing and looks like errors or double-billing.

### What the Client SHOULD See

```
✅ Base = $250.00                   (the rated price for this service)
✅ Fuel Surcharge = $37.50          (single consolidated FAF)
✅ Weight Excess = $18.90           (one charge, covers all legs)
✅ After Hours = $15.00             (if applicable)
```

Clean, consolidated — matches their rate card expectations.

### Proposed Data Model

Add two columns to `PricingBreakdown`:

| Column | Type | Purpose |
|---|---|---|
| `Purpose` | `nvarchar(10)` | `Invoice`, `CourierPay`, or `Both` |
| `ChildJobID` | `int NULL` | Which child job this cost belongs to (NULL = parent-level / simple job) |

**How it works:**

**For simple A→B jobs (no children):**
- `Purpose = 'Both'` — the same row is used for both client invoicing and courier pay
- `ChildJobID = NULL`
- Works exactly as today, no change

**For parent/child nationwide jobs:**

The parent job gets **two types** of PricingBreakdown rows:

1. **Invoice rows** (`Purpose = 'Invoice'`, `ChildJobID = NULL`):
   - Consolidated view for the client
   - `ChargeAmount` = sum of all children's charges for that type
   - `CostAmount` = sum of all children's costs for that type
   - These appear on the invoice and in the client-facing breakdown

2. **Courier pay rows** (`Purpose = 'CourierPay'`, `ChildJobID = <child>`):
   - One set per child leg
   - `CostAmount` = what that specific courier gets paid for that component
   - `ChargeAmount` = that leg's portion of the client charge (for internal GP tracking)
   - These drive courier settlements and the internal cost audit view

**Example — Nationwide job KT1234NW:**

| PricingBreakdownID | JobID (Parent) | ChildJobID | Purpose | ChargeName | ChargeAmount | CostAmount |
|---|---|---|---|---|---|---|
| 1 | 5001 | NULL | Invoice | Base | $250.00 | $145.00 |
| 2 | 5001 | NULL | Invoice | Fuel Surcharge | $37.50 | $26.25 |
| 3 | 5001 | NULL | Invoice | Weight Excess | $18.90 | $9.46 |
| 4 | 5001 | 5002 | CourierPay | Base (Pickup) | $45.00 | $28.00 |
| 5 | 5001 | 5002 | CourierPay | FAF (Pickup) | $6.75 | $4.20 |
| 6 | 5001 | 5002 | CourierPay | Weight (Pickup) | $9.45 | $4.73 |
| 7 | 5001 | 5003 | CourierPay | Base (Linehaul) | $150.00 | $95.00 |
| 8 | 5001 | 5003 | CourierPay | FAF (Linehaul) | $22.50 | $15.75 |
| 9 | 5001 | 5004 | CourierPay | Base (Delivery) | $55.00 | $22.00 |
| 10 | 5001 | 5004 | CourierPay | FAF (Delivery) | $8.25 | $6.30 |
| 11 | 5001 | 5004 | CourierPay | Weight (Delivery) | $9.45 | $4.73 |

**Rules:**
- Invoice view: filter `WHERE Purpose IN ('Invoice', 'Both')` — client sees consolidated lines
- Courier settlement: filter `WHERE Purpose IN ('CourierPay', 'Both') AND ChildJobID = @CourierChildJobID` — courier sees their leg only
- Internal audit: show all rows — full visibility of both views
- `SUM(CostAmount) WHERE Purpose = 'Invoice'` should equal `SUM(CostAmount) WHERE Purpose = 'CourierPay'` — cross-check

### How Invoice Rows Get Created

When a parent job's children are all rated:
1. Group all children's PricingBreakdown rows by charge type (Base, FAF, Weight, etc.)
2. Sum `ChargeAmount` and `CostAmount` per type
3. Insert consolidated rows on the parent with `Purpose = 'Invoice'`
4. This could be done in the archive process, or triggered when the last child is completed

### Edge Cases

- **Parent-specific charges** (e.g. a booking fee that only applies to the parent): `Purpose = 'Invoice'`, `ChildJobID = NULL`, not derived from children
- **One leg has after hours, others don't**: Only that leg's courier pay row shows after hours. The Invoice row still shows a single "After Hours" line with just that amount
- **Repricing a child**: Recalculate that child's CourierPay rows, then regenerate the parent's Invoice rows by re-summing

---

## 7. Where the Code Lives

| Component | Location | Notes |
|---|---|---|
| `ExtraCharges` table | DB — stores all accessorial rate cards with both client charge and driver pay columns | Already has full dual-column architecture |
| `UTL_fncJob_ExtraRate` | DB function | Calculates all accessorial charges + driver pay, builds `Name=Charge~Cost` string. **Already correct.** |
| `UTL_fncJob_ExceleratorRate` | DB function | Calculates base + distance + extra charges for Excelerator tenants. **Already includes driver pay in breakdown string.** |
| `DD_InsertPricingBreakdown` | DB stored procedure | Parses `Name=Charge~Cost` string, writes to PricingBreakdown. **Already handles `CostAmount`.** |
| `UTL_stpJobBooking_InsertJob` | DB stored procedure | Copies PricingBreakdown from booking to live job. **Already copies `CostAmount`.** |
| `sp_JobArchive` | DB stored procedure | Archives PricingBreakdown to PricingBreakdownArchive. **Already copies `CostAmount`.** |
| Base courier pay trigger | `tucJob_InsertUpdate_CalculateCourierPayment` on live DB | **Definition unknown** — only exists on live, not on staging. This is where base courier pay is calculated and written directly to `CourierPayment`. |
| `CostAmount` column | Added via migration `20250520172320_PricingBreakdownCost.sql` | Added to both `PricingBreakdown` and `PricingBreakdownArchive` |

---

## 8. Open Questions

1. **Trigger definition:** We still need the source of `tucJob_InsertUpdate_CalculateCourierPayment` from the live DB. This is where base courier pay is calculated. Without it, we can't wire the base rate into the breakdown string.

2. **FAF pass-through:** At Urgent, FAF is passed through at 100% to couriers. Is this always the case, or do some clients/tenants have different driver fuel percentages? (`VehicleSize.FuelPercentage` exists in the Excelerator path — is it used in NZ?)

3. **Courier bonus:** Should `CourierBonus` also be represented as a PricingBreakdown row? It's currently a standalone field on `tucJob`.

4. **Historical backfill:** Do we need to backfill `CostAmount` for historical PricingBreakdown rows, or only fix it going forward?

5. **Rerate interaction:** When a job is rerated (speed change), the charge changes. Does the courier pay also change? If so, PricingBreakdown needs to be regenerated with new cost values.

6. **Parent Invoice row generation:** When should consolidated Invoice rows be created on the parent — at booking time, when the last child is completed, during the archive process, or on-demand when the invoice is generated?

7. **Existing nationwide jobs:** The Excelerator path already builds breakdown strings with `Amount~DriverPay` per leg. Are these currently stored on the child jobs' PricingBreakdown, on the parent, or both? This determines how much of the parent/child consolidation already works.

8. **Split jobs:** Split jobs also create parent/child relationships. Do they need the same Invoice vs CourierPay separation, or is the split logic different enough to handle separately?

---

## 9. Summary

The infrastructure for granular cost tracking **already exists** — `ExtraCharges` has driver pay columns, `UTL_fncJob_ExtraRate` calculates both sides, `DD_InsertPricingBreakdown` stores both sides, the Excelerator path includes base driver pay in the breakdown string. 

The gap is specifically in the **NZ P2P / local courier rating path** where base courier pay bypasses PricingBreakdown entirely and goes straight to `CourierPayment` via a trigger.

Fixing this is not just a nice-to-have — it's foundational for:
- Accurate GP reporting at the line-item level
- User-editable courier costs that actually work
- Multi-tenant DFRNT deployments where cost structures differ
- Financial auditability of courier payments
