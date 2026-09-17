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

## 4. Partner Pricing Modes (shipped 27 May 2026) — What It Settles

Source: *Release Notes — Partner Pricing Modes, 2026-05-27*. The shipped code is on GitLab; the local `integration-manager` clone predates it and contains none of it, so this section is written from the release notes, not from source.

### 4.1 There are two partner mechanisms, not one — and this is now the pivotal question

| | **Cross-tenant partner dispatch** | **In-tenant agent / NP allocation** |
|---|---|---|
| Who the partner is | Another **DFRNT tenant** | An **agent / NP** on this tenant |
| Linkage | Partner pairing + Partner Service Mappings | `tucJob.AgentID` → `tucAgents`, `MasterCourierId` |
| Rate source | Pricing Mode on the service mapping (Agreed / Percentage / Cost Plus) | `AgentVehicleRate` / `AgentCourierRate` / percentage cascade |
| Partner-facing surface | Send-to-Partner dialog (A side), B's own dispatch board | Agent Portal (InboundAgent) encrypted link, NP board |
| Transport | Partner outbox, HMAC-signed events | Internal — same DB |

**§1–§3 of this document assume the second mechanism.** That assumption needs confirming before anything is built.

Golden Black Taxis is a Palmerston North taxi operator and almost certainly **not a DFRNT tenant**, which points to the agent/NP path. But it must be checked — if they are in fact a paired tenant, most of §3 is aimed at the wrong mechanism and the fix is a Pricing Mode configuration, not a build. **This now outranks Q1.**

### 4.2 It settles the `NWAmount` question independently

> "The pricing mode flows on the wire only; **we deliberately did not add a column to `tucJob`** (cross-suite impact wasn't worth a display flag)."

The team has already made this exact call on the cross-tenant side. §2's recommendation — don't put partner pay on `tucJob` — is not a new opinion, it matches a decision already taken and shipped.

### 4.3 Partner pay derived from client revenue is sanctioned, not a bug

**Mode 2 (Percentage)** pays the partner `UcjbAmount × pct` — deliberately linked to the client charge, no quote round-trip.

So "partner pay is derived from job revenue" is a supported DFRNT pricing model. Steve's symptom is that Golden Black Taxis sees **the revenue amount itself**, not a percentage of it. That is a **display / fallback failure, not a data-model flaw** — which materially strengthens the Reading-A framing in §2 and makes Q1 (which field the surface renders) the cheapest path to the answer.

### 4.4 There is a documented precedent for exactly this failure shape

> "The Send to Partner dialog in DespatchWeb has been opening with an empty rate input for some time (the old `IntMgrPartnerRateCard` endpoint was dropped and never reimplemented — **every call has silently 404'd**)."

A partner-facing rate surface lost its data source, failed silently, and fell back to something wrong — for months. **That is the first hypothesis to test on the agent/NP side** (Q1): not "the wrong field was chosen", but "the right field's source died and the surface fell back to `ucjbAmount`."

### 4.5 Two patterns worth reusing on the agent side

- **Mode 1 acceptance gate** — the receiver must accept or reject the operator-typed rate before Allocate / ReAllocate is permitted; Percentage and Cost Plus auto-accept because the formula was agreed upfront. A partner being able to work a job before the rate is agreed is the same exposure on the agent path.
- **Mode 3 rate-change broadcast** — a signed `RateChanged` event re-quotes every open Cost-Plus job on that service code and rewrites cost + margin in place, leaving picked-up/void jobs alone. Whatever resolves agent rates will need the same "what happens to jobs already in flight" answer.

### 4.6 The tension it leaves open

Because pricing mode flows **on the wire only**, nothing persists on the job recording what the partner was actually paid. On the cross-tenant side that is accepted — settlement reconciles separately.

On the agent/NP path that gap is exactly what "populate NW amount" was reaching for. Steve's instinct has a real basis: **there genuinely is no field.** The conclusion in §2 stands — the right home is `PricingBreakdown` with `Purpose = 'CourierPay'`, which persists and reconciles, rather than a display flag on `tucJob`.

### 4.7 A caveat that lands directly on the schedule path

> "For Mode 2 (Percentage) to work, the job must have a `UcjbAmount` populated at dispatch time; if it's missing, the Send-to-Partner dialog falls back to manual entry."

Schedule-created jobs are bulk-rated at creation, so `UcjbAmount` should be present — but this needs confirming for the schedule path specifically (Q9). A silent fallback to manual entry is precisely how a wrong number reaches a partner.

---

## 5. Correction to an Earlier Draft

An earlier version of this investigation proposed reusing the Split Job machinery (`SplitJobService.cs`, `ParentId`/`RootParentId`) to make the delivery leg its own job. **That was redundant.** Per §6, nationwide/Excelerator jobs **already** decompose into pickup / linehaul / delivery child legs. The delivery leg the partner is allocated to is most likely already a child job.

What still needs confirming is §6's own open question 8 — whether split jobs and nationwide jobs share the parent/child handling — plus Q8 below: whether the schedule path actually produces child legs, or one flat job with the partner allocated to the whole thing.

---

## 6. Open Questions

