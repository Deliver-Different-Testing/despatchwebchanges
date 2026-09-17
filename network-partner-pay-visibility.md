# Network Partner Pay Visibility

**Date:** 17 September 2026
**For:** Kerran (implementation, Dispatch) · Jacob
**From:** Steve Bonnici (AI-assisted analysis)
**Status:** Investigation — not scoped for build, not assigned.

> **Start at §2 and §3.** §2 is how network partner pay actually works in production (confirmed by Steve, 17 Sep 2026) — note §2.3, which splits the work into two paths with different timing; §3 is the change being asked for. §4 onward is supporting analysis, and §6 records where earlier revisions of this doc were wrong.
>
> **The implementation deliverable for Kerran is the copy in the `Dispatch` repo** (`Deliver-Different-Testing/Dispatch`), which is where Dispatch specs live. This copy sits with the supporting analysis — keep them in step if either changes.
>
> Companion doc: `pricing-breakdown-gap-analysis.md` §6 covers the three-leg nationwide model and the `Purpose` / `ChildJobID` invoice-consolidation proposal. **This issue does not depend on it landing** — see §2.1.

---

## 1. Problem

When a job is created from a **schedule** and the **delivery leg falls in a network partner's area**, the figure surfaced to that partner is the **job's revenue amount**, not what they are going to be paid.

**Test case:**

- Schedule `AKL > Palmerston North pre 10am` — real, active, multi-client (`routed-operations/scripts/schedule-rationalisation/output/schedule_clients.csv`)
- Auckland pickup → linehaul → Palmerston North delivery
- Delivery leg allocated to **Golden Black Taxis** (network partner, PN)
- They currently see job revenue; they should see only their agreed pay for that leg

---

## 2. How Network Partner Pay Actually Works

*Confirmed by Steve, 17 Sep 2026. This supersedes the "no cost-side field exists" framing in earlier revisions.*

### 2.1 The partner's pay goes in `CourierPayment`

Network partner payment is written to **`tucJob.CourierPayment`** (and `tucJobArchive.CourierPayment`).

**Why that is the right call, not a workaround:** the tenant's gross profit is already revenue − `CourierPayment`. Because what they pay the network partner *is* their cost for that job, GP falls out of the existing calculation — **no second GP calculation is needed.** Any scheme that parks partner pay in a new field would force one.

### 2.2 The NP's own courier is a separate, second layer

When the network partner pays *their* courier, that amount is stored in **`NPCourierPayment`** — a distinct field from `CourierPayment`.

Two layers, two fields, two payers:

| Layer | Payer → payee | Field |
|---|---|---|
| Tenant → network partner | the tenant pays the NP | **`CourierPayment`** (§2.1) |
| Tenant → network partner (fuel) | the partner's fuel share | **`CourierFuel`** (§3.2) |
| NP → their own courier | the NP pays their driver | **`NPCourierPayment`** |
| NP → their own courier (fuel) | the NP's driver's fuel share | *`NPCourierFuelAmount`* — **deferred, not in MVP** |

> **`NPCourierFuelAmount` — noted and deliberately out of MVP scope.** *(Steve, 17 Sep 2026.)*
>
> The pay layers are symmetrical but the fuel layers are not: `CourierFuel` records the fuel passed tenant → partner, and there is no equivalent for partner → their driver. A field would be needed to record the NP passing on only part of their fuel to their own courier. (Name it when it is built — the pay layer runs `CourierPayment` → `NPCourierPayment`, so the fuel layer would naturally run `CourierFuel` → `NPCourierFuel`.)
>
> **Not required for MVP.** It bites for the same reason as §3.2 — only where fuel is *not* passed on in full. At Urgent the whole fuel goes through, so the NP→driver fuel split has nothing to record yet. Build it when a partner needs to retain part of the fuel, or when a jurisdiction that splits fuel comes on. Recorded here so the gap is a known deferral rather than an oversight.

**`SubContractorPercentage` / `SubContractorBonusPercentage` / `SubContractorFuelPercentage` are not this.** Those fields exist for contractors who have subcontractors working below them, and are unrelated to the network partner layer. An earlier revision of this document wrongly identified them as the NP-courier mechanism — do not build against them.

