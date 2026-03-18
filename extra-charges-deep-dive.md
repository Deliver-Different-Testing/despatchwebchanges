# ExtraCharges Deep Dive — Where They're Invoked & Created

**Date:** 18 March 2026
**Source:** GitLab codebase (`gitlab-source/`)

---

## Key Finding: TWO Separate Accessorial Systems Exist

The codebase has **two completely separate systems** for extra charges/accessorials:

### System 1: `ExtraCharges` (Legacy — Rate Card Linked)
- **Table:** `ExtraCharges`
- **Entity:** `AdminManager.Core.Domain.Despatch.ExtraCharge`
- **UI:** "Edit Extra Charge Rate" modal (screenshot Steve provided)
- **Linked to rates via FK:** `ZoneCombo.ExtraChargeID`, `DistanceRate.ExtraChargeID`, `AirFreightRate.ExtraChargeID`
- **Calculated by:** `UTL_fncJob_ExtraRate` (DB function)
- **Has dual columns:** Every charge type has both client charge AND driver pay (e.g., `WeightExcess` / `WeightExcessDP`)
- **Output:** Builds `ChargeName=Amount~DriverPay` string → parsed by `DD_InsertPricingBreakdown` → stored in `PricingBreakdown`

### System 2: `AccessorialCharges` (New — Booking API)
- **Tables:** `AccessorialCharges`, `JobAccessorialCharges`, `AccessorialChargeGroupMember`
- **Entity:** `Booking.Core.Domain.AccessorialCharge`
- **Added:** February 2026 (migration `20260210160404_AccessorialChargeTables.sql`)
- **Service:** `JobAccessorialChargeService` in booking app
- **Executed via:** `sp_AddJobAccessorial` stored procedure
- **Charge types:** `flat`, `per_unit`, `hourly`, `percentage`, `quote_based`
- **Has availability flags:** `AvailableAtBooking`, `AvailableAtDispatch`, `AvailableAtCourier`
- **Groups:** Can be grouped via `AccessorialChargeGroupMember` and assigned to jobs via `AccessorialChargeGroupId`
- **NO driver pay columns** — only client charge calculation
- **Comment in code:** `// Remove corresponding PricingBreakdown row matched by name — trigger does this`

---

## ExtraCharges — Complete Invocation Map

### 1. Rating Functions (DB)

#### `UTL_fncJob_ExtraRate` — Core Extra Charge Calculator
- **Location:** DB function (definition in migration `20250520172320`)
- **Called by:** `UTL_fncJob_ExceleratorRate`, `DD_stpGetNationwideRates`
- **C# caller:** `NationwideJobRepository.CalculateExtraRatesAsync()` via EF DbFunction
- **Input:** Weight, quantity, cubic, pallets, extra stops, vehicle size, DG, dry ice, wait time, `ExtraChargeID`, holiday/afterhours flags, congestion IDs, MFV
- **Calculates ALL charge types:** Weight, wait time, extra stop, after hours, holiday, pallets, DG, dry ice, items, cubic, congestion
- **For each type calculates:** Client amount + fuel, Driver pay + fuel
- **Output:** `Amount`, `Fuel`, `DriverPay`, `DriverFuel`, `Notes` (the `Name=Amount~DriverPay` breakdown string)

#### `UTL_fncJob_ExceleratorRate` — Distance/Zone Rate Calculator (US tenants)
- **Location:** DB function
- **Uses:** Zone rates (`ZoneCombo`) or distance rates (`DistanceRate`), each with `ExtraChargeID` FK
- **Calls:** `UTL_fncJob_ExtraRate` via `CROSS APPLY` for each rate's extra charges
- **Output:** Combined base + distance + extra charges, with full `Amount~DriverPay` breakdown

### 2. Where ExtraCharges Are Linked to Rates

