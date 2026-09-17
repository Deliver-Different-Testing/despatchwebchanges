# Network Partner Pay Visibility

**Date:** 17 September 2026
**For:** Karen (implementation, Dispatch), Jacob
**From:** Steve Bonnici (AI-assisted analysis)
**Status:** Investigation — not scoped for build, not assigned.

> **Start at §2 and §3.** §2 is how network partner pay actually works in production (confirmed by Steve, 17 Sep 2026) — note §2.3, which splits the work into two paths with different timing; §3 is the change being asked for. §4 onward is supporting analysis, and §6 records where earlier revisions of this doc were wrong.
>
> **The implementation deliverable for Karen is the copy in the `Dispatch` repo** (`Deliver-Different-Testing/Dispatch`), which is where Dispatch specs live. This copy sits with the supporting analysis — keep them in step if either changes.
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

When the network partner pays *their* courier, that amount is stored in **`NPcourierAmount`** — a distinct field from `CourierPayment`.

Two layers, two fields, two payers:

| Layer | Payer → payee | Field |
|---|---|---|
| Tenant → network partner | the tenant pays the NP | **`CourierPayment`** (§2.1) |
| NP → their own courier | the NP pays their driver | **`NPcourierAmount`** |

**`SubContractorPercentage` / `SubContractorBonusPercentage` / `SubContractorFuelPercentage` are not this.** Those fields exist for contractors who have subcontractors working below them, and are unrelated to the network partner layer. An earlier revision of this document wrongly identified them as the NP-courier mechanism — do not build against them.

> ⚠️ **Two naming and design conflicts to resolve before building (Q15).**
>
> **Name.** `AGENT-MARKETPLACE-IMPLEMENTATION-PLAN.md` Migration M6 adds the field as **`NpCourierPayment`** (`MONEY NULL`, on `tucJob`, `tucJobArchive`, `tucJobBooking`, `tblBulkJob`). Steve refers to it as **`NPcourierAmount`**. Confirm the deployed column name before writing code against either.
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

### 2.5 Path B is already exactly what the existing trigger does

`tucJob_InsertUpdate_CalculateCourierPayment` computes `CourierPayment = RawBaseAmount × CourierPercentage` from a six-level cascade (`CourierPayCalculationIssues.md` §3):

