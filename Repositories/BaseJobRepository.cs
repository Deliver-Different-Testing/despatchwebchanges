using System;
using System.Collections.Generic;
using System.Linq;
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

    protected async Task<JobSearchResult> DespatchQryWithPagination(
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
            var query = await BuildBaseQuery(selectedViewIds, isUsTenant);
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
                        query = query.Where(j => j.UcjbDate.Date <= queryParams.DateCutoff.Value.Date);

                    if (queryParams.StartDate.HasValue)
                        query = query.Where(j => j.UcjbDate.Date >= queryParams.StartDate.Value.Date);

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

            var totalCount = await query.CountAsync();

            // Get All Jobs For Map
            var mapItems = new List<DispatchMapItem>();
            if (page == AppPage.Dispatch)
            {
                mapItems = await query
                    .AsNoTracking()
                    .Select(JobMappings.ToDispatchMapItem)
                    .ToListAsync();
            }

            var jobs = await query
                .AsNoTracking()
                .Select(JobMappings.JobDispatchMapping(isUsTenant))
                .ToListAsync();

            var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();
            var now = infoService.GetCurrentTenantTime();
            foreach (var job in jobs)
            {
                job.AngularId = Guid.NewGuid();
                job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
            }
            
            return new JobSearchResult
            {
                Jobs = jobs,
                TotalCount = totalCount,
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

    private async Task<IQueryable<TucJob>> BuildBaseQuery(List<int> selectedViews, bool isUsTenant)
    {
        var jobIds = await GetFilteredJobIds(selectedViews, isUsTenant);
        if (jobIds.Count == 0) return null;

        return Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId));
    }

    private async Task<HashSet<int>> GetFilteredJobIds(List<int> selectedViewIds, bool isUsTenant)
    {
        List<int> ids;
        if (selectedViewIds == null || selectedViewIds.Count == 0)
        {
            if (!isUsTenant) return [];
            ids = await Context
                .DeswebQryDespatchJobViewFilters
                .Select(x => x.UcjbId)
                .ToListAsync();
            return [..ids];
        }

        var viewFilters = await Context
            .TblDespatchViews
            .Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
            .Select(dv => dv.WhereCondition)
            .ToListAsync();

        if (viewFilters.Count == 0) return [];

        var combinedFilters = string.Join(" OR ", viewFilters.Select(filter => $"({filter})"));
        ids = await Context
            .DeswebQryDespatchJobViewFilters
            .FromSqlRaw(
                isUsTenant
                    ? $"select * from DESWEB_qry_Despatch_Job_View_Filters WHERE {combinedFilters}"
                    : $"select * from DESWEB_qryDespatch WHERE {combinedFilters}"
            )
            .Select(x => x.UcjbId)
            .ToListAsync();

        return [..ids];
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
                || (j.InternalStatus == null && j.UcjbStatus != (int)JobStatus.AwaitingPod)
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
        query = query.Where(j => j.UcjbComplTime == null);

        // Apply client viewFilters for non-internal users
        if (isInternal || string.IsNullOrEmpty(clientIds))
            return query;

        var clientIdList = clientIds.Split(',').Select(id => int.Parse(id.Trim())).ToList();
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
            var jobIds = await GetFilteredJobIds(selectedViewIds, isUsCustomer);
            if (jobIds.Count == 0) return [];

            // Direct query without BuildBaseQuery - we don't need includes for coordinates
            var jobCoordinates = await Context.TucJobs
                .Where(j => jobIds.Contains(j.UcjbId) && j.UcjbStatus != 9)
                .AsNoTracking()
                .Select(j => new JobCoordinateModel
                {
                    Id = j.UcjbId,
                    JobNo = j.UcjbNumber,
                    PickupLatitude = j.PickUpLatitude,
                    PickupLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    StatusId = j.UcjbStatus,
                    StatusName = j.UcjbStatusNavigation.UcjsName,
                    ClientId = j.UcjbClientId ?? 0,
                    ClientName = j.UcjbClient.UcclName,
                    Speed = j.UcjbSpeedNavigation.ShortName,
                    FromAddress = j.UcjbFromAddr,
                    ToAddress = j.UcjbToAddr
                })
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
            .Where(n => n.BulkJobId == bulkJobId)
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

    public async Task<List<TucNoteViewModel>> GetNotesByJobIdAsync(int jobId)
    {
        ArgumentNullException.ThrowIfNull(jobId);

        return await IsJobArchived(jobId)
            ? await GetArchivedNotesByJobIdAsync(jobId)
            : await GetActiveNotesByJobIdAsync(jobId);
    }

    public async Task<TucNoteViewModel> GetNoteByIdAsync(int noteId)
    {
        ArgumentNullException.ThrowIfNull(noteId);

        // Try to get from active notes first, then archived if not found
        var note = await GetActiveNoteByIdAsync(noteId);
        return note ?? await GetArchivedNoteByIdAsync(noteId);
    }

    public async Task SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        ArgumentNullException.ThrowIfNull(viewModel.JobId);

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
        ArgumentNullException.ThrowIfNull(viewModel.BulkJobId);
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

    protected async Task SaveBulkNoteAsync(int bulkJobId, string noteText, bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == (int)noteType);
        if (!noteTypeExists) noteType = NoteType.InternalNote;

        var newNote = new TblBulkJobNote
        {
            BulkJobId = bulkJobId,
            IsImportant = isImportant,
            NoteText = noteText,
            NoteTypeId = (int)noteType
        };

        await Context.TblBulkJobNotes.AddAsync(newNote);
        await Context.SaveChangesAsync();
    }
    
    protected async Task SaveMultipleBulkNotesAsync(List<int> bulkJobIds, string noteText, bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == (int)noteType);
        if (!noteTypeExists) noteType = NoteType.InternalNote;

        var newNotes = bulkJobIds.Select(bulkJobId => new TblBulkJobNote 
            { BulkJobId = bulkJobId, IsImportant = isImportant, NoteText = noteText, NoteTypeId = (int)noteType }).ToList();

        await Context.TblBulkJobNotes.AddRangeAsync(newNotes);
        await Context.SaveChangesAsync();
    }

    private async Task<NoteType> ConfirmNoteTypeExists(NoteType noteType)
    {
        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == (int)noteType);
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
            var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == (int)noteType);
            if (!noteTypeExists) noteType = NoteType.InternalNote;
            
            var newNotes = jobIds.Select(jobId => new TucNote
                {
                    JobId = isRecurringJobs ? null : jobId,
                    JobBookingId = isRecurringJobs ? jobId : null,
                    NoteText = noteText,
                    IsImportant = isImportant,
                    NoteTypeId = (int)noteType
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

    protected async Task SaveNoteAsync(int jobId, string noteText, bool isImportant = false,
        bool isRecurringJob = false, NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

            // If a note type is not found, default to the internal note
            var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == (int)noteType);
            if (!noteTypeExists) noteType = NoteType.InternalNote;

            var viewModel = new TucNoteViewModel
            {
                JobId = isRecurringJob ? null : jobId,
                JobBookingId = isRecurringJob ? jobId : null,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType
            };

            await SaveNoteAsync(viewModel);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository), nameof(SaveNoteAsync)));
        }
    }

    public async Task DeleteNoteAsync(int noteId, CancellationToken cancellationToken = default)
    {
        await Context.TucNotes
            .Where(note => note.NoteId == noteId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    // Helper Methods
    public async Task<bool> IsJobArchived(int jobId) =>
        await Context.TucJobArchives.AnyAsync(j => j.UcjbId == jobId);

    private async Task<int> GetEffectiveJobId(int jobId, bool isArchived)
    {
        if (isArchived)
        {
            return await Context.TucJobArchives
                .AsNoTracking()
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId ?? j.UcjbId)
                .FirstOrDefaultAsync();
        }

        return await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.ParentId ?? j.UcjbId)
            .FirstOrDefaultAsync();
    }

    private async Task<int> GetEffectiveJobBookingIdAsync(int jobBookingId)
    {
        return await Context.TucJobBookings
            .AsNoTracking()
            .Where(j => j.UcbkId == jobBookingId)
            .Select(j => j.ParentId ?? j.UcbkId)
            .FirstOrDefaultAsync();
    }

    // Note Create/Update Operations
    private async Task CreateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value) &&
                         !viewModel.JobBookingId.HasValue;
        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isArchived)
        {
            var archivedNote = viewModel.ToArchivedEntity();
            archivedNote.CreatedDate = currentTime;
            archivedNote.CreatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            await Context.TucNoteArchives.AddAsync(archivedNote, cancellationToken);
            await Context.SaveChangesAsync(cancellationToken);
            return;
        }

        var activeNote = viewModel.ToEntity();
        activeNote.CreatedDate = currentTime;
        activeNote.CreatedBy = staffId;

        if (isPrebook)
        {
            var effectiveJobBookingId = await GetEffectiveJobBookingIdAsync(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            ArgumentNullException.ThrowIfNull(viewModel.JobId);
            // Use the actual job ID instead of the effective job ID to avoid FK constraint issues
            // The note should be associated with the specific job being voided, not its parent
            activeNote.JobId = viewModel.JobId.Value;
        }

        await Context.TucNotes.AddAsync(activeNote, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);
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

            UpdateNoteProperties(archivedNote, viewModel);
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

        UpdateNoteProperties(activeNote, viewModel);
        activeNote.UpdatedDate = currentTime;
        activeNote.UpdatedBy = staffId;

        if (isPrebook)
        {
            var effectiveJobBookingId = await GetEffectiveJobBookingIdAsync(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            ArgumentNullException.ThrowIfNull(viewModel.JobId);
            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, false);
            activeNote.JobId = effectiveJobId;
        }

        Context.TucNotes.Update(activeNote);
        await Context.SaveChangesAsync(cancellationToken);
    }

    private static void UpdateNoteProperties<T>(T note, TucNoteViewModel viewModel)
        where T : class
    {
        dynamic dynamicNote = note;
        dynamicNote.NoteTypeId = viewModel.NoteTypeId;
        dynamicNote.JobId = viewModel.JobId;
        dynamicNote.JobBookingId = viewModel.JobBookingId;
        dynamicNote.NoteText = viewModel.NoteText;
        dynamicNote.IsImportant = viewModel.IsImportant;
    }

    // Query Methods
    private async Task<TucNoteViewModel> GetActiveNoteByIdAsync(int noteId)
    {
        var note = await Context.TucNotes
            .AsNoTracking()
            .Where(x => x.NoteId == noteId)
            .Select(NoteMappings.ActiveNoteMap)
            .FirstOrDefaultAsync();
        
        UpdateNoteDate(note, infoService.GetTenantTimeZone());
        return note;
    }

    private async Task<List<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, false);
        var tenantTimeZone = infoService.GetTenantTimeZone();
        
        var notes = await Context.TucNotes
            .AsNoTracking()
            .Where(n => n.JobId == effectiveJobId)
            .Select(NoteMappings.ActiveNoteMap)
            .ToListAsync();
        
        UpdateNoteDate(notes, tenantTimeZone);
        return notes;
    }

    private async Task<TucNoteViewModel> GetArchivedNoteByIdAsync(int noteId)
    {
        var note = await CreateArchivedNoteQuery()
            .Where(note => note.NoteId == noteId).FirstOrDefaultAsync();

        var tenantTimeZone = infoService.GetTenantTimeZone();
        UpdateNoteDate(note, tenantTimeZone);
      
        return note;
    }

    private async Task<List<TucNoteViewModel>> GetArchivedNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, true);

        var query = CreateArchivedNoteQuery()
            .Where(note => note.JobId == effectiveJobId || note.JobBookingId == effectiveJobId);

        return await query.ToListAsync();
    }

    private IQueryable<TucNoteViewModel> CreateArchivedNoteQuery()
    {
        return from note in Context.TucNoteArchives
            join noteType in Context.TucNoteTypes
                on note.NoteTypeId equals noteType.NoteTypeId into noteTypes
            from nt in noteTypes.DefaultIfEmpty()
            join createdBy in Context.TucStaffs
                on note.CreatedBy equals createdBy.UcstId into createdStaff
            from cs in createdStaff.DefaultIfEmpty()
            join updatedBy in Context.TucStaffs
                on note.UpdatedBy equals updatedBy.UcstId into updatedStaff
            from us in updatedStaff.DefaultIfEmpty()
            join job in Context.TucJobArchives
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

    protected async Task<int> GetJobRelationshipInfoAsync(int jobId)
    {
        if (jobId == 0) return 0;

        return await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.ParentId ?? j.UcjbId)
            .FirstOrDefaultAsync();
    }

    protected async Task<int> GetBulkJobRelationshipInfoAsync(int bulkJobId)
    {
        if (bulkJobId == 0) return 0;

        return await Context.TblBulkJobs
            .AsNoTracking()
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => j.BulkParentId ?? j.BulkJobId)
            .FirstOrDefaultAsync();
    }

    protected async Task<int> GetJobBookingRelationshipInfoAsync(int bookingId)
    {
        if (bookingId == 0) return 0;

        return await Context.TucJobBookings
            .AsNoTracking()
            .Where(j => j.UcbkId == bookingId)
            .Select(j => j.ParentId ?? j.UcbkId)
            .FirstOrDefaultAsync();
    }

    protected static string GetTrackingName(int trackingMethodId)
    {
        return trackingMethodId switch
        {
            1 => "Email",
            2 => "Mobile",
            3 => "Email & Mobile",
            _ => string.Empty
        };
    }

    protected static double? CalculateRemainTime(DispatchJobViewModel job, DateTime currentTenantTime,
        int? economySpeedId, DateTime? ecoDeliveryTime)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(job);
            ArgumentNullException.ThrowIfNull(job.Booked);

            var jobDateTime = job.Booked.Value;

            if (job.SpeedId == economySpeedId)
            {
                ArgumentNullException.ThrowIfNull(job.Booked);
                ArgumentNullException.ThrowIfNull(ecoDeliveryTime);

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
            noteType = await ConfirmNoteTypeExists(noteType);
            var newNote = new TucNote
            {
                JobBookingId = jobId,
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

        var economySpeedId = await Context.TucJobTypes
            .AsNoTracking()
            .Where(s => s.UcjtName == "Economy")
            .Select(s => s.UcjtId)
            .FirstOrDefaultAsync();

        var ecoDeliveryTime = await Context.TblEcoSettings
            .AsNoTracking()
            .Select(x => x.EconomyDeliveryTime)
            .FirstOrDefaultAsync();

        _economyCache = (economySpeedId, ecoDeliveryTime);
        return _economyCache.Value;
    }
    
    protected static void UpdateNoteDate(List<TucNoteViewModel> notes, string tenantTimeZone)
    {
        foreach (var note in notes) UpdateNoteDate(note, tenantTimeZone);
    }

    private static void UpdateNoteDate(TucNoteViewModel note, string tenantTimeZone)
    {
        note.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.CreatedDate, tenantTimeZone);
        if (note.UpdatedDate.HasValue) note.UpdatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.UpdatedDate.Value, tenantTimeZone);
    }
}