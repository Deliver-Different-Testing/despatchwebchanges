# Network Partner Pay Visibility — NW Amount on Delivery Leg Allocation

**Date:** 17 September 2026
**For:** Karen, Jacob
**From:** Steve Bonnici (AI-assisted analysis)
**Status:** Investigation — not scoped for build, not assigned.

> **Read `pricing-breakdown-gap-analysis.md` first.** This document is a narrow extension of its §6 (*Parent/Child Job Breakdown — The Nationwide Problem*). The three-leg nationwide model, the `Purpose` / `ChildJobID` proposal and the `CostAmount` story are **already covered there and are not restated here.** This doc covers only what that analysis does not: the **network partner / agent** as payee, where the **partner's rate** comes from, and the **schedule-created job** path.

---

## 1. Problem

When a job is created from a **schedule** and the **delivery leg falls in a network partner's area**, the figure surfaced to that partner is the **job's revenue amount**, not what they are going to be paid.

**Test case:**

- Schedule `AKL > Palmerston North pre 10am` — real, active, multi-client (`routed-operations/scripts/schedule-rationalisation/output/schedule_clients.csv`)
- Auckland pickup → linehaul → Palmerston North delivery
- Delivery leg allocated to **Golden Black Taxis** (network partner, PN)
- They currently see job revenue; they should see only their agreed pay for that leg

---

## 2. Why `NWAmount` Is Not the Answer

The ask was framed as "populate `NWAmount` with the partner's pay." It should not be.

`NWAmount` is a **revenue** field. Verified in `Accounts/Core/Domain/Despatch/TucJob.cs` + `DespatchContext.cs`:

| Column | EF property | Meaning |
|---|---|---|
| `PickupAmount` / `PickupRawAmount` | `PickupAmount` / `PickupRawAmount` | Pickup leg share of the **client charge** |
| `DropoffAmount` / `DropoffRawAmount` | `DropoffAmount` / `DropoffRawAmount` | Dropoff leg share of the **client charge** |
| `NWAmount` / `NWRawAmount` | `Nwamount` / `NwrawAmount` | Nationwide/linehaul leg share of the **client charge** |

All three are revenue splits, each with a pre-discount "Raw" twin. There is **no cost-side equivalent at leg level** on `tucJob` — cost is job-level only (`CourierPayment`, `CourierBonus`, `CourierFuel`).

`NWAmount` is written by a revenue trigger, `tucJob_Update_AddPickupAmountToNationwideAmount` (registered in `DespatchContext.cs`; archive twin `tucJobArchive_Update_AddPickupAmountToNationwideAmount`). Nothing in that path has ever held a pay figure.

**Overloading it would corrupt gross profit on every nationwide job**, and the corruption lands in `tucJobArchive` (`GrossProfitValue`) where it is expensive to unwind.

**The partner-pay carrier already proposed is the right one:** `PricingBreakdown` rows with `Purpose = 'CourierPay'` and `ChildJobID = <delivery leg>` — see `pricing-breakdown-gap-analysis.md` §6. The settlement filter specified there (`WHERE Purpose IN ('CourierPay','Both') AND ChildJobID = @x`) is exactly the "partner sees only their leg" rule this issue needs. **This issue is a consumer of that design, not a separate one.**

So: leave `NWAmount` alone. The bug is that partner-facing surfaces read a revenue field, and that no partner rate is resolved at allocation.

---

## 3. What §6 Does Not Cover

### 3.1 The payee is an agent, not a courier

§6 speaks only of "couriers". The partner case adds linkage §6 does not model:

| Column | Points at | Notes |
|---|---|---|
| `AgentID` | `tucAgents.ucagID` | The agent/NP on the job |
| `MasterCourierId` | `tucCourier.uccrID` | NP-as-master with sub-couriers underneath |
| `SubContractorPercentage` / `SubContractorBonusPercentage` / `SubContractorFuelPercentage` | — | Sub-contractor pay split |

NPs are modelled on `tucCourier` + `tucCourierFleet` + `CourierType` (`dfrnt-platform-docs/DB-SCHEMA.md` §17), **but `tucAgents` is a separate table that `tucJob.AgentID` points at and which is absent from the schema reference entirely.** Whether Golden Black Taxis is an agent row, a courier/fleet row, or both is unknown — see Q4/Q7.

The rate-masking rule already agreed for the NP programme:

> NP sees "Revenue" not "Amount"; master sees "Amount" + "Agent Rate".
> `NpCourierPayment` = separate field, default 70% of AgentRate, configurable per agent.

### 3.2 Where the partner's rate comes from — **the real gap**

§6 assumes a cost figure exists to write into `CostAmount`. For a network partner, **it does not** — nothing resolves an agent's agreed rate at allocation time.

The model for it exists in the NP redesign C# layer (`Steve-v2.0-NP-Redesign/api/src/DfrntAgentsPartners.Core/Models/`):

**`AgentVehicleRate`** — per-agent, per-vehicle-size rate card. Its own doc comment: *"used when assigning jobs to this agent's fleet."*