| Rate Type | Table | FK | How ExtraCharges Apply |
|---|---|---|---|
| Zone rates | `ZoneCombo` | `ExtraChargeID` | Each zone combo can have one extra charge profile |
| Distance rates | `DistanceRate` | `ExtraChargeID` | Each distance rate can have one extra charge profile |
| Air freight rates | `AirFreightRate` | `ExtraChargeID` | Each flight rate can have one extra charge profile |

### 3. Admin Manager — ExtraCharge CRUD

| File | Purpose |
|---|---|
| `RateService.cs` | Creates/updates rates with ExtraChargeID |
| `RateCardService.cs` | Rate card management including extra charges |
| `RateSpreadsheetService.cs` | Import/export rate spreadsheets with extra charge data |
| `AgentVehicleService.cs` | Agent vehicle rates with extra charge links |
| `ExtraChargeDto.cs` | DTO for API responses |
| `rateSearchControl.js` (×2) | Frontend rate search with extra charge display |

### 4. DespatchWeb — Extra Charge Usage

| File | Purpose |
|---|---|
| `ExtraCharge.cs` (entity) | EF entity mapping |
| `DespatchContext.Functions.cs` | `UTL_fncJob_ExtraRate` DbFunction binding |
| `NationwideJobRepository.cs` | `CalculateExtraRatesAsync()` — calls DB function, `GetExtraItemMultiplierByExtraChargeIdAsync()` |
| `ExtraRateCalculationRequest.cs` | Request model for extra rate calculation |

### 5. Booking App — PricingBreakdown Flow

| File | Purpose |
|---|---|
| `JobService.cs:2372` | `UpdatePricingBreakdown()` — calls `DD_InsertPricingBreakdown` SP |
| `JobService.cs:1962` | When job has `PricingBreakdown` string, calls `UpdatePricingBreakdown()` |
| `PricingBreakdown.cs` | Entity with `ChildJobId` column already present |
| `DespatchContext.cs:239-248` | PricingBreakdown has **4 triggers**: `TR_PricingBreakdown_tucJob_Sync`, `trg_PricingBreakdown_Delete`, `trg_PricingBreakdown_Insert`, `trg_PricingBreakdown_Update` |

### 6. DespatchWeb — PricingBreakdown CRUD

| File | Purpose |
|---|---|
| `JobController.cs:174` | `GetPricingBreakdown()` — reads breakdown for display |
| `JobController.cs:192` | `AddPriceComponent()` — manual add with permission check |
| `JobController.cs:242` | `UpdatePriceComponent()` — edit with audit event |
| `JobController.cs:289` | `DeletePriceComponent()` — delete with audit event |
| `JobRepository.cs:2051` | `GetJobPriceBreakdownAsync()` — queries PricingBreakdown/Archive |
| `JobRepository.cs:2143` | `AddJobPriceBreakdownAsync()` — inserts with `CostAmount` and `ChildJobId` |
| `AddStopJobService.cs` | Creates PricingBreakdown rows for add-stop jobs |

---

## PricingBreakdown Triggers (Critical!)

The `PricingBreakdown` table has **4 triggers** on live:

1. `TR_PricingBreakdown_tucJob_Sync` — syncs PricingBreakdown totals back to `tucJob.ucjbAmount`
2. `trg_PricingBreakdown_Insert` — fires on insert
3. `trg_PricingBreakdown_Update` — fires on update  
4. `trg_PricingBreakdown_Delete` — fires on delete

And `tucJob` has a reciprocal trigger:
- `TR_tucJob_PricingBreakdown_Sync` — syncs `tucJob` changes back to PricingBreakdown

**This means there's already a sync mechanism between PricingBreakdown and tucJob.** We need the trigger definitions to understand exactly what they do — they may already be handling some of the reconciliation we discussed.

---

## `DD_InsertPricingBreakdown` — The Parser

**Location:** DB stored procedure (definition in migration `20250520172320`)

