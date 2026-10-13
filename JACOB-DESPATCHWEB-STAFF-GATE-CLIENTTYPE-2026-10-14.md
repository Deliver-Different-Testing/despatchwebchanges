# DespatchWeb hotfix: staff is ClientTypeId 4/5, not the StaffID claim

**Owner:** Jacob · **Requested by:** Steve, 14 Oct 2026 · **Priority:** hotfix (OTG dispatchers blocked)
**Repo:** `gitlab.com/deliver-different/despatchweb` (GitHub mirror `Deliver-Different-Testing/despatchwebchanges`) · **Baseline:** `main` as of 12 Oct 2026 mirror sync (`5bd2b896`, last code change 6 Oct)

---

## 1. What is broken

Dany Denho (OTG dispatcher) emailed 14 Oct: Richard and Kyle cannot restore jobs or edit pricing in Dispatch. Dane confirmed in Settings that all OTG users are set up identically (OTG Cargo client, "OTG Admin" role, full Dispatch action rights).

Garry's query on `otgcargo` prod (14 Oct) shows the only difference:

| Contact (ucctID) | Created | Created in | `tucClientContact.StaffID` |
|---|---|---|---|
| Richard Reid (368) | 25 Sep 2026 | Settings | NULL |
| Kyle Z (363) | 10 Aug 2026 | Settings | NULL |
| Dany, Donna, Victor, Dylan, Michaela, Tim | Sep 2024 | AdminManager | 14–20 |
| Isaiah, Nate, Mike | Oct 2024 – Sep 2025 | AdminManager | 208–217 |

OTG Cargo is `ClientTypeId = 5` (DF Admin), `ucclInternal = 1`. Kyle predates the 12 Oct permissions release by two months, so that release is not the cause.

## 2. Root cause

DespatchWeb decides **what a user can see** from the Hub `ClientTypeId` claim (`Models/ScopeContext.cs`, `Services/ScopeProvider.cs`, June 2026), but still decides **whether a user is staff for writes** from the Hub `StaffID` claim, which Hub stamps from `tucClientContact.StaffID` (hub `Controllers/AccountController.cs` `BuildStaffClaimsInput`).

- `Services/TenantInfoService.cs:186-190` — `GetStaffId()` returns 0 when the claim is empty.
- `Services/PricingPermissionService.cs:56-62` and `:103-109` — `ValidateJobAccessAsync` / `ValidateJobsAccessAsync`: `if (staffId > 0) return;` otherwise the caller is treated as a customer contact and limited to clients returned by `ClientRepository.ClientContactsAsync(contactId)` (tblClientContact rows with a DespatchWeb internet permission). For Richard and Kyle that set is OTG Cargo's own jobs at best, so every price edit on a real customer's job throws `UnauthorizedAccessException("Access denied to job N")`. Nine `JobController` endpoints call these two methods (lines 264, 320, 368, 415, 1691, 2905, 2933, 2963, 3013).
- Audit writers call `GetStaffId()` and write **0**, not NULL, into nullable columns that carry a foreign key to `tucStaff`: `BaseJobRepository.cs` (`SaveNoteAsync`, `SaveNoteToMultipleJobsAsync`, `SaveNoteToMultipleArchivedJobsAsync`, bulk notes), `JobRepository.EditOperations.cs:1364` `JobUpdateAddNoteAsync`, `JobRepository.cs:1768` and `:2147` read trackers, `JobRepository.cs:6383` bulk task close. `FK_Note_CreatedBy` is a real constraint (`EntityClasses/DespatchContext.cs:7569`), so any job edit that adds a note fails for a user with no staff row. This is the likely "cannot update jobs" symptom.
- `JobRepository.cs:1680` quick-add: `GetStaffInfoAsync() ?? throw` — no staff row, no quick-add.

`tucClientContact.StaffID` does not mean "this person is staff". AdminManager treats it as the contact's **account manager** and defaults it to the editing user's own staff id (`adminmanager` `ContactService.cs:202`, `ClientController.cs:124`; see configurator `docs/GARRY-ACCESS-CONTROL-NAME-ALIGNMENT-2026-09-28.md` §G6-Q). Legacy OTG users work because Ralph created them in AdminManager in 2024 with real staff rows. Settings (`AdminContactService.CreateAsync`) sets `StaffId = null` by design and has no way to set it.

Restore (`JobController.RestoreJobs` → `JobRepository.RestoreJobsCoreAsync`) has **no** staff gate and writes no staff id. See §6 on how to pin that symptom down.

## 3. Decision (Steve, 8 Oct and 14 Oct 2026)

