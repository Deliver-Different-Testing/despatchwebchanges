using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
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

            await EnrichJobsWithCollections(allJobs);

            var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();
            var now = infoService.GetCurrentTenantTime();
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

        // Use JOIN instead of Contains - much more efficient!
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
                .Select(x => x.UcjbId);
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
                    ? $"SELECT UcjbId FROM DESWEB_qry_Despatch_Job_View_Filters WHERE {combinedFilters}"
                    : $"SELECT UcjbId FROM DESWEB_qryDespatch WHERE {combinedFilters}"
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

    public async Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(List<int> selectedViewIds)
    {
        try
        {
            var isUsCustomer = infoService.IsUsTenant();
            var jobIdsQuery = GetFilteredJobIdsQuery(selectedViewIds, isUsCustomer);

            // Use JOIN instead of Contains
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

    public async Task<List<TucNoteViewModel>> GetBulkJobNotesByBulkJobIdAsync(int bulkJobId)
    {
        var bulkNotes = await Context.TblBulkJobNotes
            .AsNoTracking()
            .AsSplitQuery()
            .Where(n => n.BulkJobId == bulkJobId)
            .OrderByDescending(n => n.CreatedDate)
            .Select(n => new TucNoteViewModel
            {
                NoteId = n.NoteId,
                NoteTypeId = n.NoteTypeId,
                NoteTypeName = n.NoteType != null ? n.NoteType.NoteTypeName : string.Empty,
                BulkJobId = n.BulkJobId,
                JobNumber = n.BulkJob != null ? n.BulkJob.JobNumber : string.Empty,
                NoteText = n.NoteText,
                IsImportant = n.IsImportant,
                CreatedDate = n.CreatedDate,
                CreatedByName = n.CreatedBy.HasValue && n.CreatedByNavigation != null
                    ? FormatName(n.CreatedByNavigation.UcstFirstName, n.CreatedByNavigation.UcstLastName)
                    : string.Empty,
                UpdatedDate = n.UpdatedDate,
                UpdatedBy = n.UpdatedBy,
                UpdatedByName = n.UpdatedBy.HasValue && n.UpdatedByNavigation != null
                    ? FormatName(n.UpdatedByNavigation.UcstFirstName, n.UpdatedByNavigation.UcstLastName)
                    : string.Empty
            })
            .ToListAsync();

        return bulkNotes;
    }

    private static string FormatName(string firstName, string lastName) => string.Concat(firstName, " ", lastName);

    public async Task<List<TucNoteViewModel>> GetNotesByJobIdAsync(int jobId) =>
        await IsJobArchived(jobId)
            ? await GetArchivedNotesByJobIdAsync(jobId)
            : await GetActiveNotesByJobIdAsync(jobId);

    public async Task<TucNoteViewModel> GetNoteByIdAsync(int noteId)
    {
        await using var activeContext = CreateNewContext();
        await using var archivedContext = CreateNewContext();

        var tenantTimeZone = infoService.GetTenantTimeZone();

        var activeTask = activeContext.GetActiveNotesByNoteIdAsync(noteId);
        var archivedTask = CreateArchivedNoteQuery(archivedContext)
            .Where(note => note.NoteId == noteId)
            .FirstOrDefaultAsync();

        await Task.WhenAll(activeTask, archivedTask);

        var activeNote = await activeTask;
        var archivedNote = await archivedTask;

        var result = activeNote ?? archivedNote;
        if (result != null)
            UpdateNoteDate(result, tenantTimeZone);

        return result;
    }

    public async Task SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        if (!viewModel.JobId.HasValue) throw new ArgumentNullException(nameof(viewModel.JobId));

        var staffId = infoService.GetStaffId();
        var currentTime = infoService.GetCurrentTenantTime();

        if (viewModel.NoteId == 0)
            await CreateNoteAsync(viewModel, staffId, currentTime, cancellationToken);
        else
            await UpdateNoteAsync(viewModel, staffId, currentTime, cancellationToken);
    }

    public async Task SaveBulkNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        if (!viewModel.BulkJobId.HasValue) throw new ArgumentNullException(nameof(viewModel.BulkJobId));

        ArgumentException.ThrowIfNullOrWhiteSpace(viewModel.NoteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == viewModel.NoteTypeId,
            cancellationToken: cancellationToken);
        if (!noteTypeExists) viewModel.NoteTypeId = (int)NoteType.InternalNote;

        var newNote = new TblBulkJobNote
        {
            BulkJobId = viewModel.BulkJobId.Value,
            IsImportant = viewModel.IsImportant,
            NoteText = viewModel.NoteText,
            NoteTypeId = viewModel.NoteTypeId
        };

        await Context.TblBulkJobNotes.AddAsync(newNote, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);
    }

    protected async Task SaveMultipleBulkNotesAsync(List<int> bulkJobIds, string noteText, bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.ConfirmNoteTypeExistsAsync(noteType);
        if (!noteTypeExists) noteType = NoteType.InternalNote;

        var newNotes = bulkJobIds.Select(bulkJobId => new TblBulkJobNote
                { BulkJobId = bulkJobId, IsImportant = isImportant, NoteText = noteText, NoteTypeId = (int)noteType })
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

            var now = infoService.GetCurrentTenantTime();
            
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

            var now = infoService.GetCurrentTenantTime();

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
            var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == (int)noteType);
            if (!noteTypeExists) noteType = NoteType.InternalNote;

            var now = infoService.GetCurrentTenantTime();
            
            var viewModel = new TucNoteViewModel
            {
                JobId = isRecurringJob ? null : jobId,
                JobBookingId = isRecurringJob ? jobId : null,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedDate = now
            };

            await SaveNoteAsync(viewModel);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository), nameof(SaveNoteAsync)));
        }
    }

    public async Task DeleteNoteAsync(int noteId, CancellationToken cancellationToken = default) =>
        await Context.TucNotes
            .Where(note => note.NoteId == noteId)
            .ExecuteDeleteAsync(cancellationToken);

    // Helper Methods
    public async Task<bool> IsJobArchived(int jobId) => await Context.IsJobArchivedAsync(jobId);

    private async Task<int> GetEffectiveJobId(int jobId, bool isArchived)
    {
        if (isArchived)
            return await Context.GetEffectiveArchiveJobIdAsync(jobId);

        return await Context.GetEffectiveJobIdAsync(jobId);
    }

    // Note Create/Update Operations
    private async Task CreateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value) &&
                         !viewModel.JobBookingId.HasValue;
        if (isArchived)
        {
            var archivedNote = viewModel.ToArchivedEntity();
            archivedNote.CreatedDate = currentTime;
            archivedNote.CreatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            await Context.TucNoteArchives.AddAsync(archivedNote, cancellationToken);
            await Context.SaveChangesAsync(cancellationToken);

            // Also update UcjbNotes so the note syncs to the device
            await Context.TucJobArchives
                .Where(j => j.UcjbId == viewModel.JobId.Value)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbNotes, viewModel.NoteText), cancellationToken);
            return;
        }

        var activeNote = viewModel.ToEntity();
        activeNote.CreatedDate = currentTime;
        activeNote.CreatedBy = staffId;

        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isPrebook)
        {
            var effectiveJobBookingId = await Context.GetEffectiveJobBookingIdAsync(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            if (!viewModel.JobId.HasValue) throw new ArgumentNullException(nameof(viewModel.JobId));
            // Use the actual job ID instead of the effective job ID to avoid FK constraint issues
            // The note should be associated with the specific job being voided, not its parent
            activeNote.JobId = viewModel.JobId.Value;
        }

        await Context.TucNotes.AddAsync(activeNote, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);

        // Also update UcjbNotes so the note syncs to the device (only for active jobs, not prebooks)
        if (!isPrebook && viewModel.JobId.HasValue)
        {
            await Context.TucJobs
                .Where(j => j.UcjbId == viewModel.JobId.Value)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbNotes, viewModel.NoteText), cancellationToken);
        }
    }

    private async Task UpdateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value);
        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isArchived)
        {
            var archivedNote = await Context.TucNoteArchives.FindAsync([viewModel.NoteId], cancellationToken);
            ArgumentNullException.ThrowIfNull(archivedNote);

            archivedNote.NoteTypeId = viewModel.NoteTypeId;
            archivedNote.JobId = viewModel.JobId;
            archivedNote.JobBookingId = viewModel.JobBookingId;
            archivedNote.NoteText = viewModel.NoteText;
            archivedNote.IsImportant = viewModel.IsImportant;
            archivedNote.UpdatedDate = currentTime;
            archivedNote.UpdatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            Context.TucNoteArchives.Update(archivedNote);
            await Context.SaveChangesAsync(cancellationToken);
            return;
        }

        var activeNote = await Context.TucNotes.FindAsync([viewModel.NoteId], cancellationToken);
        ArgumentNullException.ThrowIfNull(activeNote);

        activeNote.NoteTypeId = viewModel.NoteTypeId;
        activeNote.JobId = viewModel.JobId;
        activeNote.JobBookingId = viewModel.JobBookingId;
        activeNote.NoteText = viewModel.NoteText;
        activeNote.IsImportant = viewModel.IsImportant;
        activeNote.UpdatedDate = currentTime;
        activeNote.UpdatedBy = staffId;

        if (isPrebook)
        {
            var effectiveJobBookingId = await Context.GetEffectiveJobBookingIdAsync(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            if (!viewModel.JobId.HasValue) throw new ArgumentNullException(nameof(viewModel.JobId));

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, false);
            activeNote.JobId = effectiveJobId;
        }

        Context.TucNotes.Update(activeNote);
        await Context.SaveChangesAsync(cancellationToken);
    }

    // Query Methods

    private async Task<List<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, false);
        var tenantTimeZone = infoService.GetTenantTimeZone();

        var notes = await Context.GetActiveNotesByJobIdAsync(effectiveJobId);
        UpdateNoteDate(notes, tenantTimeZone);
        return notes;
    }

    private async Task<List<TucNoteViewModel>> GetArchivedNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, true);

        var query = CreateArchivedNoteQuery()
            .Where(note => note.JobId == effectiveJobId || note.JobBookingId == effectiveJobId);

        var notes = await query.ToListAsync();
        // Order in memory as TucNoteViewModel.CreatedDate is DateTimeOffset which some providers don't support in ORDER BY
        return notes.OrderByDescending(note => note.CreatedDate).ToList();
    }

    private IQueryable<TucNoteViewModel> CreateArchivedNoteQuery() => CreateArchivedNoteQuery(Context);

    private static IQueryable<TucNoteViewModel> CreateArchivedNoteQuery(DespatchContext context)
    {
        return from note in context.TucNoteArchives
            join noteType in context.TucNoteTypes
                on note.NoteTypeId equals noteType.NoteTypeId into noteTypes
            from nt in noteTypes.DefaultIfEmpty()
            join createdBy in context.TucStaffs
                on note.CreatedBy equals createdBy.UcstId into createdStaff
            from cs in createdStaff.DefaultIfEmpty()
            join updatedBy in context.TucStaffs
                on note.UpdatedBy equals updatedBy.UcstId into updatedStaff
            from us in updatedStaff.DefaultIfEmpty()
            join job in context.TucJobArchives
                on note.JobId equals job.UcjbId into jobs
            from j in jobs.DefaultIfEmpty()
            select new TucNoteViewModel
            {
                // Note properties
                NoteId = note.NoteId,
                NoteText = note.NoteText,
                CreatedDate = note.CreatedDate ?? j.UcjbComplTime ?? DateTime.MinValue,
                UpdatedDate = note.UpdatedDate,
                JobId = note.JobId,
                JobBookingId = note.JobBookingId,
                IsImportant = note.IsImportant,

                // Related entity properties
                NoteTypeId = note.NoteTypeId,
                NoteTypeName = nt.NoteTypeName,

                // Staff information
                CreatedBy = note.CreatedBy,
                CreatedByName = cs != null ? cs.UcstFirstName + Space + cs.UcstLastName : null,
                UpdatedBy = note.UpdatedBy,
                UpdatedByName = us != null ? us.UcstFirstName + Space + us.UcstLastName : null,

                // Job information
                JobNumber = j != null ? j.UcjbNumber : null
            };
    }

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
            if (!job.Booked.HasValue) throw new ArgumentNullException(nameof(job.Booked));

            var jobDateTime = job.Booked.Value;

            if (job.SpeedId == economySpeedId)
            {
                if (!job.Booked.HasValue) throw new ArgumentNullException(nameof(job.Booked));
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
                NoteTypeId = (int)noteType
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
            var rowsAffected = await Context.TucNotes
                .Where(c => c.NoteId == noteId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(e => e.NoteText, noteText)
                    .SetProperty(e => e.NoteTypeId, (int)noteType)
                    .SetProperty(e => e.IsImportant, isImportant)
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

    public async Task<List<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived)
    {
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
                    Selected = j.UcjbId == jobId
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

    public async Task<int?> GetJobParentIdAsync(int jobId) =>
        await Context.GetJobParentIdAsync(jobId);

    /// <summary>
    /// Gets current amounts for a list of jobs for bulk price preview/comparison.
    /// </summary>
    public async Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(List<int> jobIds)
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