Parses the `ChargeName=ChargeAmount~CostAmount` delimited string:
- Splits on `|` (CR replaced with `|`)
- Splits each line on `=` for name/amounts
- Splits amounts on `~` for `ChargeAmount`/`CostAmount`
- Deletes existing breakdown for the job, then inserts new rows
- Called from `UTL_stpJobBooking_InsertJob` (booking → live), and from C# `JobService.UpdatePricingBreakdown()`

---

## `JobExtraCharge` Table — Per-Job Overrides?

Separate from `ExtraCharges` (rate card level), there's `JobExtraCharge`:
- `JobID`, `ExtraChargeType` (string), `ExtraChargeAmount`
- Appears to store per-job extra charge overrides or applied charges
- Only in AdminManager entity model — not referenced in booking or despatchweb services

---

## Where PricingBreakdown Is Created (All Paths)

1. **Excelerator/Nationwide booking** → `UTL_fncJob_ExceleratorRate` builds breakdown string → passed to `DD_InsertPricingBreakdown`
2. **NZ P2P local booking** → `DD_InsertPricingBreakdown` called from booking flow (currently `Base=Amount~0.00` — no driver pay on base)
3. **Prebook → Live** → `UTL_stpJobBooking_InsertJob` copies PricingBreakdown from booking to live job
4. **Manual add** → `JobController.AddPriceComponent()` → `JobRepository.AddJobPriceBreakdownAsync()`
5. **Add Stop** → `AddStopJobService` creates PricingBreakdown rows
6. **Archive** → `sp_JobArchive` copies to `PricingBreakdownArchive`

**Note:** Many SPs have `DD_InsertPricingBreakdown` calls **commented out** (e.g., `UTL_stpJob_Truck_Insert`, `UTL_stpJob_NationWide_Insert`, `WS_stpJob_Insert_FromParent`). This suggests PricingBreakdown population was retrofitted and not all paths are active.

---

## AccessorialCharges (New System) — February 2026

### Tables
- `AccessorialCharges` — charge definitions (name, type, rates, min/max, free allowance)
- `JobAccessorialCharges` — per-job applied charges
- `AccessorialChargeGroupMember` — grouping charges together
- `UnitType` — measurement units

### Key Differences from ExtraCharges

| Feature | ExtraCharges | AccessorialCharges |
|---|---|---|
| Created | Legacy | Feb 2026 |
| Driver pay | ✅ Full dual columns | ❌ No driver pay |
| Linked to | Rate cards (zone/distance/flight) | Job directly via groups |
| Calculated by | `UTL_fncJob_ExtraRate` (SQL) | `sp_AddJobAccessorial` (SQL) + C# recalc |
| Charge types | Weight, wait, stop, AH, holiday, pallet, DG, dry ice, items, cubic, congestion | flat, per_unit, hourly, percentage, quote_based |
| Availability | Always applies if rate card has it | `AvailableAtBooking`, `AvailableAtDispatch`, `AvailableAtCourier` |
| PricingBreakdown sync | Comment says "trigger does this" | Unknown |
| Editable per job | Via PricingBreakdown modal | Via `JobAccessorialChargeService.Update()` |

### How AccessorialCharges Are Applied
1. Job is booked with `AccessorialChargeGroupId`
2. `sp_AddJobAccessorial` is called per charge in the group
3. SP calculates amount and updates job total (`@NewJobTotal OUTPUT`)
4. Trigger presumably syncs to PricingBreakdown (based on comment: "trigger does this")

---

## Summary — The Two Systems Need Unification

The codebase has evolved two parallel systems:

1. **ExtraCharges** — tightly coupled to rate cards, has driver pay, builds PricingBreakdown strings, used by Excelerator/nationwide rating
2. **AccessorialCharges** — new, flexible, API-driven, but no driver pay, used by booking API

For the PricingBreakdown gap analysis to work, **both systems need to populate CostAmount** (driver pay). The ExtraCharges system already does this. The AccessorialCharges system needs driver pay columns added.

The 4+1 triggers on PricingBreakdown and tucJob are the critical unknown — they may already be doing some of the sync work we need. Getting their definitions from live DB should be the immediate next step.