Not resolvable from the material available locally. `despatchweb`, `inboundagent`, `booking` and `courierportal` are **not cloned on this machine** — the `gitlab-source` directories are empty shells — so the code paths below are inferred from schema, triggers and design docs, **not read from source**. GitLab remains source of truth.

| # | Question | Where |
|---|---|---|
| **Q0** | **Which mechanism carries Golden Black Taxis — a paired DFRNT tenant, or an in-tenant agent/NP?** Answer this before anything else; it decides whether §3 applies at all (see §4.1). If they are a paired tenant, the fix is likely a Pricing Mode setting on the service mapping, not a build. | Partner pairings / Partner Service Mappings vs `tucAgents` / `tucCourier` |
| Q1 | Which field does the **Agent Portal (InboundAgent)** render as the money figure — and **does its data source still resolve?** Test the `IntMgrPartnerRateCard` failure shape (§4.4): a dead endpoint falling back to `ucjbAmount`. | `inboundagent` job view model / view; check for 404s in logs |
| Q2 | Which field does the **NP dispatch board** render — same or different? | `despatchweb` NP board, `courierportal` |
| Q3 | Does `AgentVehicleRate` **already exist in the live DB** (per `AgentVehicleService.cs`)? Does deployed `AgentCourierRate` match the C# model, migration 005, or neither? | Live DB `INFORMATION_SCHEMA` |
| Q4 | Full column list for **`tucAgents`** — referenced by `tucJob.AgentID`, absent from `DB-SCHEMA.md` | Live DB |
| Q5 | Body of `tucJob_Update_AddPickupAmountToNationwideAmount` — firing conditions, what it writes | Live DB `sp_helptext` |
| Q6 | On a live PN schedule job: actual values of `NWAmount`, `DropoffAmount`, `CourierPayment`, `AgentID`, `ParentId` | Live DB, SELECT only |
| Q7 | Is Golden Black Taxis an **agent** (`tucAgents`), a **courier/fleet** (`tucCourier`), or both? | Live DB |
| Q8 | Does the schedule path produce child legs, or one flat job with the partner on the whole job? | `despatchweb` `NationwideJobRepository.cs` + live data |
| Q9 | On schedule-created jobs, is `UcjbAmount` reliably populated at dispatch time? Mode 2 falls back to **manual entry** when it is missing (§4.7) — a silent fallback is how a wrong number reaches a partner. | Live DB + Send-to-Partner dialog behaviour |

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

## 7. Likely Affected Code

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

## 8. Recommendation

1. **Answer Q0 first — it may end the investigation.** If Golden Black Taxis is a paired DFRNT tenant, this is a Pricing Mode configuration on the service mapping, not a build. Only if they are an in-tenant agent/NP does §3 apply.
2. **Then Q1 and Q6.** One view file and one SELECT. They decide whether this is a display bug or a missing-data bug. Test Q1 as a *silent failure* first (§4.4) — the `IntMgrPartnerRateCard` 404 shows this exact fault has already happened once and went unnoticed for months.
3. **Do not repurpose `NWAmount`.** It is a revenue leg field feeding GP and the archive — and the Partner Pricing Modes work already made the same call deliberately on the cross-tenant side (§4.2).
4. **Treat this as a consumer of `pricing-breakdown-gap-analysis.md` §6**, not a parallel design. `Purpose = 'CourierPay'` + `ChildJobID` already gives the partner-sees-own-leg rule.
5. **Resolve partner pay at allocation time, in a service.** The schedule path makes creation-time resolution impossible.
6. **Reconcile the agent rate store before building on it** — Admin Manager vs NP-redesign C# vs migration 005 are three candidate shapes for the same concept. Settle which is real (Q3) first.
7. **The `CostAmount` base-row defect is a prerequisite**, not a parallel workstream.

---

## 9. Sources

Verified locally:

- `Accounts/Core/Domain/Despatch/TucJob.cs`, `TucJobArchive.cs`, `DespatchContext.cs` — EF model, trigger registrations
- `Accounts/CourierPayCalculationIssues.md` (31 Mar 2026)
- `integration-manager/INTER_TENANT_INTEGRATION.md` — design ancestor of the partner pairing model
- `despatchwebchanges/pricing-breakdown-gap-analysis.md` §6, `extra-charges-deep-dive.md` §3, `SplitJobUpdate.md`
- `dfrnt-platform-docs/DB-SCHEMA.md`
- `Steve-v2.0-NP-Redesign/api/src/DfrntAgentsPartners.Core/Models/` — `Agent.cs`, `NpCourier.cs`, `AgentVehicleRate.cs`, `AgentCourierRate.cs`; `database/001`–`005*.sql`
- `routed-operations/` schedule + linehaul docs and schedule rationalisation output

- *Release Notes — Partner Pricing Modes, 2026-05-27* (supplied by Steve; shipped code is GitLab-side and not in the local `integration-manager` clone)

**Not** available locally — must be checked against GitLab / live DB:

- `despatchweb`, `inboundagent`, `booking`, `courierportal` source
- `tucAgents` definition; trigger bodies; deployed agent rate tables