| Field | Purpose |
|---|---|
| `VehicleSize`, `AirportCode` | Rate scope |
| `BaseCharge`, `DistanceIncluded`, `PerDistanceUnit`, `ExtraCharge` | Distance-based |
| `UseZoneRate`, `ZoneRateCardJson` | Zone-based alternative — flexible zone→price map |
| `Flagfall`, `KmRate`, `ItemRate`, `MaxKms` | NZ-specific |

**`AgentCourierRate`** — per-courier override: `PaymentPercent`, `BonusPercent`, **`FlatRate`**, `VehicleSize`.

Between `ZoneRateCardJson` (AKL zone → PN zone) and `FlatRate`, the Golden Black Taxis case is **already expressible**. The design is not the problem.

> ⚠️ **The C# models and the SQL migrations disagree, and there is a third possibility neither accounts for.**
>
> | | NP-redesign C# model | NP-redesign SQL migration |
> |---|---|---|
> | `AgentVehicleRate` | Full rate card (above) | **No migration** — `database/001`–`005` never creates it |
> | `AgentCourierRate` | `PaymentPercent`, `BonusPercent`, `FlatRate`, `VehicleSize` (string) | `005-agent-courier-rates.sql`: `PayPercentage`, `BonusPercentage`, `VehicleSizeId` (**int**), `EffectiveFrom`/`EffectiveTo`, `IsActive` — **no `FlatRate`** |
>
> Neither side is a superset: the migration has effective-dating the C# lacks; the C# has `FlatRate` the migration lacks.
>
> **However** — `extra-charges-deep-dive.md` §3 lists **`AgentVehicleService.cs` in Admin Manager** ("Agent vehicle rates with extra charge links"). That implies agent vehicle rates are an **existing production concept**, and the NP-redesign class may be a re-modelling of a table that already exists. **Confirm against the live DB before writing any migration** (Q3) — the worst outcome here is a third competing shape.

### 3.3 Schedule-created jobs cannot resolve pay at rating time

Schedule jobs carry `ScheduleName`, and link back via `BookingParentId` / `BulkParentId`. They are rated **in bulk at creation** — before anyone knows which partner will take the delivery leg.

So at rating time there is no partner, no rate, and no cost figure. The record is revenue-only by construction.

**Implication:** partner pay must be resolved (or re-resolved) at **allocation** time, not creation time. Any design that resolves it during rating will be wrong for the schedule path — which is the path in Steve's example.

This also interacts with §6's open question 6 ("when should consolidated Invoice rows be created on the parent") — for schedule jobs the answer cannot be "at booking."

---

## 4. Correction to an Earlier Draft

An earlier version of this investigation proposed reusing the Split Job machinery (`SplitJobService.cs`, `ParentId`/`RootParentId`) to make the delivery leg its own job. **That was redundant.** Per §6, nationwide/Excelerator jobs **already** decompose into pickup / linehaul / delivery child legs. The delivery leg the partner is allocated to is most likely already a child job.

What still needs confirming is §6's own open question 8 — whether split jobs and nationwide jobs share the parent/child handling — plus Q8 below: whether the schedule path actually produces child legs, or one flat job with the partner allocated to the whole thing.

---

## 5. Open Questions

Not resolvable from the material available locally. `despatchweb`, `inboundagent`, `booking` and `courierportal` are **not cloned on this machine** — the `gitlab-source` directories are empty shells — so the code paths below are inferred from schema, triggers and design docs, **not read from source**. GitLab remains source of truth.

| # | Question | Where |
|---|---|---|
| Q1 | Which field does the **Agent Portal (InboundAgent)** render as the money figure? | `inboundagent` job view model / view |
| Q2 | Which field does the **NP dispatch board** render — same or different? | `despatchweb` NP board, `courierportal` |
| Q3 | Does `AgentVehicleRate` **already exist in the live DB** (per `AgentVehicleService.cs`)? Does deployed `AgentCourierRate` match the C# model, migration 005, or neither? | Live DB `INFORMATION_SCHEMA` |
| Q4 | Full column list for **`tucAgents`** — referenced by `tucJob.AgentID`, absent from `DB-SCHEMA.md` | Live DB |
| Q5 | Body of `tucJob_Update_AddPickupAmountToNationwideAmount` — firing conditions, what it writes | Live DB `sp_helptext` |
| Q6 | On a live PN schedule job: actual values of `NWAmount`, `DropoffAmount`, `CourierPayment`, `AgentID`, `ParentId` | Live DB, SELECT only |
| Q7 | Is Golden Black Taxis an **agent** (`tucAgents`), a **courier/fleet** (`tucCourier`), or both? | Live DB |
| Q8 | Does the schedule path produce child legs, or one flat job with the partner on the whole job? | `despatchweb` `NationwideJobRepository.cs` + live data |

### Verification queries — SELECT only, read-only