> ⚠️ **One design conflict to resolve before building (Q15).**
>
> **Name — resolved.** *(Steve, 17 Sep 2026.)* The field is **`NPCourierPayment`**, which matches `AGENT-MARKETPLACE-IMPLEMENTATION-PLAN.md` Migration M6 (`MONEY NULL`, on `tucJob`, `tucJobArchive`, `tucJobBooking`, `tblBulkJob`). Still confirm it is actually **deployed** — M6 may not have been run.
>
> **Which field carries tenant → NP.** That same plan states the opposite of §2.1: it adds a separate **`AgentRate`** column for what the tenant pays the NP, and says *"On NP jobs, `CourierPayment` should be NULL (tenant isn't paying a courier directly)"*, on the grounds that mixing payers in one field creates accounting ambiguity.
>
> **Steve's current decision supersedes that:** tenant → NP goes in `CourierPayment`, precisely so tenant GP falls out of the existing revenue − `CourierPayment` calculation with no second pass (§2.1). The plan's concern is real but the cost of a second GP calculation is higher.
>
> This matters because the marketplace plan is a written, plausible-looking design that says the reverse. Anyone reading it while implementing this spec will build the opposite. **The decision needs recording somewhere the next person will find it.**

### 2.3 Two paths — and the agent-rate path wins

*Steve, 17 Sep 2026.*

> **Rule: if an agent rate is used to calculate the price of a delivery that will ultimately be given to a network partner, store that agent rate in the courier payment field — at job creation.**

**Path A — agent-rate-priced delivery (stamp at creation).**
Where the **agent / network partner rate** is what calculates the headline rate for the delivery — the delivery portion of a **nationwide flight**, and **local nationwide speed** — the agent rate is already known at the moment the job is priced. Write it into `CourierPayment` **then**, at creation.

The point is to avoid **retrospectively back-calculating** the partner's pay at assignment. If the agent rate was the pricing input, reverse-engineering it later from a percentage is both unnecessary and lossy — a percentage applied to the charge will not reproduce the rate the charge was built from.

**Path B — everything else (resolve at assignment).**
Where no agent rate priced the delivery, there is nothing to stamp at creation, so `CourierPayment` is resolved when the partner is assigned, via the percentage cascade in §2.4.

**Precedence: Path A wins — but the lock is event-scoped, not permanent.**

*Steve, 17 Sep 2026.* The rule is:

> **A populated `CourierPayment` is not overwritten simply because the delivery is assigned to a network partner.** It *is* recalculated when the fundamentals of the job change — additional weight, additional items, additional cubic — which typically happens at pickup, when those are added.

So this is **not** "stamp it and freeze it". Assignment must not touch an existing value; a genuine re-rate must still flow through. A permanent lock flag would be the wrong fix — it would hold a partner on a rate that no longer matches the job they actually carried (§2.6d). This is the same shape as **Cost Plus (Mode 3)** on the cross-tenant side (§5), where the partner is quoted live for cost and *"you stamp cost as their agreed rate"* — worth keeping the two consistent.

**Where this lands in code.** The nationwide rating/insert path is `DD_stpGetNationwideRates` → `UTL_stpJob_NationWide_Insert`, with `NationwideJobRepository.cs` as the C# entry point. Note from `extra-charges-deep-dive.md`: **`UTL_stpJob_NationWide_Insert` has its `DD_InsertPricingBreakdown` call commented out** — the nationwide insert path does not populate PricingBreakdown today. Further reason the carrier here is `CourierPayment`, not breakdown rows (§2.1).

**This partially reverses §4.3.** "Schedule-created jobs cannot resolve pay at rating time" holds only for Path B. On Path A the rate *is* known at rating time and should be captured there.

### 2.4 Path B — the cascade on NP assignment

*Steve, 17 Sep 2026.* For deliveries where an agent rate did **not** calculate the delivery price:

1. If the **client the job is charged to has a `CourierPercentage`**, use that to calculate `CourierPayment` when assigning to the network partner.
2. If the client has none, use the **network partner's own default percentage**.

**In all instances `CourierPayment` is populated.** Fuel percentage passes straight through to the partner.

The 57% mentioned earlier is the typical value held against a network partner, not a platform constant — it comes from rule 2, not a hardcoded default.

### 2.5 How the partner is attached — and why the existing trigger cannot help

*Steve, 17 Sep 2026. This answers Q6/Q7 and is the most consequential fact in this document.*

> **When a network partner is assigned to a job, `ucjbCourierID` stays blank.** The partner is recorded in the **NP agent field** (`NpagentID` — see naming note below).
>
> The job is deliberately **not** assigned to a courier. It goes to the **network partner's own dispatch board**, and *they* assign it to one of their couriers.

That is two-stage dispatch: tenant → partner, then partner → their driver. `ucjbCourierID` is reserved for the tenant's own couriers, so it must stay empty.

**What this rules out.** `tucJob_InsertUpdate_CalculateCourierPayment` computes `CourierPayment = RawBaseAmount × CourierPercentage` from a six-level cascade (`CourierPayCalculationIssues.md` §3):

