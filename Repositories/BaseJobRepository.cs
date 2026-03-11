using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class BaseJobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseRepository(contextFactory)
{
    protected const string Space = " ";

    private (int? economySpeedId, DateTime? ecoDeliveryTime)? _economyCache;

    protected async Task<JobSearchResult> DespatchQry(
        AppPage page,
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        NationwideWidget? windowPane = null,
        int? selectedClearListId = null
    )
    {
        try
        {
            var query = BuildBaseQuery(selectedViewIds, isUsTenant);
            if (query == null)
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = 0,
                    HasMore = false
                };

            ClearListEnvelopeViewModel clearListEnvelope = null;
            var isNeedsDispatchFilter = false;

            if (selectedClearListId.HasValue)
            {
                Log.Debug("ClearListId {ClearListID} provided. Getting ClearListEnvelope", selectedClearListId);

                var country = isUsTenant ? Country.Us : Country.Nz;
                clearListEnvelope =
                    await clearListEnvelopeService.GetClearListAreaEnvelopeAsync(selectedClearListId.Value, country);

                // Check if the needs-dispatch filter is active
                isNeedsDispatchFilter = queryParams.StatusFilter?.ToLower() == "needs-dispatch";
            }

            query = ApplyGeographicFilters(query, clearListEnvelope, isNeedsDispatchFilter);

            switch (page)
            {
                case AppPage.Dispatch:
                    if (queryParams.DateCutoff.HasValue)
                        query = query.Where(j => j.UcjbDate.Date <= queryParams.DateCutoff.Value);

                    if (queryParams.StartDate.HasValue)
                        query = query.Where(j => j.UcjbDate.Date >= queryParams.StartDate.Value);

                    query = ApplyEndDateFilter(query, queryParams.EndDate, queryParams.UseTime);

                    break;
                case AppPage.Domestic:
                    query = ApplyNationwideSpecificFilters(
                        query,
                        queryParams,
                        isInternal,
                        windowPane ?? NationwideWidget.JobList,
                        clientIds
                    );
                    break;
                case AppPage.JobSearch:
                case AppPage.Prebooks:
                default:
                    return new JobSearchResult
                    {
                        Jobs = [],
                        TotalCount = 0,
                        HasMore = false
                    };
            }

            var allJobs = await query
                .AsNoTracking()
                .AsSplitQuery()
                .Select(JobMappings.JobDispatchMapping(isUsTenant))
                .ToListAsync();


            // Safety-net dedup — DISTINCT is applied in GetFilteredJobIdsQuery, but view joins
            // may still produce duplicates in edge cases.
            allJobs = allJobs
                .GroupBy(j => j.Id)
                .Select(g => g.First())
                .ToList();

            // Populate Children on parent jobs so the frontend can track grouping via _groupChildren.
            // All jobs stay in the flat list � the template renders them as flat rows.
            var parentJobMap = allJobs
                .Where(j => j.IsParentOrSingle && j.ParentId.HasValue && j.ParentId == j.Id)
                .ToDictionary(j => j.Id);

            foreach (var child in allJobs.Where(j => !j.IsParentOrSingle && j.ParentId.HasValue))
            {
                if (parentJobMap.TryGetValue(child.ParentId!.Value, out var parent))
                {
                    parent.Children ??= [];
                    parent.Children.Add(child);
                }
            }

            await EnrichJobsWithCollections(allJobs);

            var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();
            var now = clock.TenantNow;
            foreach (var job in allJobs)
            {
                job.AngularId = Guid.NewGuid();
                job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
            }

            var mapItems = page == AppPage.Dispatch
                ? allJobs.Select(j => new DispatchMapItem
                {
                    JobId = j.Id,
                    JobNo = j.JobNo,
                    PickupAddress = j.PickupAddress,
                    DeliveryAddress = j.DeliveryAddress,
                    AssignedCourier = j.AssignedCourier
                }).ToList()
                : null;

            return new JobSearchResult
            {
                Jobs = allJobs,
                TotalCount = allJobs.Count,
                HasMore = false,
                MapItems = page == AppPage.Dispatch ? mapItems : null
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting jobs for dispatch page with pagination. Please see exception.");
            throw;
        }
    }

    private IQueryable<TucJob> BuildBaseQuery(List<int> selectedViewIds, bool isUsTenant)
    {
        var jobIdsQuery = GetFilteredJobIdsQuery(selectedViewIds, isUsTenant);

        if (!isUsTenant && (selectedViewIds == null || selectedViewIds.Count == 0))
            return Context.TucJobs.Where(j => false);

        var query = from job in Context.TucJobs
            join id in jobIdsQuery on job.UcjbId equals id
            select job;

        return query.TagWith($"BuildBaseQuery - Views: {selectedViewIds?.Count ?? 0}");
    }

    private IQueryable<int> GetFilteredJobIdsQuery(List<int> selectedViewIds, bool isUsTenant)
    {
        if (selectedViewIds == null || selectedViewIds.Count == 0)
        {
            if (!isUsTenant) return Context.TucJobs.Where(j => false).Select(j => j.UcjbId);

            return Context.DeswebQryDespatchJobViewFilters
                .Select(x => x.UcjbId)
                .Distinct();
        }

        var viewFilters = Context.TblDespatchViews
            .Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
            .Select(dv => dv.WhereCondition)
            .ToList();

        if (viewFilters.Count == 0) return Context.TucJobs.Where(j => false).Select(j => j.UcjbId);

        // Validate each filter to prevent SQL injection
        foreach (var filter in viewFilters.Where(filter => !IsValidWhereCondition(filter)))
        {
            Log.Warning("Invalid WhereCondition detected and rejected: {Filter}", filter);
            throw new InvalidOperationException("Invalid filter condition detected in view configuration.");
        }

        // Case 3: Build combined filter
        var combinedFilters = string.Join(" OR ", viewFilters.Select(filter => $"({filter})"));

        return Context.DeswebQryDespatchJobViewFilters
            .FromSqlRaw(
                isUsTenant
                    ? $"SELECT DISTINCT UcjbId FROM DESWEB_qry_Despatch_Job_View_Filters WHERE {combinedFilters}"
                    : $"SELECT DISTINCT UcjbId FROM DESWEB_qryDespatch WHERE {combinedFilters}"
            )
            .Select(x => x.UcjbId);
    }

    /// <summary>
    /// Validates that a WhereCondition from the database doesn't contain SQL injection patterns.
    /// </summary>
    private static bool IsValidWhereCondition(string condition)
    {
        if (string.IsNullOrWhiteSpace(condition))
            return false;

        // Reject dangerous SQL keywords and patterns (case-insensitive)
        // Note: XP_ and SP_ use only leading word boundary to catch prefixed procedures like xp_cmdshell, sp_executesql
        var dangerousPatterns = new[]
        {
            @"\bDROP\b", @"\bDELETE\b", @"\bTRUNCATE\b", @"\bALTER\b", @"\bCREATE\b",
            @"\bINSERT\b", @"\bUPDATE\b", @"\bEXEC\b", @"\bEXECUTE\b", @"\bXP_",
            @"\bSP_", @"\bINTO\b", @"\bUNION\b", @"\bGRANT\b", @"\bREVOKE\b",
            "--", @"/\*", @"\*/", @"\bSHUTDOWN\b", @"\bWAITFOR\b", @"\bDELAY\b",
            @"\bOPENROWSET\b", @"\bOPENQUERY\b", @"\bBULK\b", @"\bDBCC\b"
        };

        return dangerousPatterns.All(pattern => !Regex.IsMatch(condition, pattern, RegexOptions.IgnoreCase));
    }

    private async Task EnrichJobsWithCollections(List<DispatchJobViewModel> jobs)
    {
        if (jobs.Count == 0) return;

        var jobIds = jobs.Select(j => j.Id).ToList();
        var parentIds = jobs.Where(j => j.ParentId.HasValue)
            .Select(j => j.ParentId.Value)
            .Distinct()
            .ToList();

        // Run both queries in parallel using separate contexts (DbContext is not thread-safe)
        await using var relatedJobsContext = CreateNewContext();
        await using var flightsContext = CreateNewContext();

        var relatedJobsTask = parentIds.Count != 0
            ? relatedJobsContext.TucJobs
                .AsNoTracking()
                .Where(j => parentIds.Contains(j.ParentId.Value))
                .GroupBy(j => j.ParentId.Value)
                .Select(g => new
                {
                    ParentId = g.Key,
                    RelatedJobs = g.Select(j => new Suggestion { Id = j.UcjbId, Text = j.UcjbNumber }).ToList()
                })
                .ToDictionaryAsync(x => x.ParentId, x => x.RelatedJobs)
            : Task.FromResult(new Dictionary<int, List<Suggestion>>());

        var flightsTask = flightsContext.TucJobNationwides
            .AsNoTracking()
            .Where(nw => nw.UcnwJobId.HasValue && jobIds.Contains(nw.UcnwJobId.Value))
            .Select(nw => new { nw.UcnwJobId, nw.UcnwFlightNo })
            .GroupBy(x => x.UcnwJobId)
            .ToDictionaryAsync(g => g.Key, g => new AssignedFlight { FlightNumber = g.First().UcnwFlightNo });

        await Task.WhenAll(relatedJobsTask, flightsTask);

        var relatedJobsDict = await relatedJobsTask;
        var flightsDict = await flightsTask;

        // Apply related jobs
        foreach (var job in jobs.Where(j => j.ParentId.HasValue))
            if (job.ParentId != null && relatedJobsDict.TryGetValue(job.ParentId.Value, out var related))
                job.RelatedJobs = related;

        // Apply flights
        foreach (var job in jobs)
            if (flightsDict.TryGetValue(job.Id, out var flight))
                job.AssignedFlight = flight;
    }


    private static IQueryable<TucJob> ApplyGeographicFilters(
        IQueryable<TucJob> query,
        ClearListEnvelopeViewModel clearListEnvelope,
        bool pickupOnlyFilter = false
    )
    {
        if (clearListEnvelope == null) return query;

        if (pickupOnlyFilter)
        {
            // Filter by pickup location only (jobs FROM this area) - for needs-dispatch
            return query.Where(j =>
                j.PickUpLatitude >= clearListEnvelope.MinimumLatitude
                && j.PickUpLatitude <= clearListEnvelope.MaximumLatitude
                && j.PickUpLongitude >= clearListEnvelope.MinimumLongitude
                && j.PickUpLongitude <= clearListEnvelope.MaximumLongitude
            );
        }

        // Filter by pickup OR delivery location (jobs FROM or TO this area) - for all other categories
        return query.Where(j =>
            // Either pickup is within the envelope
            (j.PickUpLatitude >= clearListEnvelope.MinimumLatitude
             && j.PickUpLatitude <= clearListEnvelope.MaximumLatitude
             && j.PickUpLongitude >= clearListEnvelope.MinimumLongitude
             && j.PickUpLongitude <= clearListEnvelope.MaximumLongitude)
            ||
            // Or delivery is within the envelope
            (j.DeliveryLatitude >= clearListEnvelope.MinimumLatitude
             && j.DeliveryLatitude <= clearListEnvelope.MaximumLatitude
             && j.DeliveryLongitude >= clearListEnvelope.MinimumLongitude
             && j.DeliveryLongitude <= clearListEnvelope.MaximumLongitude)
        );
    }

    private static IQueryable<TucJob> ApplyNationwideSpecificFilters(
        IQueryable<TucJob> query,
        JobQueryParams queryParams,
        bool isInternal,
        NationwideWidget windowPane,
        string clientIds
    )
    {
        query = query.Where(j => j.ParentId != j.UcjbId && !j.InverseParent.Any());

        // Filter dates
        if (queryParams.StartDate != null)
            query = query.Where(j => j.UcjbDate.Date >= queryParams.StartDate.Value.Date);
        if (queryParams.DateCutoff != null)
            query = query.Where(j => j.UcjbDate.Date <= queryParams.DateCutoff.Value.Date);

        query = ApplyEndDateFilter(query, queryParams.DateCutoff, queryParams.UseTime);

        // Apply window pane viewFilters
        query = windowPane switch
        {
            NationwideWidget.JobList => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.NewJobs
            ),
            NationwideWidget.Pod => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.AwaitingPod || j.UcjbStatus == (int)JobStatus.AwaitingPod
            ),
            NationwideWidget.ActionRequired => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.ActionRequired
            ),
            NationwideWidget.Reprice => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.Reprice || j.Reprice == true
            ),
            _ => query
        };

        // Block out completed jobs from the domestic/nationwide page
        query = query.Where(j => !j.UcjbComplTime.HasValue);

        // Apply client viewFilters for non-internal users
        if (isInternal || string.IsNullOrEmpty(clientIds)) return query;

        var clientIdList = clientIds.Split(',')
            .Select(id => int.TryParse(id.Trim(), out var parsed) ? parsed : (int?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .ToList();
        query = query.Where(j => clientIdList.Contains((int)j.UcjbClientId));

        return query;
    }

    private static IQueryable<TucJob> ApplyEndDateFilter(
        IQueryable<TucJob> query,
        DateTimeOffset? endDate,
        bool useTime)
    {
        if (!endDate.HasValue)
            return query;

        if (!useTime) return query.Where(j => j.UcjbDate.Date <= endDate.Value.Date);

        // Compare full datetime by checking date first, then time
        var filterDate = endDate.Value.Date;
        var filterTime = endDate.Value.TimeOfDay;

        return query.Where(j =>
            j.UcjbDate.Date < filterDate ||
            (j.UcjbDate.Date == filterDate &&
             (!j.UcjbTime.HasValue || j.UcjbTime.Value.TimeOfDay <= filterTime)));
    }

    protected async Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(List<int> selectedViewIds)
    {
        try
        {
            var isUsCustomer = infoService.IsUsTenant();
            var jobIdsQuery = GetFilteredJobIdsQuery(selectedViewIds, isUsCustomer);

            var jobCoordinates = await (
                    from job in Context.TucJobs
                    join id in jobIdsQuery on job.UcjbId equals id
                    where job.UcjbStatus != (int)JobStatus.AwaitingPod
                    select new JobCoordinateModel
                    {
                        Id = job.UcjbId,
                        JobNo = job.UcjbNumber,
                        PickupLatitude = job.PickUpLatitude,
                        PickupLongitude = job.PickUpLongitude,
                        DeliveryLatitude = job.DeliveryLatitude,
                        DeliveryLongitude = job.DeliveryLongitude,
                        StatusId = job.UcjbStatus,
                        StatusName = job.UcjbStatusNavigation.UcjsName,
                        ClientId = job.UcjbClientId ?? 0,
                        ClientName = job.UcjbClient.UcclName,
                        Speed = job.UcjbSpeedNavigation.ShortName,
                        FromAddress = job.UcjbFromAddr,
                        ToAddress = job.UcjbToAddr
                    })
                .AsNoTracking()
                .ToListAsync();

            return jobCoordinates;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(GetJobCoordinatesAsync)));
            throw;
        }
    }

    protected async Task SaveMultipleBulkNotesAsync(List<int> bulkJobIds, string noteText, bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.ConfirmNoteTypeExistsAsync(noteType);
        if (!noteTypeExists) noteType = NoteType.InternalNote;

        var staffId = infoService.GetStaffId();
        var currentTime = clock.TenantNow;

        var newNotes = bulkJobIds.Select(bulkJobId => new TblBulkJobNote
                { BulkJobId = bulkJobId, IsImportant = isImportant, NoteText = noteText, NoteTypeId = (int)noteType,
                  CreatedBy = staffId, CreatedDate = currentTime })
            .ToList();

        await Context.TblBulkJobNotes.AddRangeAsync(newNotes);
        await Context.SaveChangesAsync();
    }

    private async Task<NoteType> ConfirmNoteTypeExists(NoteType noteType)
    {
        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.ConfirmNoteTypeExistsAsync(noteType);
        if (!noteTypeExists) noteType = NoteType.InternalNote;
        return noteType;
    }

    protected async Task SaveNoteToMultipleJobsAsync(List<int> jobIds, string noteText, bool isImportant = false,
        bool isRecurringJobs = false, NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

            // If a note type is not found, default to the internal note
            noteType = await ConfirmNoteTypeExists(noteType);

            var now = clock.TenantNow;
            
            var newNotes = jobIds.Select(jobId => new TucNote
                {
                    JobId = isRecurringJobs ? null : jobId,
                    JobBookingId = isRecurringJobs ? jobId : null,
                    NoteText = noteText,
                    IsImportant = isImportant,
                    NoteTypeId = (int)noteType,
                    CreatedDate = now
                })
                .ToList();

            await Context.TucNotes.AddRangeAsync(newNotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository), nameof(SaveNoteAsync)));
        }
    }

    protected async Task SaveNoteToMultipleArchivedJobsAsync(
        List<int> jobIds,
        string noteText,
        bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

            // If a note type is not found, default to the internal note
            noteType = await ConfirmNoteTypeExists(noteType);

            var now = clock.TenantNow;

            var newNotes = jobIds.Select(jobId => new TucNoteArchive
                {
                    JobId = jobId,
                    NoteText = noteText,
                    IsImportant = isImportant,
                    NoteTypeId = (int)noteType,
                    CreatedDate = now
                })
                .ToList();

            await Context.TucNoteArchives.AddRangeAsync(newNotes);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository), nameof(SaveNoteToMultipleArchivedJobsAsync)));
        }
    }

    protected async Task SaveNoteAsync(int jobId, string noteText, bool isImportant = false,
        bool isRecurringJob = false, NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

            // If a note type is not found, default to the internal note
            noteType = await ConfirmNoteTypeExists(noteType);

            var now = clock.TenantNow;

            var newNote = new TucNote
            {
                JobId = isRecurringJob ? null : jobId,
                JobBookingId = isRecurringJob ? jobId : null,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedDate = now
            };

            await Context.TucNotes.AddAsync(newNote);
            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository), nameof(SaveNoteAsync)));
        }
    }

    // Helper Methods
    protected async Task<bool> IsJobArchived(int jobId) => await Context.IsJobArchivedAsync(jobId);

    protected static string GetTrackingName(int trackingMethodId) =>
        trackingMethodId switch
        {
            1 => "Email",
            2 => "Mobile",
            3 => "Email & Mobile",
            _ => string.Empty
        };

    protected static double? CalculateRemainTime(DispatchJobViewModel job, DateTime currentTenantTime,
        int? economySpeedId, DateTime? ecoDeliveryTime)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(job);
            if (!job.Booked.HasValue) throw new ArgumentException("Booked date is required.", nameof(job));

            var jobDateTime = job.Booked.Value;

            if (job.SpeedId == economySpeedId)
            {
                if (!job.Booked.HasValue) throw new ArgumentException("Booked date is required.", nameof(job));
                if (!ecoDeliveryTime.HasValue) throw new ArgumentNullException(nameof(ecoDeliveryTime));

                var targetDateTime = new DateTime(
                    job.Booked.Value.Year,
                    job.Booked.Value.Month,
                    job.Booked.Value.Day,
                    ecoDeliveryTime.Value.Hour,
                    ecoDeliveryTime.Value.Minute,
                    ecoDeliveryTime.Value.Second
                );

                return Math.Round((targetDateTime - currentTenantTime).TotalMinutes);
            }

            if (!job.JobTypeMins.HasValue) return null;

            var minutesToAdd = job.JobTypeMins.Value;
            var standardDeliveryDateTime = jobDateTime.AddMinutes(minutesToAdd);
            return Math.Round((standardDeliveryDateTime - currentTenantTime).TotalMinutes);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(CalculateRemainTime)));
            throw;
        }
    }

    protected async Task<int> CreateNewRecurringJobNote(int jobId, string noteText, bool isImportant,
        NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            // Always create a note on the parent job (or self if no parent)
            var effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(jobId);

            noteType = await ConfirmNoteTypeExists(noteType);
            var newNote = new TucNote
            {
                JobBookingId = effectiveJobId,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedBy = infoService.GetStaffId(),
                CreatedDate = clock.TenantNow
            };
            await Context.AddAsync(newNote);
            await Context.SaveChangesAsync();

            return newNote.NoteId;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository),
                    nameof(CreateNewRecurringJobNote)));
            throw;
        }
    }

    protected async Task UpdateRecurringJobNote(int noteId, string noteText, bool isImportant,
        NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            var staffId = infoService.GetStaffId();
            var currentTime = clock.TenantNow;

            // Fetch current state for history before updating
            var currentNote = await Context.TucNotes
                .AsNoTracking()
                .Where(c => c.NoteId == noteId)
                .Select(c => new { c.NoteText, c.NoteTypeId, c.IsImportant })
                .FirstOrDefaultAsync();

            if (currentNote != null)
            {
                var history = new TucNoteHistory
                {
                    NoteId = noteId,
                    EditedBy = staffId,
                    EditedAt = DateTime.UtcNow,
                    OldNoteText = currentNote.NoteText,
                    NewNoteText = noteText,
                    OldNoteTypeId = currentNote.NoteTypeId,
                    NewNoteTypeId = (int)noteType,
                    OldIsImportant = currentNote.IsImportant,
                    NewIsImportant = isImportant
                };
                await Context.TucNoteHistories.AddAsync(history);
                await Context.SaveChangesAsync();
            }

            var rowsAffected = await Context.TucNotes
                .Where(c => c.NoteId == noteId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(e => e.NoteText, noteText)
                    .SetProperty(e => e.NoteTypeId, (int)noteType)
                    .SetProperty(e => e.IsImportant, isImportant)
                    .SetProperty(e => e.UpdatedBy, staffId)
                    .SetProperty(e => e.UpdatedDate, currentTime)
                );

            if (rowsAffected == 0) throw new Exception($"Existing note under {noteId} not found");
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository),
                    nameof(CreateNewRecurringJobNote)));
            throw;
        }
    }

    protected async Task<(int? economySpeedId, DateTime? ecoDeliveryTime)> GetEconomySpeedAndDeliveryTimeAsync()
    {
        if (_economyCache.HasValue)
            return _economyCache.Value;

        // Run both queries in parallel using separate contexts (DbContext is not thread-safe)
        await using var economyContext = CreateNewContext();
        await using var deliveryTimeContext = CreateNewContext();

        var economySpeedTask = economyContext.GetEconomySpeedIdAsync();
        var ecoDeliveryTimeTask = deliveryTimeContext.GetEcoDeliveryTimeAsync();

        await Task.WhenAll(economySpeedTask, ecoDeliveryTimeTask);

        _economyCache = (await economySpeedTask, await ecoDeliveryTimeTask);
        return _economyCache.Value;
    }

    protected static void UpdateNoteDate(List<TucNoteViewModel> notes, string tenantTimeZone)
    {
        foreach (var note in notes) UpdateNoteDate(note, tenantTimeZone);
    }

    private static void UpdateNoteDate(TucNoteViewModel note, string tenantTimeZone)
    {
        note.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.CreatedDate, tenantTimeZone);
        if (note.UpdatedDate.HasValue)
            note.UpdatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.UpdatedDate.Value, tenantTimeZone);
    }

    protected async Task<List<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived, bool isBulkJob = false)
    {
        if (isBulkJob)
        {
            // Get parent bulk job ID (self if parent, or BulkParentId if child)
            var parentBulkJobId = await Context.TblBulkJobs
                .AsNoTracking()
                .Where(j => j.BulkJobId == jobId)
                .Select(j => j.BulkParentId ?? j.BulkJobId)
                .FirstOrDefaultAsync();

            if (parentBulkJobId == 0) return [];

            return await Context.TblBulkJobs
                .AsNoTracking()
                .Where(j => j.BulkJobId == parentBulkJobId || j.BulkParentId == parentBulkJobId)
                .Select(j => new MultiSuggestion
                {
                    Id = j.BulkJobId,
                    Text = j.JobNumber,
                    Selected = j.BulkJobId == jobId,
                    IsBulkJob = true
                })
                .TagWith($"GetRelatedJobs - Bulk Family for Job {jobId}")
                .ToListAsync();
        }

        if (isArchived)
        {
            // First, get the parent ID for this job (if it has one)
            var effectiveArchiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);

            var archivedData = await Context.TucJobArchives
                .AsNoTracking()
                .Where(j => j.UcjbId == effectiveArchiveJobId || j.ParentId == effectiveArchiveJobId)
                .Select(j => new MultiSuggestion
                {
                    Id = j.UcjbId,
                    Text = j.UcjbNumber,
                    Selected = j.UcjbId == jobId,
                    IsArchived = true
                })
                .TagWith($"GetRelatedJobs - Archived Family for Job {jobId}")
                .ToListAsync();

            return archivedData;
        }

        // Live job from TucJob
        var effectiveLiveJobId = await Context.GetEffectiveJobIdAsync(jobId);

        var liveData = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == effectiveLiveJobId || j.ParentId == effectiveLiveJobId)
            .Select(j => new MultiSuggestion
            {
                Id = j.UcjbId,
                Text = j.UcjbNumber,
                Selected = j.UcjbId == jobId
            })
            .TagWith($"GetRelatedJobs - Live Family {effectiveLiveJobId}")
            .ToListAsync();

        return liveData;
    }

    protected async Task<int?> GetJobParentIdAsync(int jobId) =>
        await Context.GetJobParentIdAsync(jobId);

    /// <summary>
    /// Gets current amounts for a list of jobs for bulk price preview/comparison.
    /// </summary>
    protected async Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(List<int> jobIds)
    {
        // Check live jobs
        var liveJobs = await Context.TucJobs
            .AsNoTracking()
            .Where(j => jobIds.Contains(j.UcjbId))
            .Select(j => new JobCurrentAmountInfo
            {
                JobId = j.UcjbId,
                JobNo = j.UcjbNumber,
                Amount = j.UcjbAmount ?? 0,
                RawBaseAmount = j.RawBaseAmount ?? 0,
                Fuel = j.FuelSurchargeAmount,
                Ppd = j.Ppdamount ?? 0,
                CourierPayment = j.CourierPayment ?? 0,
                CourierFuel = j.CourierFuel ?? 0,
                CourierBonus = j.CourierBonus ?? 0,
                IsPrebook = false
            })
            .ToListAsync();

        return liveJobs.ToDictionary(j => j.JobId);
    }
}