```sql
-- Q6: what a PN schedule job actually looks like
SELECT TOP 50
    j.ucjbID, j.ucjbJobNumber, j.ScheduleName,
    j.ucjbAmount, j.RawBaseAmount, j.FuelSurchargeAmount,
    j.PickupAmount, j.DropoffAmount, j.NWAmount,
    j.PickupRawAmount, j.DropoffRawAmount, j.NWRawAmount,
    j.CourierPayment, j.CourierPercentage, j.CourierBonus, j.CourierFuel,
    j.ucjbCourierID, j.MasterCourierId, j.AgentID,
    j.ParentId, j.RootParentId, j.BookingParentId, j.BulkParentId
FROM tucJob j
WHERE j.ScheduleName LIKE '%Palmerston%'
ORDER BY j.ucjbID DESC;

-- Q6b / Q8: cost-side lines and child legs for those jobs
SELECT pb.JobID, pb.ChargeName, pb.ChargeAmount, pb.CostAmount
FROM PricingBreakdown pb
WHERE pb.JobID IN ( /* ids above */ )
ORDER BY pb.JobID, pb.ChargeName;

SELECT ucjbID, ucjbJobNumber, ParentId, RootParentId, ucjbCourierID, AgentID,
       ucjbAmount, PickupAmount, DropoffAmount, NWAmount, CourierPayment
FROM tucJob WHERE ParentId IN ( /* ids above */ ) OR RootParentId IN ( /* ids above */ );

-- Q3: which agent rate tables exist, and with what shape
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%Agent%' OR TABLE_NAME LIKE '%Partner%';

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('AgentCourierRate','AgentVehicleRate')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- Q4 / Q7: tucAgents shape, and where Golden Black sits
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tucAgents' ORDER BY ORDINAL_POSITION;

SELECT * FROM tucAgents WHERE /* name col */ LIKE '%Golden%';
SELECT uccrID, Code, uccrName, uccrSurname, CourierFleetID, CourierTypeId,
       uccrPercentage, MasterCourierId, Active
FROM tucCourier WHERE uccrName LIKE '%Golden%' OR uccrSurname LIKE '%Golden%';

-- Q5: trigger bodies
EXEC sp_helptext 'tucJob_Update_AddPickupAmountToNationwideAmount';
EXEC sp_helptext 'tucJob_InsertUpdate_CalculateCourierPayment';
```

---

## 6. Likely Affected Code

Inferred — confirm against GitLab before estimating.

| Component | Location | Change |
|---|---|---|
| Allocation flow | `despatchweb/Services/DispatchJobService.cs` | Resolve partner rate when allocating a leg to an NP/agent |
| Nationwide leg rating | `despatchweb/NationwideJobRepository.cs` | Where leg rating already happens — likely insertion point |
| Partner-facing view | `inboundagent` job view model | Render partner pay; never `ucjbAmount` or a leg revenue field |
| NP dispatch board | `despatchweb` NP board / `courierportal` | Same masking rule |
| Pay resolution | new service (per `CourierPayCalculationIssues.md`, not a trigger) | Percentage vs flat vs zone rate cascade |
| Agent rate storage | Admin Manager `AgentVehicleService.cs`; NP-redesign `AgentVehicleRate.cs` / `AgentCourierRate.cs` / `database/005` | Reconcile the competing shapes **before** writing a migration |
| Cost data | `DD_stpJob_Rate_Described` | Missing `~CostAmount` on Base / Base Fuel — see `pricing-breakdown-gap-analysis.md` §2 |

---

## 7. Recommendation

1. **Answer Q1 and Q6 first.** One view file and one SELECT. They decide whether this is a display bug or a missing-data bug; everything else is contingent.
2. **Do not repurpose `NWAmount`.** It is a revenue leg field feeding GP and the archive.
3. **Treat this as a consumer of `pricing-breakdown-gap-analysis.md` §6**, not a parallel design. `Purpose = 'CourierPay'` + `ChildJobID` already gives the partner-sees-own-leg rule.
4. **Resolve partner pay at allocation time, in a service.** The schedule path makes creation-time resolution impossible.
5. **Reconcile the agent rate store before building on it** — Admin Manager vs NP-redesign C# vs migration 005 are three candidate shapes for the same concept. Settle which is real (Q3) first.
6. **The `CostAmount` base-row defect is a prerequisite**, not a parallel workstream.

---

## 8. Sources

Verified locally:

- `Accounts/Core/Domain/Despatch/TucJob.cs`, `TucJobArchive.cs`, `DespatchContext.cs` — EF model, trigger registrations
- `Accounts/CourierPayCalculationIssues.md` (31 Mar 2026)
- `despatchwebchanges/pricing-breakdown-gap-analysis.md` §6, `extra-charges-deep-dive.md` §3, `SplitJobUpdate.md`
- `dfrnt-platform-docs/DB-SCHEMA.md`
- `Steve-v2.0-NP-Redesign/api/src/DfrntAgentsPartners.Core/Models/` — `Agent.cs`, `NpCourier.cs`, `AgentVehicleRate.cs`, `AgentCourierRate.cs`; `database/001`–`005*.sql`
- `routed-operations/` schedule + linehaul docs and schedule rationalisation output

**Not** available locally — must be checked against GitLab / live DB:

- `despatchweb`, `inboundagent`, `booking`, `courierportal` source
- `tucAgents` definition; trigger bodies; deployed agent rate tables