| Level | Source | On an NP job |
|---|---|---|
| 1 | `CourierPercentageOverride` on the job | — |
| 2 | `tblClientAvailableSpeed.CourierPercentage` (client + speed) | — |
| 3 | `tucJobType.CourierPercentage` (speed default) | — |
| 4 | `tucClient.CourierPercentage` (client default) | matches §2.4 rule 1 |
| 5 | `tucCourier.uccrPercentage` (the courier's own rate) | **no courier row to read** |
| 6 | Fallback `0.4` (40%) | — |

With no courier assigned, the trigger does not produce a partner payment — and separately, §2.4 rule 2 calls for the **agent's default percentage** to substitute for `uccrPercentage` anyway, which the trigger has no way to do.

**Conclusion: this is not a display-only fix.** Both halves are required:

1. **Data** — populate `CourierPayment` (and `CourierFuel`, §3.3) when the network partner is assigned, via the §2.4 cascade with the agent default substituted. Nothing does this today.
2. **Display** — render those fields to the partner in place of revenue (§3).

Shipping only the display change would show the partner **zero**.

**The existing evidence now reads as proof, not warning.** Job KT672V in `CourierPayCalculationIssues.md` §2 carries `FuelSurchargeAmount` **$18.50** with `CourierPayment` **$0.00** and `CourierFuel` **$0.00** — explicitly "no courier assigned yet". That is the exact state every NP job sits in.

> **Naming note (Q15).** Steve refers to the field as **`NpagentID`**. The EF model (`TucJob.cs`) and the schema dump both show only **`AgentID`** (`int NULL` → `tucAgents.ucagID`) on `tucJob`, with no `NpAgentID`. Either they are the same column under a working name, or `NpAgentID` is newer than the dump. **Confirm against the live DB before writing code.**
>
> Worth noting the precedent: the other name in doubt, `NPCourierPayment`, resolved in favour of the value already written down in Migration M6 (§2.2) rather than the working name. The dump may simply predate the NP work.

**Still open:** once the partner assigns one of *their* couriers on their board, does `ucjbCourierID` then get populated with that courier, or does it stay blank for the life of the job? That determines whether the trigger fires late and overwrites `CourierPayment` — exactly the failure §2.6d guards against (Q17).

### 2.6 Decisions that need Steve

**(a) Do cascade levels 1–3 apply to a network partner?**
§2.4 names only the client percentage and the partner's own percentage — levels 4 and 5. But the live trigger checks three levels *above* those: a job-level `CourierPercentageOverride`, a client+speed percentage, and a job-type percentage. For an NP job, should those still win over the client default, or be bypassed?

**Recommend: leave them in.** Level 1 is a deliberate per-job override and should always win; levels 2–3 are more specific than the client default and disabling them would be a behaviour change beyond this issue. But it means the rule as stated in §2.4 is not the whole truth in production — worth knowing before someone "fixes" an NP job that came out at a level 2 rate.

**(b) What if neither the client nor the partner has a percentage?**
The trigger falls back to **40%**. §2.4 says `CourierPayment` is populated in all instances, so something must fill the gap — confirm 40% is acceptable for a network partner, or whether this case should fail loudly instead. Paying a partner 40% by silent default is worse than refusing to compute.

**(c) Which base amount does the percentage multiply?**
The trigger uses **`RawBaseAmount`** (base only, no extras, no fuel), which is consistent with fuel passing through separately. Earlier framing said "the full amount" — 57% of `ucjbAmount` and 57% of `RawBaseAmount` are materially different numbers. Confirm `RawBaseAmount` (Q11).

**(d) Locking `CourierPayment` at the partner's own courier assignment — the highest risk in this document.**

*Steve, 17 Sep 2026.*

The trigger does **not** fire when the network partner is assigned, because `ucjbCourierID` is not populated then (§2.5). The danger is one step later:

> **When the network partner assigns the job to their own courier**, `ucjbCourierID` is populated — and `tucJob_InsertUpdate_CalculateCourierPayment` fires. **`CourierPayment` must be locked at that moment** so the percentage calculation does not run.

**Why this is worse than a plain overwrite.** The trigger would recompute `CourierPayment = RawBaseAmount × CourierPercentage`, resolving the percentage from the courier now sitting on the job — **the network partner's own driver**. That driver's pay belongs in `NPCourierPayment` (§2.2). So the trigger does not merely write a wrong number into `CourierPayment`; it **collapses the two layers**, replacing the tenant → partner amount with an NP → courier calculation. Tenant GP (§2.1) silently becomes wrong, and nothing on the job shows it happened.

**But the lock must stay event-scoped, not permanent.** Per the rule in §2.3, `CourierPayment` still has to recalculate when the fundamentals change — additional weight, items or cubic, typically added at pickup. A permanent flag on the row would block that and hold the partner on a rate that no longer matches the job they carried.

So the requirement has two halves that a single boolean will not express:

| Event | `CourierPayment` |
|---|---|
| Network partner assigned | **populate** (§2.4 cascade, agent default substituted) |
| **Partner assigns their own courier** → `ucjbCourierID` set | **populate if still empty — locked if already set** |
| Weight / items / cubic changed (usually at pickup) | recalculate |

> **Populate if empty, lock if set.** *(Steve, 17 Sep 2026.)*
>
> The partner assigning one of their own drivers is not only the moment `CourierPayment` must be protected — it is also the **fallback moment to populate it**, if allocation to the network partner did not already do so.
>
> This is a better rule than a blanket lock. If the allocation-time write is missed, fails, or the job reached the partner by a path that skipped it, the partner would otherwise end up on **zero** — the exact failure §3.3 warns about. A populate-if-empty rule gives a second chance; a blanket lock cements the gap.
>
> What must **not** happen at this event is a *recalculation* of an already-populated value. The percentage the trigger would resolve there comes from the **partner's own driver**, whose pay belongs in `NPCourierPayment` (§2.2) — using it to rewrite `CourierPayment` is the layer collapse described above.

`tucJob.CourierPaymentManualOverride` (bit) may be the right lock for the middle row, but it must not be allowed to suppress the third. Check what already carries the signal before adding new machinery — `tucJob.Reprice` (bit), `tucJob.RatedManually` (bit), and the `tucJob_Update_RecalculateAmount` / `tucJob_Update_RecalculateRawBaseAmount_And_CourierBonus` triggers all sit in this space (Q12).

> **Design question worth raising separately (Q17).** If the partner's own driver lands in `ucjbCourierID`, the tenant's courier field is holding the *partner's* courier — which is what makes the trigger dangerous here in the first place. Confirm that is genuinely what happens on the NP board, and whether that driver belongs in a field of its own rather than the tenant's.

---

## 3. The Display Change — For Kerran, Implementing in Dispatch

*Steve, 17 Sep 2026. This is the change being asked for.*

### 3.1 The substitution

The **price breakdown in the job details** — wherever it is surfaced when a **network partner is logged in** — renders the partner's own numbers in place of the tenant's revenue. Same job, same layout, substituted values:

| Breakdown line | Normally reads | **NP logged in reads** |
|---|---|---|
| Base / amount | `ucjbAmount` / `RawBaseAmount` | **`CourierPayment`** |
| Fuel | `FuelSurchargeAmount` | **`CourierFuel`** |
| Total | revenue total | partner total (`CourierPayment` + `CourierFuel`) |

The partner sees `CourierPayment` **as the revenue figure** — not the job's actual revenue field. They are looking at the same job; the money simply reads as theirs.

### 3.2 Use `CourierFuel`, not the job's fuel amount

At Urgent the whole fuel surcharge is passed to the network partner, so `CourierFuel` and `FuelSurchargeAmount` are the same number and either would appear to work.

**Bind to `CourierFuel` anyway.** Other jurisdictions do not pass all the fuel on, and `CourierFuel` is the field that carries the partner's actual share. Binding to `FuelSurchargeAmount` produces a correct-looking display at Urgent that silently over-reports the partner's fuel everywhere else — the kind of defect that ships because it tests clean in the one place it was tested.

### 3.3 `CourierFuel` must be populated first — confirmed gap

`CourierFuel` is calculated when a courier is assigned. **This is now confirmed, not a risk.** Per §2.5, a network partner job has no courier assigned — `ucjbCourierID` stays blank — so the trigger never sets `CourierFuel`, which only populates when `CourierPayment > 0`. Job KT672V in `CourierPayCalculationIssues.md` §2 is the proof: `FuelSurchargeAmount` **$18.50**, `CourierFuel` **$0.00**, no courier assigned.

**Timing is settled.** *(Steve, 17 Sep 2026.)* `CourierFuel` can be allocated **at the time of network partner allocation** — the same moment `CourierPayment` is populated (§2.5). One piece of work, not two.

**So `CourierFuel` must be populated as part of the assignment work (§2.5), before or with the view change.** Binding the view to it first would show the partner no fuel at all — worse than the current over-statement, because a partner who is shown too little is less likely to query it.

### 3.4 Scope — and one known leak

Apply the substitution to **every** NP-facing surface, not only the screen where it was noticed:

**A network partner sees DespatchWeb and Routed Operations** *(Steve, 17 Sep 2026 — Q2)*. Both applications are in scope, not just the dispatch board:

| App | Surface | Note |
|---|---|---|
| **DespatchWeb** | NP dispatch board — job detail price breakdown | the case in hand |
| **DespatchWeb** | NP dispatch board — job list, and any column showing an amount | |
| **DespatchWeb** | **Job search → job download / export** | ⚠️ **known leak — see below** |
| **Routed Operations** | run / schedule views and job detail visible to a partner | ⚠️ **separate application — separate code path** |
| **Routed Operations** | any run sheet, manifest or export a partner can pull | |
| DespatchWeb | Agent Portal (InboundAgent) per-job encrypted link | |
| either | any other NP-visible export, report or emailed summary | |

> **Routed Operations is the easy one to miss.** It is a different application with its own views and its own queries — fixing DespatchWeb does nothing for it. Anything a partner can open there showing a job amount needs the same substitution.

> ⚠️ **Job search / job download report — flagged by Steve, 17 Sep 2026.**
>
> **The job download report shows the full revenue amount.** If a network partner can run a job search and download the result, the revenue this whole change is meant to mask is handed over in a spreadsheet — regardless of what the dispatch board displays.
>
> **Kerran to check this specifically.**
>
> Treat it as likely rather than possible. Exports are usually built from their own query or report definition rather than the screen's view model, so masking the UI does **not** mask the download. Two code paths, one of which nobody thinks to look at.

A field masked in one place and leaked in another is the same bug — and an export is the worst place to leak it, because the partner keeps the file.

The substitution itself is a **view-layer change** with no schema change — but it is **not sufficient on its own**. Per §2.5 neither `CourierPayment` nor `CourierFuel` is populated on an NP job today, so the assignment-time data work must land first or the partner sees zero.


---

## 4. What `pricing-breakdown-gap-analysis.md` §6 Does Not Cover

### 4.1 The payee is an agent, not a courier

§5 speaks only of "couriers". The partner case adds linkage §5 does not model:

| Column | Points at | Notes |
|---|---|---|
| `AgentID` | `tucAgents.ucagID` | The agent/NP on the job |
| `MasterCourierId` | `tucCourier.uccrID` | NP-as-master with sub-couriers underneath |
| `SubContractorPercentage` / `SubContractorBonusPercentage` / `SubContractorFuelPercentage` | — | Sub-contractor pay split |

NPs are modelled on `tucCourier` + `tucCourierFleet` + `CourierType` (`dfrnt-platform-docs/DB-SCHEMA.md` §17), **but `tucAgents` is a separate table that `tucJob.AgentID` points at and which is absent from the schema reference entirely.** Whether Golden Black Taxis is an agent row, a courier/fleet row, or both is unknown — see Q4/Q7.

The rate-masking rule already agreed for the NP programme:

> NP sees "Revenue" not "Amount"; master sees "Amount" + "Agent Rate".
> `NpCourierPayment` = separate field, default 70% of AgentRate, configurable per agent.

### 4.2 Rate cards, where a flat or zone rate is wanted instead of a percentage

> **Largely superseded by §2.** The percentage cascade in §2.4 is the production mechanism and resolves the Golden Black Taxis case without any of the below. This subsection stays because a **flat or zone-based** partner rate — "AKL → PN delivery = $X" rather than a percentage of the charge — is not expressible in that cascade, and the NP programme has already modelled one. It is also the rate source for **Path A** (§2.3) — where an agent rate prices a nationwide delivery leg, this is what that rate comes from, so it is not purely a later question.

The model in the NP redesign C# layer (`Steve-v2.0-NP-Redesign/api/src/DfrntAgentsPartners.Core/Models/`):

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
> **`AgentVehicleRate` exists** *(Steve, 17 Sep 2026 — Q3)* — the agent rate card is real and deployed, not just a prototype class. Since `tucAgents` also carries `Flagfall` / `KilometerRate` / `ItemRate` / `MaxKMs` (§2.7), Kerran should confirm **which of the two is authoritative** for pricing an agent delivery before Path A is built against either.
>
> **Largely resolved by §2.7:** the production agent rate card lives on `tucAgents` (`Flagfall`, `KilometerRate`, `ItemRate`, `MaxKMs`), and `AgentVehicleRate` mirrors those four fields — a re-modelling, not a rival. The note below stands as corroboration.
>
> `extra-charges-deep-dive.md` §3 lists **`AgentVehicleService.cs` in Admin Manager** ("Agent vehicle rates with extra charge links"). That implies agent vehicle rates are an **existing production concept**, and the NP-redesign class may be a re-modelling of a table that already exists. **Confirm against the live DB before writing any migration** (Q3) — the worst outcome here is a third competing shape.

### 4.3 Schedule-created jobs cannot resolve pay at rating time

**The path produces child legs** *(Steve, 17 Sep 2026 — Q8)*, so the delivery leg a partner is allocated to is a child job, linked via `ParentId` / `RootParentId`. Everything in §2 about populating `CourierPayment` applies to **that child**, not the parent.

Schedule jobs carry `ScheduleName`, and link back via `BookingParentId` / `BulkParentId`. They are rated **in bulk at creation** — before anyone knows which partner will take the delivery leg.

So at rating time there is no partner, no rate, and no cost figure. The record is revenue-only by construction.

**Implication (Path B only — see §2.3):** where no agent rate priced the delivery, partner pay must be resolved at **allocation** time, not creation time. On Path A the agent rate is known at rating and is stamped at creation. Any design that resolves it during rating will be wrong for the schedule path — which is the path in Steve's example.

This also interacts with §5's open question 6 ("when should consolidated Invoice rows be created on the parent") — for schedule jobs the answer cannot be "at booking."

---

## 5. Partner Pricing Modes (shipped 27 May 2026) — Context and Precedent

Source: *Release Notes — Partner Pricing Modes, 2026-05-27*. The shipped code is on GitLab; the local `integration-manager` clone predates it and contains none of it, so this section is written from the release notes, not from source.

### 5.1 Two partner mechanisms — this one is the in-tenant agent path

*Answered by Steve, 17 Sep 2026: **the right-hand column**. Golden Black Taxis is an in-tenant agent / network partner, **not** a paired DFRNT tenant.*

| | Cross-tenant partner dispatch | **In-tenant agent / NP allocation** ← **this** |
|---|---|---|
| Who the partner is | Another **DFRNT tenant** | An **agent / NP** on this tenant |
| Linkage | Partner pairing + Partner Service Mappings | NP agent field on `tucJob` → `tucAgents` (§2.5) |
| Rate source | Pricing Mode on the service mapping (Agreed / Percentage / Cost Plus) | `tucAgents` rate card + percentage cascade (§2.4, §2.7) |
| Partner-facing surface | Send-to-Partner dialog (A side), B's own dispatch board | NP dispatch board, Agent Portal (InboundAgent) |
| Transport | Partner outbox, HMAC-signed events | Internal — same DB |

**So §2 and §3 apply as written.** There is no Pricing Mode shortcut here: the fix is the build described in §2 (populate `CourierPayment` / `CourierFuel` at allocation) plus the display substitution in §3.

The rest of §5 is retained as **context and reusable precedent** from the cross-tenant work — not as a live alternative.

### 5.2 Partner pay derived from client revenue is sanctioned, not a bug

**Mode 2 (Percentage)** pays the partner `UcjbAmount × pct` — deliberately linked to the client charge, no quote round-trip.

So "partner pay is derived from job revenue" is a supported DFRNT pricing model. Steve's symptom is that Golden Black Taxis sees **the revenue amount itself**, not a percentage of it. That is a **display / fallback failure, not a data-model flaw** — which is exactly what §3 fixes, and makes Q1 (which field the surface renders) the cheapest path to the answer.

### 5.3 There is a documented precedent for exactly this failure shape

> "The Send to Partner dialog in DespatchWeb has been opening with an empty rate input for some time (the old `IntMgrPartnerRateCard` endpoint was dropped and never reimplemented — **every call has silently 404'd**)."

A partner-facing rate surface lost its data source, failed silently, and fell back to something wrong — for months. **That is the first hypothesis to test on the agent/NP side** (Q1): not "the wrong field was chosen", but "the right field's source died and the surface fell back to `ucjbAmount`."

### 5.4 Two patterns worth reusing on the agent side

- **Mode 1 acceptance gate** — the receiver must accept or reject the operator-typed rate before Allocate / ReAllocate is permitted; Percentage and Cost Plus auto-accept because the formula was agreed upfront. A partner being able to work a job before the rate is agreed is the same exposure on the agent path.
- **Mode 3 rate-change broadcast** — a signed `RateChanged` event re-quotes every open Cost-Plus job on that service code and rewrites cost + margin in place, leaving picked-up/void jobs alone. Whatever resolves agent rates will need the same "what happens to jobs already in flight" answer.

### 5.5 The tension it leaves open

Because pricing mode flows **on the wire only**, nothing persists on the job recording what the partner was actually paid. On the cross-tenant side that is accepted — settlement reconciles separately.

On the agent/NP path there **is** a persisted field — `CourierPayment` (§2.1) — so the gap is narrower than it looked. The two mechanisms differ deliberately: cross-tenant settlement reconciles outside the job record, while agent/NP pay lands on the job so tenant GP works without a second calculation.

### 5.6 A caveat on the cross-tenant side that does *not* apply here

> "For Mode 2 (Percentage) to work, the job must have a `UcjbAmount` populated at dispatch time; if it's missing, the Send-to-Partner dialog falls back to manual entry."

**Not a risk on this path.** *(Steve, 17 Sep 2026.)* A job will have `ucjbAmount` populated — there is no prospect of it being zero at the time of allocation to a network partner. Q9 is closed.

So the §2.4 cascade always has a charge figure to work from. The failure mode this caveat describes belongs to the cross-tenant Send-to-Partner dialog, not to in-tenant agent allocation.

> Note this closes the *amount-exists* question only. **Which** amount the percentage multiplies — `RawBaseAmount` or `ucjbAmount` — is a separate and still-open decision (§2.6c, Q11).

---

## 6. Correction to an Earlier Draft

An earlier version of this investigation proposed reusing the Split Job machinery (`SplitJobService.cs`, `ParentId`/`RootParentId`) to make the delivery leg its own job. **That was redundant.** Per §5, nationwide/Excelerator jobs **already** decompose into pickup / linehaul / delivery child legs. The delivery leg the partner is allocated to is most likely already a child job.

What still needs confirming is §6's own open question 8 — whether split jobs and nationwide jobs share the parent/child handling — plus Q8 below: whether the schedule path actually produces child legs, or one flat job with the partner allocated to the whole thing.

---

## 7. Open Questions

*Answered by Steve, 17 Sep 2026 unless noted. Remaining items are split by who can actually close them — a lookup and a decision are not the same thing.*

### 7.1 Answered

| # | Answer |
|---|---|
| Q0 | Golden Black Taxis are a **network partner** — in-tenant agent allocation, not cross-tenant partner dispatch (§5.1). |
| Q1 | The field the partner should see is **`CourierPayment`** (§3.1). |
| Q2 | The network partner sees **DespatchWeb** and **Routed Operations**. Both are in scope for the substitution (§3.4). |
| Q3 | **`AgentVehicleRate` exists.** The agent rate card is real and deployed (§4.2). |
| Q6 | On an NP job `ucjbCourierID` stays blank; the partner goes in the agent field (§2.5). Kerran has DB access to confirm values. |
| Q7 | Golden Black are an **agent**, and they have **their own couriers** — a network partner agent. Confirms the two pay layers in §2.2. |
| Q8 | The path **produces child legs**. The delivery leg the partner is allocated to is a child job (§2.3, §4.3). |
| Q9 | `ucjbAmount` is always populated; no risk of zero at allocation (§5.6). |

### 7.2 Assigned — lookups, not decisions

**Kerran** has full database access for the agents table and the remaining schema questions, and access to the stored procedures and trigger bodies.

| # | Lookup | Owner |
|---|---|---|
| Q4 | Full `tucAgents` column list — partially captured in §2.7 from the schema dump; confirm against live. | Kerran |
| Q5 | Body of `tucJob_Update_AddPickupAmountToNationwideAmount`. | Kerran |
| Q12 | What signal can gate `tucJob_InsertUpdate_CalculateCourierPayment` — check `Reprice`, `RatedManually`, `CourierPaymentManualOverride` and the existing recalculate triggers (§2.6d). | Kerran |
| Q14 | Is `CourierFuel` populated on NP assignment? Expected **no**, per §2.5 — confirm. | Kerran |
| Q15a | Is the NP agent field named **`NpagentID`** or the existing **`AgentID`**? Is Migration M6 (`NPCourierPayment`) deployed? | Kerran |
| Q16 | Where does the **agent's default percentage** live? `tucAgents` has no percentage column — candidates are `tblSetting.DefaultCourierPercentage` or `Agent.DefaultCourierPaymentPercent`. | Kerran |
| Q17a | Confirm the partner's own driver lands in `ucjbCourierID` when they assign on their board (§2.6d). | Kerran |
| Q18 | Does the **job search / job download** export expose full revenue to a logged-in network partner? Built from its own query, so masking the UI will not cover it (§3.4). | Kerran |

### 7.3 Still needs a decision — no lookup will settle these

These are policy and design calls. Database access does not answer them, and if they are left to be inferred during implementation they will be inferred inconsistently.

| # | Decision | Ref |
|---|---|---|
| Q10a | Do cascade levels 1–3 (`CourierPercentageOverride`, client+speed, job type) apply to a network partner job, or are they bypassed in favour of the §2.4 rule? | §2.6a |
| Q10b | If neither the client nor the partner has a percentage, is the trigger's **40% fallback** acceptable for a partner — or should that case fail loudly rather than pay a silent default? | §2.6b |
| Q11 | Does the percentage multiply **`RawBaseAmount`** or **`ucjbAmount`**? At 57% these are materially different numbers. | §2.6c |
| Q13 | The full set of speeds / job types that are **Path A**. Steve named nationwide flight delivery portion and local nationwide speed; the set needs closing so Path B is not applied to a Path A job. | §2.3 |
| Q15b | Is the `AgentRate` / `CourierPayment`-NULL model in `AGENT-MARKETPLACE-IMPLEMENTATION-PLAN.md` superseded **on the record**? That document has now proved authoritative on naming, so it will be trusted on design unless the supersession is written down. | §2.2 |
| Q17b | Should the partner's own driver sit in the tenant's `ucjbCourierID` at all, or in a field of its own? Locking guards the symptom; moving it removes the cause. | §2.6d |

### Verification queries — SELECT only, read-only

```sql
-- Q6: what a PN schedule job actually looks like
SELECT TOP 50
    j.ucjbID, j.ucjbJobNumber, j.ScheduleName,
    j.ucjbAmount, j.RawBaseAmount, j.FuelSurchargeAmount,
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
       ucjbAmount, CourierPayment, CourierFuel
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

## 8. Likely Affected Code

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

## 9. Recommendation

1. **Treat this as two pieces of work, not one.** On an NP job `ucjbCourierID` stays blank (§2.5), so the existing trigger never populates `CourierPayment` or `CourierFuel`. The display substitution (§3) on its own would show the partner **zero**.
2. **Data first — populate `CourierPayment` and `CourierFuel` at partner allocation**, on the **child delivery leg** (§4.3, Q8). Both fields at the same moment, one piece of work. Use the §2.4 cascade: client `CourierPercentage`, else the **agent's default percentage**. `NPCourierFuelAmount` is deferred — not in MVP (§2.2).
3. **Then ship the display substitution (§3) across both applications.** A partner sees **DespatchWeb and Routed Operations** (Q2) — two apps, two code paths. Include the **job search / job download export** (Q18): it shows full revenue today and is built from its own query, so fixing the board will not fix it.
4. **Get §7.3 decided before implementation starts.** Six items — cascade levels, the 40% fallback, the base amount, the Path A speed set, recording the marketplace-plan supersession, and where the partner's driver belongs. No database lookup answers any of them, and left to implementation they will be answered inconsistently.
5. **Kerran's lookups (§7.2) gate the data work.** Chiefly: the NP agent field name, whether Migration M6 is deployed, where the agent default percentage lives, and whether `tucAgents` or `AgentVehicleRate` is authoritative for agent pricing (Q3).
6. **Path A (§2.3) is the cheaper half and can go first.** Where an agent rate priced the delivery, the rate is already the pre-markup number and is stamped into `CourierPayment` at creation. Confirm the speed/job-type set (Q13).
7. **`CourierPayment`: populate if empty, lock if set, recalculate on weight / items / cubic (§2.6d).** The partner assigning their own driver is both the hazard and the fallback chance to populate. Not a permanent flag.
8. **Keep partner pay in `CourierPayment`** — it is what makes tenant GP work with no second calculation (§2.1).

---

## 10. Sources

Verified locally:

- `Accounts/Core/Domain/Despatch/TucJob.cs`, `TucJobArchive.cs`, `DespatchContext.cs` — EF model, trigger registrations
- `Accounts/CourierPayCalculationIssues.md` (31 Mar 2026)
- `integration-manager/INTER_TENANT_INTEGRATION.md` — design ancestor of the partner pairing model
- `despatchwebchanges/pricing-breakdown-gap-analysis.md` §5, `extra-charges-deep-dive.md` §3, `SplitJobUpdate.md`
- `dfrnt-platform-docs/DB-SCHEMA.md`
- `Steve-v2.0-NP-Redesign/api/src/DfrntAgentsPartners.Core/Models/` — `Agent.cs`, `NpCourier.cs`, `AgentVehicleRate.cs`, `AgentCourierRate.cs`; `database/001`–`005*.sql`
- `routed-operations/` schedule + linehaul docs and schedule rationalisation output

- *Release Notes — Partner Pricing Modes, 2026-05-27* (supplied by Steve; shipped code is GitLab-side and not in the local `integration-manager` clone)
- **Steve, 17 Sep 2026** — the production NP pay mechanism (§2), the agent-rate-at-creation rule (§2.3), the Path B cascade (§2.4) and the price-breakdown substitution (§3). Recalled from operating knowledge, not read from source; §2.5/§2.6 list what still needs confirming against the live DB.

**Not** available locally — must be checked against GitLab / live DB:

- `despatchweb`, `inboundagent`, `booking`, `courierportal` source
- `tucAgents` definition; trigger bodies; deployed agent rate tables