| Level | Source | |
|---|---|---|
| 1 | `CourierPercentageOverride` on the job | |
| 2 | `tblClientAvailableSpeed.CourierPercentage` (client + speed) | |
| 3 | `tucJobType.CourierPercentage` (speed default) | |
| **4** | **`tucClient.CourierPercentage`** (client default) | ← **Steve's rule 1** |
| **5** | **`tucCourier.uccrPercentage`** (the courier's own rate) | ← **Steve's rule 2** |
| 6 | Fallback `0.4` (40%) | |

**Steve's Path B cascade is levels 4 and 5 of the cascade already running in production, in that order.**

The consequence is worth stating plainly:

> If the network partner is assigned as **`ucjbCourierID`**, the existing trigger **already does exactly what §2.4 describes**. `CourierPayment` is already correct, Path B needs no new calculation code, and the entire defect is what the NP dispatch view renders (§3).
>
> If the network partner is attached via **`AgentID` only**, the trigger never fires for them, `CourierPayment` stays null or zero, and the view falls back to revenue.

Q6 and Q7 settle which, with one SELECT. **Run them before designing anything** — the difference is between a view-layer fix and a build.

### 2.6 Decisions that need Steve

**(a) Do cascade levels 1–3 apply to a network partner?**
§2.4 names only the client percentage and the partner's own percentage — levels 4 and 5. But the live trigger checks three levels *above* those: a job-level `CourierPercentageOverride`, a client+speed percentage, and a job-type percentage. For an NP job, should those still win over the client default, or be bypassed?

**Recommend: leave them in.** Level 1 is a deliberate per-job override and should always win; levels 2–3 are more specific than the client default and disabling them would be a behaviour change beyond this issue. But it means the rule as stated in §2.4 is not the whole truth in production — worth knowing before someone "fixes" an NP job that came out at a level 2 rate.

**(b) What if neither the client nor the partner has a percentage?**
The trigger falls back to **40%**. §2.4 says `CourierPayment` is populated in all instances, so something must fill the gap — confirm 40% is acceptable for a network partner, or whether this case should fail loudly instead. Paying a partner 40% by silent default is worse than refusing to compute.

**(c) Which base amount does the percentage multiply?**
The trigger uses **`RawBaseAmount`** (base only, no extras, no fuel), which is consistent with fuel passing through separately. Earlier framing said "the full amount" — 57% of `ucjbAmount` and 57% of `RawBaseAmount` are materially different numbers. Confirm `RawBaseAmount` (Q11).

**(d) Making recalculation conditional — the highest risk in this document.**
`tucJob_InsertUpdate_CalculateCourierPayment` fires on **every** insert and update and recomputes `CourierPayment` from the percentage cascade. It does not distinguish *why* the row changed. Two failures fall out of that, in opposite directions:

| If the trigger… | Result |
|---|---|
| recalculates on **assignment** | a stamped agent rate (Path A), or a rate already correctly set, is silently replaced by a percentage of the charge — partner paid the wrong number, nothing to show it happened |
| does **not** recalculate on a **weight / items / cubic** change | partner paid against the original job, not the heavier or larger one they actually carried |

The fix is therefore **not a permanent lock flag.** `tucJob.CourierPaymentManualOverride` (bit) would freeze the value through legitimate re-rates and cause the second failure. What is needed is recalculation gated on *what changed*: skip when the change is an assignment, run when a rating input changed.

Check what already exists before building new machinery — `tucJob.Reprice` (bit), `tucJob.RatedManually` (bit) and the `tucJob_Update_RecalculateAmount` / `tucJob_Update_RecalculateRawBaseAmount_And_CourierBonus` triggers all sit in this space and may already carry the signal (Q12).

---

## 3. The Display Change — For Karen, Implementing in Dispatch

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

### 3.3 `CourierFuel` must actually be populated — confirm this first

`CourierFuel` is calculated **when a courier is assigned** — and in this case, when the **network partner** is assigned. The display change depends on that happening.

**There is direct evidence it does not always happen.** In `CourierPayCalculationIssues.md` §2, both sampled jobs show `CourierFuel = $0.00`:

- **KT670V** — `CourierPayment` $41.69, `FuelSurchargeAmount` $0.00, `CourierFuel` **$0.00**
- **KT672V** — `FuelSurchargeAmount` **$18.50**, `CourierPayment` $0.00 (no courier assigned), `CourierFuel` **$0.00**

KT672V is the warning: a job carrying $18.50 of fuel with `CourierFuel` sitting at zero. Bind the NP view to `CourierFuel` while it is unpopulated and the partner sees **no fuel at all**. That is a worse failure than the current one — currently they see a number that is too big; this would show them a number that is too small, which they may not query.

The existing trigger sets `CourierFuel = FuelSurchargeAmount` only when `CourierPayment > 0`, which is consistent with both samples. So the fuel population question is bound to the same one as §2.5: **if the partner is attached via `AgentID` rather than `ucjbCourierID`, neither `CourierPayment` nor `CourierFuel` is calculated for them.**

**Sequence the work accordingly: confirm `CourierFuel` populates on NP assignment (Q14) before binding the view to it.**

### 3.4 Scope

Apply the substitution to **every** NP-facing surface, not only the screen where it was noticed:

- NP dispatch board — job detail price breakdown *(the case in hand)*
- NP dispatch board — job list, and any column showing an amount
- Agent Portal (InboundAgent) per-job encrypted link
- Any NP-visible export, report or emailed summary

A field masked in one place and leaked in another is the same bug. This is a **view-layer change** — no schema change — provided §2.5 and Q14 confirm `CourierPayment` and `CourierFuel` are populated.

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
> **However** — `extra-charges-deep-dive.md` §3 lists **`AgentVehicleService.cs` in Admin Manager** ("Agent vehicle rates with extra charge links"). That implies agent vehicle rates are an **existing production concept**, and the NP-redesign class may be a re-modelling of a table that already exists. **Confirm against the live DB before writing any migration** (Q3) — the worst outcome here is a third competing shape.

### 4.3 Schedule-created jobs cannot resolve pay at rating time

Schedule jobs carry `ScheduleName`, and link back via `BookingParentId` / `BulkParentId`. They are rated **in bulk at creation** — before anyone knows which partner will take the delivery leg.

So at rating time there is no partner, no rate, and no cost figure. The record is revenue-only by construction.

**Implication (Path B only — see §2.3):** where no agent rate priced the delivery, partner pay must be resolved at **allocation** time, not creation time. On Path A the agent rate is known at rating and is stamped at creation. Any design that resolves it during rating will be wrong for the schedule path — which is the path in Steve's example.

This also interacts with §5's open question 6 ("when should consolidated Invoice rows be created on the parent") — for schedule jobs the answer cannot be "at booking."

---

## 5. Partner Pricing Modes (shipped 27 May 2026) — What It Settles

Source: *Release Notes — Partner Pricing Modes, 2026-05-27*. The shipped code is on GitLab; the local `integration-manager` clone predates it and contains none of it, so this section is written from the release notes, not from source.

### 5.1 There are two partner mechanisms, not one — and this is now the pivotal question

| | **Cross-tenant partner dispatch** | **In-tenant agent / NP allocation** |
|---|---|---|
| Who the partner is | Another **DFRNT tenant** | An **agent / NP** on this tenant |
| Linkage | Partner pairing + Partner Service Mappings | `tucJob.AgentID` → `tucAgents`, `MasterCourierId` |
| Rate source | Pricing Mode on the service mapping (Agreed / Percentage / Cost Plus) | `AgentVehicleRate` / `AgentCourierRate` / percentage cascade |
| Partner-facing surface | Send-to-Partner dialog (A side), B's own dispatch board | Agent Portal (InboundAgent) encrypted link, NP board |
| Transport | Partner outbox, HMAC-signed events | Internal — same DB |

**§4 of this document assumes the second mechanism, and §2's cascade is written for it.** That assumption needs confirming before anything is built.

Golden Black Taxis is a Palmerston North taxi operator and almost certainly **not a DFRNT tenant**, which points to the agent/NP path. But it must be checked — if they are in fact a paired tenant, most of §2 is aimed at the wrong mechanism and the fix is a Pricing Mode configuration, not a build. **This now outranks Q1.**

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

### 5.6 A caveat that lands directly on the schedule path

> "For Mode 2 (Percentage) to work, the job must have a `UcjbAmount` populated at dispatch time; if it's missing, the Send-to-Partner dialog falls back to manual entry."

Schedule-created jobs are bulk-rated at creation, so `UcjbAmount` should be present — but this needs confirming for the schedule path specifically (Q9). A silent fallback to manual entry is precisely how a wrong number reaches a partner.

---

## 6. Correction to an Earlier Draft

An earlier version of this investigation proposed reusing the Split Job machinery (`SplitJobService.cs`, `ParentId`/`RootParentId`) to make the delivery leg its own job. **That was redundant.** Per §5, nationwide/Excelerator jobs **already** decompose into pickup / linehaul / delivery child legs. The delivery leg the partner is allocated to is most likely already a child job.

What still needs confirming is §6's own open question 8 — whether split jobs and nationwide jobs share the parent/child handling — plus Q8 below: whether the schedule path actually produces child legs, or one flat job with the partner allocated to the whole thing.

---

## 7. Open Questions

Not resolvable from the material available locally. `despatchweb`, `inboundagent`, `booking` and `courierportal` are **not cloned on this machine** — the `gitlab-source` directories are empty shells — so the code paths below are inferred from schema, triggers and design docs, **not read from source**. GitLab remains source of truth.

| # | Question | Where |
|---|---|---|
| **Q0** | **Which mechanism carries Golden Black Taxis — a paired DFRNT tenant, or an in-tenant agent/NP?** Answer this before anything else; it decides whether §2 and §4 apply at all (see §5.1). If they are a paired tenant, the fix is likely a Pricing Mode setting on the service mapping, not a build. | Partner pairings / Partner Service Mappings vs `tucAgents` / `tucCourier` |
| Q1 | Which field does the **Agent Portal (InboundAgent)** render as the money figure — and **does its data source still resolve?** Test the `IntMgrPartnerRateCard` failure shape (§5.3): a dead endpoint falling back to `ucjbAmount`. | `inboundagent` job view model / view; check for 404s in logs |
| Q2 | Which field does the **NP dispatch board** render — same or different? | `despatchweb` NP board, `courierportal` |
| Q3 | Does `AgentVehicleRate` **already exist in the live DB** (per `AgentVehicleService.cs`)? Does deployed `AgentCourierRate` match the C# model, migration 005, or neither? | Live DB `INFORMATION_SCHEMA` |
| Q4 | Full column list for **`tucAgents`** — referenced by `tucJob.AgentID`, absent from `DB-SCHEMA.md` | Live DB |
| Q5 | Body of `tucJob_Update_AddPickupAmountToNationwideAmount` — firing conditions, what it writes | Live DB `sp_helptext` |
| Q6 | On a live PN schedule job: actual values of `CourierPayment`, `CourierFuel`, `CourierPercentage`, `ucjbCourierID`, `AgentID`, `ParentId` | Live DB, SELECT only |
| Q7 | Is Golden Black Taxis an **agent** (`tucAgents`), a **courier/fleet** (`tucCourier`), or both? | Live DB |
| Q8 | Does the schedule path produce child legs, or one flat job with the partner on the whole job? | `despatchweb` `NationwideJobRepository.cs` + live data |
| Q15 | What is the **deployed column name** for the NP→courier amount — `NPcourierAmount` or `NpCourierPayment` (Migration M6)? Is it deployed at all? And is the `AgentRate`/`CourierPayment`-NULL model in `AGENT-MARKETPLACE-IMPLEMENTATION-PLAN.md` superseded on the record, not just in conversation? (§2.2) | Live DB + Steve |
| Q14 | Is **`CourierFuel`** populated when a network partner is assigned? Both jobs sampled in `CourierPayCalculationIssues.md` show `CourierFuel = $0.00`, one of them on a job carrying $18.50 of fuel. Binding the NP view to an unpopulated field shows the partner no fuel at all (§3.3). | Live DB, same SELECT as Q6 |
| Q13 | Exactly which speeds / job types are **Path A** (§2.3) — i.e. where an agent rate calculates the headline delivery rate? Steve names nationwide flight delivery portion and local nationwide speed; confirm the full set so Path B is not applied to a Path A job or vice versa. | `DD_stpGetNationwideRates`, `tucJobType.NationwideEntry`, Steve |
| Q10 | *(Largely answered — §2.4 confirms the client-level field `tucClient.CourierPercentage`, not a nationwide-speed row.)* Remaining: do cascade levels 1–3 apply to NP jobs, and is the 40% fallback acceptable for a partner? (§2.6a, §2.6b) | Steve + `sp_helptext` on the trigger |
| Q11 | Does the NP percentage multiply `RawBaseAmount` or `ucjbAmount` (§2.6b)? | Steve / live data |
| Q12 | What signal can gate `tucJob_InsertUpdate_CalculateCourierPayment` so it skips **assignment** but still runs on a **weight / items / cubic** change (§2.6d)? Check `tucJob.Reprice`, `RatedManually`, `CourierPaymentManualOverride` and the existing recalculate triggers before adding anything new. | Live DB `sp_helptext` on the trigger |
| Q9 | On schedule-created jobs, is `UcjbAmount` reliably populated at dispatch time? Mode 2 falls back to **manual entry** when it is missing (§5.6) — a silent fallback is how a wrong number reaches a partner. | Live DB + Send-to-Partner dialog behaviour |

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

1. **Run Q6/Q7 first — one SELECT decides the size of this job.** If the network partner is assigned as `ucjbCourierID`, the existing trigger already implements §2.4 exactly (levels 4 and 5), `CourierPayment` is already correct, and the whole defect is the NP view rendering revenue. If they are attached via `AgentID` only, the trigger never fires and there is a data bug as well. This is the difference between a view fix and a build (§2.5).
2. **Answer Q0 alongside it.** If Golden Black Taxis is a paired DFRNT tenant rather than an in-tenant agent, this is a Pricing Mode setting on the service mapping and none of §2 applies (§5.1).
3. **Ship the display change (§3) regardless of both.** NP dispatch view shows courier amount + total, never job revenue — across *every* NP-facing surface, not just the screen where it was noticed. On the most likely outcome this is the entire fix.
4. **Confirm `CourierFuel` populates on NP assignment before binding the view to it (Q14).** Evidence in `CourierPayCalculationIssues.md` shows it sitting at $0.00 on a job carrying $18.50 of fuel. Showing a partner no fuel is a worse failure than showing them too much — they are less likely to query it (§3.3).
5. **Path A is the only place new calculation code is clearly needed (§2.3).** Where an agent rate prices the delivery — nationwide flight delivery portion, local nationwide speed — stamp that rate into `CourierPayment` at creation rather than back-calculating later. Confirm the exact speed/job-type set first (Q13).
6. **Gate recalculation on what changed, before stamping anything (§2.6d).** A populated `CourierPayment` must survive assignment to a network partner, but must still be recalculated when weight, items or cubic change — usually at pickup. Not a permanent lock: that would hold the partner on a rate that no longer matches the job they carried. Highest-risk item here, and it fails silently in both directions.
7. **Settle §2.6 (a)–(c)** — whether cascade levels 1–3 apply to NP jobs, whether the 40% fallback is acceptable for a partner, and that the percentage multiplies `RawBaseAmount`.
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