- Staff in DespatchWeb = `ClientTypeId` 4 (Tenant) or 5 (DF Admin), read from `IScopeProvider`. Never the `StaffID` claim, never `ucclInternal`, never ClientType 1.
- No tenant user needs a `tucStaff` row to use Dispatch. Settings will **not** grow a StaffID field, and we are not patching data on OTG prod; the code gets fixed instead.
- The `StaffID` claim stays in the Hub cookie for now (removal is Phase D of `PERMISSIONS-UNIFIED-ARCHITECTURE-SPEC-2026-06-04.md`). DespatchWeb simply stops using it as a permission signal and tolerates its absence everywhere it writes an actor.

## 4. Change set

### A. Pricing gate (the fix Dany is waiting on)

`Services/PricingPermissionService.cs` already receives `IScopeProvider scopeProvider`.

```csharp
/// Tenant (4) and DF Admin (5) are staff for every write in this service.
/// StaffID is an AdminManager account-manager link, not a staff signal.
private bool CallerIsStaff =>
    scopeProvider.Scope is { } s && (s.IsTenant || s.IsDfAdmin);
```

In `ValidateJobAccessAsync` and `ValidateJobsAccessAsync` replace

```csharp
var staffId = tenantInfoService.GetStaffId();
if (staffId > 0) { return; }            // ValidateJobsAccessAsync: return [];
```

with

```csharp
if (CallerIsStaff) { return; }          // ValidateJobsAccessAsync: return [];
```

Everything below that line (contact id, `GetAccessibleClientIdsAsync`, `TblJobs` check) is unchanged; it is now the Customer (2) and Network Partner (3) path only. `CanModifyPricesAsync`, `CanModifyPriceBreakdownAsync`, `CanExportPricingAsync` keep their network-partner check.

Behaviour change to be aware of: a **Customer (2)** contact whose `StaffID` happens to point at an account manager was previously treated as staff and could price any job. After this change they are scoped to their own clients. That is the intended outcome of the 8 Oct decision, not a regression.

### B. Audit writers: write NULL, not 0, when there is no staff row

Mechanical. Every column below is `int?` with an FK to `tucStaff`.

| File | Line(s) | Change |
|---|---|---|
| `Repositories/BaseJobRepository.cs` | 779, 819, 856, 888 | `infoService.GetStaffId()` → `infoService.GetStaffIdOrNull()` for `CreatedBy` / `UpdatedBy` on `TblBulkJobNote`, `TucNote`, `TucNoteArchive` |
| `Repositories/JobRepository.EditOperations.cs` | 1366 | same, `JobUpdateAddNoteAsync` |
| `Repositories/JobRepository.cs` | 1768, 2147, 6423 | `ReadByStaffId` → `GetStaffIdOrNull()`; the `MERGE` at 2147 must write `NULL` |
| `Repositories/JobRepository.cs` | 6383 | `CloseAllBulkJobTasksAsync`: `ClosedByName` lookup already returns null for an unknown id; switch the variable to `GetStaffIdOrNull()` so intent is clear |
| `Repositories/NoteRepository.cs` | 112, 143 | check for the same pattern; same change if the column is nullable |

`JobRepository.cs:2464` (delivery journey) already does this correctly with `GetStaffIdOrNull()` and `DeliveryJourneyUpdatedBy.TypeForStaffId`. Use it as the model.

Do **not** change `JobRepository.cs:6653-6659` (`UcjbDispId = dispatcherStaffId > 0 ? dispatcherStaffId : null`); it already handles 0.

### C. Quick-add job (`JobRepository.cs:1678-1690`)

`GetStaffInfoAsync()` returns null with no staff row and the method throws. Replace the actor resolution with: staff info if present, otherwise the signed-in contact's name from `tucClientContact` (the `ValidateClientAsync` lookup in `HomeController` already returns `FullName`). `BookedBy` becomes that name; `LoggedInContactId` becomes the contact id.

**To confirm before changing:** what `NET_stpJob_Insert_JobNumber` does with its `staffId` parameter (`GenerateJobNumberAsync`). If it only logs it, pass `0`/`NULL`; if it joins `tucStaff`, this part moves to a follow-up and A + B ship alone. Do not hold the hotfix on C.

### D. Job list client filter (`Controllers/JobController.cs:155-175`, `GetJobsByClearListEnvelope`)

Two defects in one line: `ValidateClientAccessAsync(staffId, clientIds)` passes a **staff id** where `ClientAccessValidatorService` expects a **contact id**, and the gate is driven by `isInternal` (`window.ClientInternal`, i.e. `ucclInternal`), which the 8 Oct decision retires as a permission signal. Change to:

```csharp
if (scopeProvider.Scope?.IsCustomerScoped == true)
{
    await clientAccessValidator.ValidateClientAccessAsync(infoService.GetContactId(), clientIds);
}
```

(`JobController` needs `IScopeProvider` injected; it is a scoped service registered already.) `Index` (lines 54-71) and `GetAllJobCoordinates` (113-127) have the same `isInternal` gate but pass `cid` from the query string, i.e. a client-supplied contact id. Switch them to the same scope check and `infoService.GetContactId()` so the server, not the browser, decides. Low risk, same MR.

### E. Not in this MR

- Settings/configurator: no change. Settings keeps creating contacts with `StaffId = null`.
- Hub: no change to claims.
- Removing the `StaffID` claim and `tucStaff` bridge from AdminManager: Phase D of the unified permissions spec.
- `TenantInfoService.GetStaffInfoAsync` consumers in messaging (`ContactID` global in `Views/Home/Index.cshtml:13` is `StaffID ?? contactId`) and `MessageRepository`: leave; a null staff id there degrades to "no staff messaging", which is acceptable for now. Note it in the MR.

## 5. Tests

`DespatchWeb.Tests/Services/PricingPermissionServiceTests.cs` already substitutes `IScopeProvider`. Add:

1. `ValidateJobAccessAsync_TenantWithNoStaffId_Allowed` — `Scope = new ScopeContext(4, clientId, null)`, `GetStaffId()` returns 0 → no throw, `ClientContactsAsync` never called.
2. Same for ClientTypeId 5.
3. `ValidateJobAccessAsync_CustomerWithStaffId_ScopedToOwnClients` — `Scope = new ScopeContext(2, …)`, `GetStaffId()` returns 15 → still goes through `ClientContactsAsync` and throws "Access denied" for a foreign job. Guards the behaviour change in A.
4. `ValidateJobsAccessAsync` mirrors of 1 and 3.
5. One repository test for B: a note written with no staff id persists `CreatedBy = NULL` (SQLite harness in `SqliteTestDatabase`).

Remove or rewrite any existing test that asserts "StaffID > 0 means staff".

## 6. Verification on OTG staging, then prod

1. Pre-merge data check, per prod tenant, so A cannot lock anyone out (Garry, read-only):
   ```sql
   SELECT cl.ucclName, cl.ClientTypeId, cl.ucclInternal, c.ucctEmail, c.StaffID
   FROM tucClientContact c JOIN tucClient cl ON cl.ucclID = c.ucctClientID
   WHERE c.Active = 1 AND c.StaffID IS NOT NULL AND cl.ClientTypeId NOT IN (4,5)
   ORDER BY cl.ClientTypeId, cl.ucclName;
   ```
   Anyone listed is a staff-by-StaffID user on a non-staff client. Urgent's ops logins were already moved to Tenant clients on 12 Oct for Routed Ops; this confirms nothing is left. If a real staff member appears, move their contact to a ClientTypeId 4 client before release; do not add StaffIDs.
2. On OTG staging sign in as a contact with `StaffID = NULL` on OTG Cargo (create one in Settings if the staging copy has none). Open a job for a customer other than OTG Cargo and: change the price, add a price breakdown line, change the courier (writes a note), mark read/unread, quick-add a job. All must succeed with no "Access denied" and no SQL error.
3. Sign in as a Customer (2) contact on staging: price edit on another customer's job must still be refused.
4. Restore: reproduce it first, before writing code. Sign in as Kyle (ucctID 363, `StaffID = NULL`) on OTG prod via impersonation and attempt the restore on a completed test job, with the browser network tab open; capture the failing request and the response body. The code has no restore gate, so expect the failure to be the note write in B or the dispatch-then-restore flow in `useJobUpdate.ts:324`. Record what you saw in the MR. After A + B, repeat the same steps as Kyle on staging; if it still fails, that is a new finding, not this fix.
5. Release as hotfix: MR to `develop`, then `develop` → `master`, and check the master pipeline actually runs (the 6 Oct `[skip ci]` push left prod on an old image for five days). No migration, no data repair, no re-login needed; claims are unchanged.

## 7. Rollback

Revert the MR. No schema or data change.

## 8. Message for the tenant once live

"Dispatch no longer needs a staff record behind a user. Anyone on a Tenant or DF Admin client with Dispatch rights can edit pricing and update jobs. Richard and Kyle are unblocked without any change to their accounts."
