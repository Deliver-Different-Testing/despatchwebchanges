using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class RecurringJobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseJobRepository(contextFactory, infoService, clock, clearListEnvelopeService), IRecurringJobRepository
{
    // Column length limits — should match database column definitions
    private const int MaxRefALength = 20;
    private const int MaxRefBLength = 15;
    private const int MaxOurRefLength = 20;
    private const int MaxContactLength = 100;
    private const int MaxTrackingLength = 100;
    private const int MaxCustomNameLength = 100;
    private const int MaxConNoteLength = 100;
    private const int MaxSavedFlightNumberLength = 16;

    // Upper bound for RecurringInitialDays / create-ahead offset. Bounds the
    // backfill preview cost (see PreviewCreateAheadBackfillAsync) and prevents
    // accidental multi-year batches from a fat-finger edit. Adjust here if
    // product raises the cap.
    private const int MaxRecurringInitialDays = 30;

    /// <summary>
    /// SQL Server minimum date — values at or below this are treated as "no date" and skipped during timezone conversion.
    /// </summary>
    private static readonly DateTimeOffset SqlMinDate = new(1753, 1, 2, 0, 0, 0, TimeSpan.Zero);

    private readonly ITenantClock _clock = clock;
    private readonly ITenantInfoService _infoService = infoService;

    public async Task<PaginatedResponse<PrebookListViewModel>> GetRecurringJobsListAsync(
        RecurringJobQueryRequest request)
    {
        var isUsTenant = _infoService.IsUsTenant();
        var query = BuildRecurringJobQuery(request, isUsTenant);

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
        {
            return new PaginatedResponse<PrebookListViewModel>
            {
                Items = [],
                Total = 0,
                Page = request.Page,
                Pages = 0
            };
        }

        query = ApplyRecurringJobSort(query, request.Order, request.OrderDirection, applyDefaultSort: false);

        var items = await query
            .Skip((request.Page - 1) * request.Limit)
            .Take(request.Limit)
            .Select(JobMappings.ToPrebookListViewModel)
            .ToListAsync();

        ApplyPrebookTimezoneConversion(items);

        return new PaginatedResponse<PrebookListViewModel>
        {
            Items = items,
            Total = totalCount,
            Page = request.Page,
            Pages = (int)Math.Ceiling((double)totalCount / request.Limit)
        };
    }

    public async Task<JobGroupViewModel> GetRecurringJobByIdAsync(int jobId)
    {
        var effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(jobId);

        var allJobsInGroup = await Context.TucJobBookings
            .Where(j => j.UcbkId == effectiveJobId || j.BookingParentId == effectiveJobId)
            .Select(JobMappings.JobRecurringMapping(_infoService.IsUsTenant()))
            .TagWith($"GetRecurringJob - Complete Booking Group {effectiveJobId}")
            .ToListAsync();

        var mainJob = allJobsInGroup.FirstOrDefault(j => j.Id == jobId);
        ArgumentNullException.ThrowIfNull(mainJob);

        var relatedJobs = allJobsInGroup.Where(j => j.Id != jobId).ToList();

        return new JobGroupViewModel
        {
            Job = mainJob,
            RelatedJobs = relatedJobs
        };
    }

    public async Task UpdateRecurringJobAsync(int jobId, JobProperty property, string value)
    {
        try
        {
            var noteText = property switch
            {
                // Simple single-field updates (no note)
                JobProperty.Items or JobProperty.SpeedID or JobProperty.ClientID or
                    JobProperty.Pedal or JobProperty.Attention or JobProperty.Reprice or
                    JobProperty.Truck or JobProperty.Van or JobProperty.VanOK or
                    JobProperty.RefA or JobProperty.RefB or JobProperty.OurRef or
                    JobProperty.DGClass or JobProperty.Direct or
                    JobProperty.TrackingMobile or JobProperty.TrackingEmail or
                    JobProperty.Amount or JobProperty.AcceptedJobTypeID or
                    JobProperty.DeliverBy or JobProperty.BookedTime or
                    JobProperty.StopDate or JobProperty.RestartDate or
                    JobProperty.CourierId or JobProperty.InactiveBy or
                    JobProperty.RouteId or
                    JobProperty.AgentId or JobProperty.NpAgentId or
                    JobProperty.SavedFlightNumber
                    => await UpdateSimplePropertyAsync(jobId, property, value),

                // Parent + children updates (no note)
                JobProperty.Time or JobProperty.Date or JobProperty.Weight or
                    JobProperty.CustomJobName or JobProperty.ConNote
                    => await UpdatePropertyWithChildrenAsync(jobId, property, value),

                // Contact fields: parent + first/last child
                JobProperty.FromContactName or JobProperty.FromContactPhone or
                    JobProperty.ToContactName or JobProperty.ToContactPhone
                    => await UpdateContactPropertyAsync(jobId, property, value),

                // Updates that create an audit note
                JobProperty.Size or JobProperty.DGDocumentation or
                    JobProperty.TrackingMethod or JobProperty.Frequency or
                    JobProperty.HolidayDelivery or JobProperty.DaysOfWeek or
                    JobProperty.Active or JobProperty.RecurringMode or
                    JobProperty.RecurringInitialDays
                    => await UpdatePropertyWithNoteAsync(jobId, property, value),

                _ => throw new ArgumentOutOfRangeException(nameof(property), property, null)
            };

            if (!string.IsNullOrEmpty(noteText))
            {
                await CreateNewRecurringJobNote(jobId, noteText, false);
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository),
                    nameof(UpdateRecurringJobAsync)));
            throw;
        }
    }

    public async Task<IReadOnlyList<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobBookingId)
    {
        var effectivePrebookId = await Context.GetEffectiveJobBookingIdAsync(jobBookingId);
        var tenantTimeZone = _infoService.GetTenantTimeZone();

        var notes = await Context.TucNotes
            .Where(n => n.JobBookingId == effectivePrebookId)
            .OrderByDescending(n => n.CreatedDate)
            .Select(NoteMappings.ActiveNoteMap)
            .ToListAsync();

        UpdateNoteDate(notes, tenantTimeZone);
        return notes;
    }

    public async Task SaveRecurringJobNote(TucNoteViewModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        if (!note.JobBookingId.HasValue)
        {
            throw new ArgumentNullException(nameof(note));
        }

        if (note.NoteId == 0)
        {
            await CreateNewRecurringJobNote(note.JobBookingId.Value, note.NoteText, note.IsImportant,
                (NoteType)note.NoteTypeId);
        }
        else
        {
            await UpdateRecurringJobNote(note.NoteId, note.NoteText, note.IsImportant, (NoteType)note.NoteTypeId);
        }
    }

    public async Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            // Get the last child job ID (for delivery address)
            var lastChildId = await Context.TucJobBookings
                .Where(child => child.BookingParentId == request.JobId)
                .OrderByDescending(child => child.UcbkId)
                .Select(child => (int?)child.UcbkId)
                .FirstOrDefaultAsync();

            // Update parent job and last child job (if exists)
            var idsToUpdate = new List<int> { request.JobId };
            if (lastChildId.HasValue)
            {
                idsToUpdate.Add(lastChildId.Value);
            }

            var rowsAffected = await Context.TucJobBookings
                .Where(jb => idsToUpdate.Contains(jb.UcbkId))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(jb => jb.DeliveryLatitude, address.Latitude)
                    .SetProperty(jb => jb.DeliveryLongitude, address.Longitude)
                    .SetProperty(jb => jb.DeliveryAddressLine1, address.AddressLine1)
                    .SetProperty(jb => jb.DeliveryAddressLine2, address.AddressLine2)
                    .SetProperty(jb => jb.DeliveryAddressLine3, address.AddressLine3)
                    .SetProperty(jb => jb.DeliveryAddressLine4, address.AddressLine4)
                    .SetProperty(jb => jb.DeliveryAddressLine5, address.AddressLine5)
                    .SetProperty(jb => jb.DeliveryAddressLine6, address.AddressLine6)
                    .SetProperty(jb => jb.DeliveryAddressLine7, address.AddressLine7)
                    .SetProperty(jb => jb.DeliveryAddressLine8, address.AddressLine8));

            if (rowsAffected == 0)
            {
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request));
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RecurringJobRepository),
                    nameof(UpdateBookingDeliveryAddressAsync)));
            throw;
        }
    }

    public async Task UpdateBookingPickupAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            // Get the first child job ID (for pickup address)
            var firstChildId = await Context.TucJobBookings
                .Where(child => child.BookingParentId == request.JobId)
                .OrderBy(child => child.UcbkId)
                .Select(child => (int?)child.UcbkId)
                .FirstOrDefaultAsync();

            // Update parent job and first child job (if exists)
            var idsToUpdate = new List<int> { request.JobId };
            if (firstChildId.HasValue)
            {
                idsToUpdate.Add(firstChildId.Value);
            }

            var rowsAffected = await Context.TucJobBookings
                .Where(jb => idsToUpdate.Contains(jb.UcbkId))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(jb => jb.PickUpLatitude, address.Latitude)
                    .SetProperty(jb => jb.PickUpLongitude, address.Longitude)
                    .SetProperty(jb => jb.PickupAddressLine1, address.AddressLine1)
                    .SetProperty(jb => jb.PickupAddressLine2, address.AddressLine2)
                    .SetProperty(jb => jb.PickupAddressLine3, address.AddressLine3)
                    .SetProperty(jb => jb.PickupAddressLine4, address.AddressLine4)
                    .SetProperty(jb => jb.PickupAddressLine5, address.AddressLine5)
                    .SetProperty(jb => jb.PickupAddressLine6, address.AddressLine6)
                    .SetProperty(jb => jb.PickupAddressLine7, address.AddressLine7)
                    .SetProperty(jb => jb.PickupAddressLine8, address.AddressLine8));

            if (rowsAffected == 0)
            {
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request));
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RecurringJobRepository),
                    nameof(UpdateBookingPickupAddressAsync)));
            throw;
        }
    }

    public async Task<InsertRecurringToLiveResult> InsertRecurringToLiveAsync(InsertRecurringToLiveRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.JobId <= 0)
        {
            throw new ArgumentException("JobId is required", nameof(request));
        }

        var insertDate = request.InsertDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);

        var parentBookingIds = await ResolveParentBookingScopeAsync(request.JobId, request.Scope);

        if (parentBookingIds.Count == 0)
        {
            return new InsertRecurringToLiveResult
            {
                ParentBookingIds = [],
                InsertedJobIds = []
            };
        }

        var startUtc = DateTime.UtcNow;

        var parentMeta = await Context.TucJobBookings
            .Where(b => parentBookingIds.Contains(b.UcbkId))
            .Select(b => new
            {
                b.UcbkId,
                b.ScheduleId,
                b.RawBaseAmount,
                b.UcbkClientId
            })
            .ToDictionaryAsync(b => b.UcbkId);

        foreach (var parentBookingId in parentBookingIds)
        {
            if (!parentMeta.TryGetValue(parentBookingId, out var meta))
            {
                continue;
            }

            var useSchedule = meta.ScheduleId is > 0;

            await ExecuteMaterialiseParentAsync(parentBookingId, insertDate, useSchedule);
        }

        var familyTemplateIds = await Context.TucJobBookings
            .Where(b => parentBookingIds.Contains(b.UcbkId)
                        || (b.BookingParentId.HasValue && parentBookingIds.Contains(b.BookingParentId.Value)))
            .Select(b => b.UcbkId)
            .ToListAsync();

        var newJobs = await Context.TucJobs
            .Where(j => j.BookingParentId.HasValue
                        && familyTemplateIds.Contains(j.BookingParentId.Value)
                        && j.CreatedTime >= startUtc)
            .Select(j => new { j.UcjbId, j.BookingParentId })
            .ToListAsync();

        var insertedJobIds = newJobs.Select(j => j.UcjbId).ToList();

        var allTemplatePricing = await Context.TucJobBookings
            .Where(b => familyTemplateIds.Contains(b.UcbkId))
            .Select(b => new TemplatePricing(
                b.UcbkId,
                b.BookingParentId,
                b.RawBaseAmount,
                b.UcbkAmount,
                b.FuelSurchargeAmount,
                b.RatedManually))
            .ToDictionaryAsync(b => b.UcbkId);

        var plan = BuildRepricePlan(
            newJobs.Select(j => (j.UcjbId, j.BookingParentId)),
            allTemplatePricing);

        // Self-heal each affected template's RawBaseAmount once — only the
        // templates whose raw base had to be derived from the fuel formula.
        // BuildRepricePlan already excludes manually-rated templates (their
        // pricing flows through untouched, same gate as the SQL cron path —
        // tucJobBooking.RatedManually replaced the old per-client
        // RecalcRecurringFuel toggle on 2026-07-28).
        foreach (var (templateId, rawBaseAmount) in plan.SelfHealTemplateRawBases)
        {
            await Context.TucJobBookings
                .Where(b => b.UcbkId == templateId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.RawBaseAmount, rawBaseAmount));
        }

        // Reprice each new job via the shared proc — it updates tucJob AND
        // replaces the PricingBreakdown "Fuel" line, so the breakdown sum
        // never drifts from UcjbAmount the way a direct column update would.
        // Per-job EXEC rather than a set-based ExecuteUpdateAsync; this path
        // is the manual "Insert to Live" button, not the nightly cron, so the
        // batch sizes don't need bulk-update performance.
        foreach (var group in plan.Groups)
        {
            foreach (var jobId in group.JobIds)
            {
                await Context.Database.ExecuteSqlInterpolatedAsync(
                    $"EXEC dbo.UTL_stpJob_ApplyRecurringFuelReprice @JobID = {jobId}, @RawBaseAmount = {group.RawBaseAmount}");
            }
        }

        return new InsertRecurringToLiveResult
        {
            BookingsMaterialised = parentBookingIds.Count,
            JobsInserted = insertedJobIds.Count,
            JobsRepriced = plan.RepricedJobCount,
            InsertedJobIds = insertedJobIds,
            ParentBookingIds = parentBookingIds
        };
    }

    // ------------------------------------------------------------------
    // CreateAheadDays backfill (Kevin 2026-07-16, Dane sign-off).
    //
    // The nightly materialiser (uspPrebookSet -> Monitor -> InsertSchedule /
    // InsertJobAndChildren) already stamps ucbkDate = today + RecurringInitialDays
    // for rolling-window bookings and materialises the corresponding tucJob on
    // that day, so raising the offset takes effect on the very next cron pass.
    // The gap to fill is: dates BETWEEN today + oldOffset + 1 AND today + newOffset
    // that would have been materialised had the higher offset been in force
    // yesterday. This flow lets an operator explicitly opt in to that catch-up.
    //
    // Filters mirror uspPrebookSet's target-match block so the preview matches
    // what the cron would have created. Dup guard mirrors the booking-day-skip
    // NOT EXISTS in uspPrebookSet. Materialiser reuses ExecuteMaterialiseParentAsync
    // so each date rotates a fresh ucbkJobNumber family (collision-safe).
    // ------------------------------------------------------------------
    public async Task<PreviewCreateAheadBackfillResult> PreviewCreateAheadBackfillAsync(
        PreviewCreateAheadBackfillRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.JobId <= 0)
        {
            throw new ArgumentException("JobId is required", nameof(request));
        }

        // NewValue <= OldValue means the operator is shrinking the offset (or
        // no change). There is nothing to backfill — per the README's
        // non-goal, we never delete future jobs when the value decreases.
        if (request.NewValue <= request.OldValue)
        {
            return new PreviewCreateAheadBackfillResult();
        }

        if (request.NewValue > MaxRecurringInitialDays)
        {
            throw new ArgumentException(
                $"NewValue must be between 0 and {MaxRecurringInitialDays}. Got: {request.NewValue}.",
                nameof(request));
        }

        var parentUcbkId = await Context.GetEffectiveJobBookingIdAsync(request.JobId);

        var meta = await (
            from jb in Context.TucJobBookings
            where jb.UcbkId == parentUcbkId
            join c in Context.TucClients on jb.UcbkClientId equals c.UcclId into cs
            from c in cs.DefaultIfEmpty()
            select new
            {
                jb.UcbkId,
                jb.UcbkFrequency,
                jb.UcbkDays,
                jb.HolidayDeliveryOption,
                jb.ScheduleId,
                jb.ScheduleName,
                jb.UcbkClientId,
                jb.UcbkFirstDue,
                ClientSiteId = c != null ? c.SiteId : (int?)null
            }
        ).FirstOrDefaultAsync();

        if (meta is null)
        {
            throw new InvalidOperationException(
                $"Parent recurring booking {parentUcbkId} not found");
        }

        var siteId = meta.ClientSiteId ?? 1;
        var today = DateOnly.FromDateTime(_clock.TenantNow);
        var windowStart = today.AddDays(request.OldValue + 1);
        var windowEnd = today.AddDays(request.NewValue);
        
        var familyTemplateIds = await Context.TucJobBookings
            .Where(b => b.UcbkId == parentUcbkId || b.BookingParentId == parentUcbkId)
            .Select(b => b.UcbkId)
            .ToListAsync();

        var windowStartDt = windowStart.ToDateTime(TimeOnly.MinValue);
        var windowEndDt = windowEnd.ToDateTime(TimeOnly.MaxValue);

        var existingLiveDates = await Context.TucJobs
            .Where(j => j.BookingParentId.HasValue
                        && familyTemplateIds.Contains(j.BookingParentId.Value)
                        && j.UcjbDate >= windowStartDt && j.UcjbDate <= windowEndDt
                        && !j.UcjbVoid)
            .Select(j => j.UcjbDate)
            .Distinct()
            .ToListAsync();

        var existingDateSet = existingLiveDates
            .Select(DateOnly.FromDateTime)
            .ToHashSet();
        
        var holidayDates = await Context.TblHolidays
            .Where(h => h.SiteId == siteId
                        && h.JobEntryType == "Local"
                        && h.Date >= windowStartDt && h.Date <= windowEndDt)
            .Select(h => h.Date)
            .Distinct()
            .ToListAsync();

        var holidaySet = holidayDates.Select(DateOnly.FromDateTime).ToHashSet();
        
        HashSet<int> scheduleActiveDows = [];
        if ((meta.ScheduleId ?? 0) > 0 && !string.IsNullOrEmpty(meta.ScheduleName))
        {
            var clientId = meta.UcbkClientId ?? 0;
            var rawDows = await Context.TblBulkRunSchedules
                .Where(s => s.Name == meta.ScheduleName
                            && (s.ClientId == clientId || s.ClientId == null))
                .Select(s => s.DayOfWeek)
                .Distinct()
                .ToListAsync();
            scheduleActiveDows = [.. rawDows.Select(d => (int)d)];
        }

        var candidates = new List<CreateAheadBackfillCandidate>();
        var already = new List<DateOnly>();
        var skipped = new List<CreateAheadBackfillSkippedDate>();

        for (var d = windowStart; d <= windowEnd; d = d.AddDays(1))
        {
            if (existingDateSet.Contains(d))
            {
                already.Add(d);
                continue;
            }

            // Frequency + day-pattern check (mirrors uspPrebookSet).
            var patternDow = ((int)d.DayOfWeek + 6) % 7 + 1; // 1=Mon..7=Sun
            var freq = meta.UcbkFrequency ?? 0;
            var daysMask = meta.UcbkDays ?? "1111100";
            bool patternMatch;

            switch (freq)
            {
                case 0 or 1:
                    patternMatch = MaskMatches(daysMask, patternDow);
                    break;
                case 2:
                    patternMatch = MaskMatches(daysMask, patternDow)
                                   && meta.UcbkFirstDue.HasValue
                                   && WeeksBetween(DateOnly.FromDateTime(meta.UcbkFirstDue.Value), d) % 2 == 0;
                    break;
                case 4 or 8 or 16:
                {
                    var firstOfMonth = new DateOnly(d.Year, d.Month, 1);
                    var weekOfMonth = WeeksBetween(firstOfMonth, d) + 1;
                    var wantedWeek = freq switch { 4 => 1, 8 => 2, _ => 3 }; // _ = 16, per the enclosing case
                    patternMatch = MaskMatches(daysMask, patternDow) && weekOfMonth == wantedWeek;
                    break;
                }
                case 32:
                    patternMatch = d == FirstWorkdayOfMonth(d);
                    break;
                case 64:
                    patternMatch = d == LastWorkdayOfMonth(d);
                    break;
                default:
                    patternMatch = MaskMatches(daysMask, patternDow);
                    break;
            }

            if (!patternMatch)
            {
                skipped.Add(new CreateAheadBackfillSkippedDate
                {
                    ServiceDate = d,
                    Reason = "Does not match recurrence pattern"
                });
                continue;
            }

            if ((meta.ScheduleId ?? 0) > 0)
            {
                var isoDow = ((int)d.DayOfWeek + 6) % 7 + 1;
                if (!scheduleActiveDows.Contains(isoDow))
                {
                    skipped.Add(new CreateAheadBackfillSkippedDate
                    {
                        ServiceDate = d,
                        Reason = "Schedule not active on this day"
                    });
                    continue;
                }
            }

            // Holiday check unless HolidayDeliveryOption = 2 (Book Anyway).
            if (meta.HolidayDeliveryOption != 2 && holidaySet.Contains(d))
            {
                skipped.Add(new CreateAheadBackfillSkippedDate
                {
                    ServiceDate = d,
                    Reason = "Holiday"
                });
                continue;
            }

            candidates.Add(new CreateAheadBackfillCandidate
            {
                ServiceDate = d,
                DisplayLabel = d.ToString("ddd dd MMM")
            });
        }

        return new PreviewCreateAheadBackfillResult
        {
            Candidates = candidates,
            AlreadyExistingDates = already,
            SkippedDates = skipped
        };
    }

    public async Task<CreateCreateAheadBackfillResult> CreateCreateAheadBackfillAsync(
        CreateCreateAheadBackfillRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.JobId <= 0)
        {
            throw new ArgumentException("JobId is required", nameof(request));
        }

        if (request.Dates.Count == 0)
        {
            return new CreateCreateAheadBackfillResult();
        }

        var parentUcbkId = await Context.GetEffectiveJobBookingIdAsync(request.JobId);

        var meta = await Context.TucJobBookings
            .Where(b => b.UcbkId == parentUcbkId)
            .Select(b => new { b.UcbkId, b.ScheduleId })
            .FirstOrDefaultAsync();

        if (meta is null)
        {
            throw new InvalidOperationException(
                $"Parent recurring booking {parentUcbkId} not found");
        }

        var useSchedule = (meta.ScheduleId ?? 0) > 0;

        // Family template IDs for the dup guard — same set the preview built.
        var familyTemplateIds = await Context.TucJobBookings
            .Where(b => b.UcbkId == parentUcbkId || b.BookingParentId == parentUcbkId)
            .Select(b => b.UcbkId)
            .ToListAsync();

        var jobsCreated = 0;
        var duplicatesSkipped = 0;
        var createdDates = new List<DateOnly>();
        var errors = new List<CreateCreateAheadBackfillDateError>();

        foreach (var d in request.Dates.OrderBy(x => x))
        {
            // Dup guard: mirrors the uspPrebookSet booking-day-skip predicate.
            var dt = d.ToDateTime(TimeOnly.MinValue);
            var dtEnd = d.ToDateTime(TimeOnly.MaxValue);
            var alreadyExists = await Context.TucJobs
                .AnyAsync(j => j.BookingParentId.HasValue
                               && familyTemplateIds.Contains(j.BookingParentId.Value)
                               && j.UcjbDate >= dt && j.UcjbDate <= dtEnd
                               && !j.UcjbVoid);

            if (alreadyExists)
            {
                duplicatesSkipped++;
                continue;
            }

            try
            {
                var beforeUtc = DateTime.UtcNow;
                await ExecuteMaterialiseParentAsync(parentUcbkId, dt, useSchedule);

                // Count how many tucJob rows landed. Same shape the
                // InsertRecurringToLive result uses.
                var newRowCount = await Context.TucJobs
                    .CountAsync(j => j.BookingParentId.HasValue
                                     && familyTemplateIds.Contains(j.BookingParentId.Value)
                                     && j.CreatedTime >= beforeUtc);
                jobsCreated += newRowCount;
                createdDates.Add(d);
            }
            catch (Exception ex)
            {
                Log.Error(ex,
                    "CreateAhead backfill push failed for template {UcbkId} on {Date}",
                    parentUcbkId, d);
                errors.Add(new CreateCreateAheadBackfillDateError
                {
                    ServiceDate = d,
                    Message = ex.Message
                });
            }
        }

        return new CreateCreateAheadBackfillResult
        {
            JobsCreated = jobsCreated,
            DuplicatesSkipped = duplicatesSkipped,
            CreatedDates = createdDates,
            Errors = errors
        };
    }

    public async Task<IReadOnlyList<PrebookListViewModel>> GetAllRecurringJobsForExportAsync(
        RecurringJobQueryRequest request)
    {
        var isUsTenant = _infoService.IsUsTenant();
        var query = BuildRecurringJobQuery(request, isUsTenant);

        query = ApplyRecurringJobSort(query, request.Order, request.OrderDirection, applyDefaultSort: true);

        // Cap export to prevent unbounded result sets
        const int maxExportRows = 10_000;
        var items = await query
            .Take(maxExportRows)
            .Select(JobMappings.ToPrebookListViewModel)
            .ToListAsync();

        if (items.Count == 0)
        {
            return items;
        }

        ApplyPrebookTimezoneConversion(items);

        return items;
    }

    public async Task SaveRecurringFlightAsync(int jobId, int fromAirportId, int toAirportId, string flightNumber)
    {
        var savedFlight = string.IsNullOrWhiteSpace(flightNumber)
            ? null
            : Truncate(flightNumber.Trim().ToUpperInvariant(), MaxSavedFlightNumberLength);

        await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.FromAirportId, fromAirportId)
                .SetProperty(j => j.ToAirportId, toAirportId)
                .SetProperty(j => j.SavedFlightNumber, savedFlight));
    }

    /// <summary>
    /// Resolves the raw-base amount for each newly materialised job and buckets
    /// the jobs by that amount, so the reprice can run as one UPDATE per
    /// distinct raw-base value rather than one query + update per job. Pure —
    /// no database access — so it is unit-testable without the pricing UDF.
    /// </summary>
    internal static RepricePlan BuildRepricePlan(
        IEnumerable<(int UcjbId, int? BookingParentId)> newJobs,
        IReadOnlyDictionary<int, TemplatePricing> templatePricing)
    {
        var selfHeal = new Dictionary<int, decimal>();
        var byRawBase = new Dictionary<decimal, List<int>>();
        var repricedCount = 0;

        foreach (var (ucjbId, bookingParentId) in newJobs)
        {
            if (!bookingParentId.HasValue)
            {
                continue;
            }

            var templateId = bookingParentId.Value;
            if (templatePricing.TryGetValue(templateId, out var template) && template.RatedManually)
            {
                // Manually-rated templates keep their copied pricing untouched —
                // same gate the SQL cron path uses (tucJobBooking.RatedManually).
                continue;
            }

            var resolved = ResolveRawBase(templateId, templatePricing, out var computedFromFormula);
            if (!resolved.HasValue)
            {
                continue;
            }

            var rawBaseAmount = resolved.Value;

            if (computedFromFormula)
            {
                selfHeal.TryAdd(templateId, rawBaseAmount);
            }

            if (!byRawBase.TryGetValue(rawBaseAmount, out var jobIds))
            {
                jobIds = [];
                byRawBase[rawBaseAmount] = jobIds;
            }

            jobIds.Add(ucjbId);
            repricedCount++;
        }

        var groups = byRawBase
            .Select(kv => new RepriceGroup(kv.Key, kv.Value))
            .ToList();

        return new RepricePlan(selfHeal, groups, repricedCount);
    }

    private static decimal? ResolveRawBase(
        int templateUcbkId,
        IReadOnlyDictionary<int, TemplatePricing> templatePricing,
        out bool computedFromFormula)
    {
        computedFromFormula = false;
        if (!templatePricing.TryGetValue(templateUcbkId, out var tpl))
        {
            return null;
        }

        if (tpl.RawBaseAmount.HasValue)
        {
            return tpl.RawBaseAmount.Value;
        }

        // Walk up to parent.
        if (tpl.BookingParentId.HasValue
            && templatePricing.TryGetValue(tpl.BookingParentId.Value, out var parentTpl)
            && parentTpl.RawBaseAmount.HasValue)
        {
            return parentTpl.RawBaseAmount.Value;
        }

        // Formula fallback: use the template's own headline - fuel.
        var headline = tpl.UcbkAmount ?? 0m;
        var fuel = tpl.FuelSurchargeAmount ?? 0m;
        var derived = headline - fuel;
        if (derived < 0m)
        {
            derived = 0m;
        }

        if (!tpl.UcbkAmount.HasValue && !tpl.FuelSurchargeAmount.HasValue)
        {
            return null;
        }

        computedFromFormula = true;
        return derived;
    }

    private async Task ExecuteMaterialiseParentAsync(int parentUcbkId, DateTime insertDate, bool useSchedule)
    {
        var parent = await Context.TucJobBookings.AsTracking()
            .FirstOrDefaultAsync(b => b.UcbkId == parentUcbkId);

        if (parent?.UcbkTime is null)
        {
            throw new InvalidOperationException(
                $"Cannot push booking {parentUcbkId} — parent has NULL ucbkTime. Set a time on the parent before pushing.");
        }

        var children = await Context.TucJobBookings.AsTracking()
            .Where(b => b.BookingParentId == parentUcbkId && b.UcbkId != parentUcbkId)
            .ToListAsync();

        // Snapshot originals so we can restore on success/failure — the booking
        // templates must never carry the temp-stamped state past this call.
        var origParentDate = parent.UcbkDate;
        var origParentInitialDays = parent.RecurringInitialDays;
        var origParentTime = parent.UcbkTime;
        var origParentJobNumber = parent.UcbkJobNumber;

        var childSnapshots = children.ToDictionary(
            c => c.UcbkId,
            c => (Date: c.UcbkDate, InitialDays: c.RecurringInitialDays, Time: c.UcbkTime, JobNumber: c.UcbkJobNumber));

        void Restore(bool selfHealChildTime)
        {
            parent.UcbkDate = origParentDate;
            parent.RecurringInitialDays = origParentInitialDays;
            parent.UcbkTime = origParentTime;
            parent.UcbkJobNumber = origParentJobNumber;

            foreach (var child in children)
            {
                var orig = childSnapshots[child.UcbkId];
                child.UcbkDate = orig.Date;
                child.RecurringInitialDays = orig.InitialDays;
                child.UcbkTime = selfHealChildTime ? orig.Time ?? child.UcbkTime : orig.Time;
                child.UcbkJobNumber = orig.JobNumber;
            }
        }

        try
        {
            // Mint fresh job number via the same SP uspPrebookSet calls.
            var prebookStaffId = await Context.TucStaffs
                .Where(s => s.UcstFirstName == "Prebooks")
                .Select(s => (int?)s.UcstId)
                .FirstOrDefaultAsync() ?? 0;

            var jobNo = new OutputParameter<string>();
            await Context.Procedures.UTL_stpJob_Insert_JobNumberAsync(prebookStaffId, parent.UcbkSpeed, jobNo);

            // Stamp parent: fresh job number, chosen date, reset
            // RecurringInitialDays so the materialiser uses the date as-is
            // (no rolling-window offset).
            parent.UcbkDate = insertDate;
            parent.RecurringInitialDays = 0;
            parent.UcbkJobNumber = jobNo.Value;

            // Stamp children: same date, parent's time (inherited), fresh job
            // number + suffix derived from the child's current number shape.
            foreach (var child in children)
            {
                if (child.JobRelationshipTypeId is not (13 or 20))
                {
                    continue;
                }

                var suffix = BuildChildJobNumberSuffix(child.JobRelationshipTypeId, child.UcbkJobNumber);
                child.UcbkDate = insertDate;
                child.RecurringInitialDays = 0;
                child.UcbkTime = origParentTime;
                child.UcbkJobNumber = jobNo.Value + suffix;
            }

            await Context.SaveChangesAsync();

            if (useSchedule)
            {
                await Context.Procedures.UTL_stpJobBooking_InsertScheduleAsync(parentUcbkId);
            }
            else
            {
                await Context.Procedures.UTL_stpJobBooking_InsertJobAndChildrenAsync(parentUcbkId);
            }

            // Restore — BUT self-heal ucbkTime: if a child's original was NULL,
            // keep the parent's time we stamped (so the child template no longer
            // has a NULL time after a successful push). Same idea would apply to
            // ucbkJobNumber, except the daily cron rotates those, so leaving them
            // suffixed would confuse the next cron — so jobNumber always restores.
            Restore(selfHealChildTime: true);
            await Context.SaveChangesAsync();
        }
        catch
        {
            // Mirror restore on failure so the booking templates never carry
            // the temp-stamped state past this call.
            Restore(selfHealChildTime: false);
            await Context.SaveChangesAsync();
            throw;
        }
    }

    // Mirrors the job-number suffix CASE uspPrebookSet stamps on child bookings
    // (SQL's default collation is case-insensitive, hence OrdinalIgnoreCase).
    internal static string BuildChildJobNumberSuffix(int? relationshipTypeId, string currentJobNumber)
    {
        if (string.IsNullOrEmpty(currentJobNumber))
        {
            return string.Empty;
        }

        if (relationshipTypeId == 13 && char.IsAsciiDigit(currentJobNumber[^1]))
        {
            return currentJobNumber[^1].ToString();
        }

        var last3 = currentJobNumber.Length <= 3 ? currentJobNumber : currentJobNumber[^3..];

        if (string.Equals(last3, "LHP", StringComparison.OrdinalIgnoreCase))
        {
            return "LHP";
        }

        if (string.Equals(last3, "DEL", StringComparison.OrdinalIgnoreCase))
        {
            return "DEL";
        }

        return last3.StartsWith("LH", StringComparison.OrdinalIgnoreCase) ? last3 : string.Empty;
    }

    private async Task<List<int>> ResolveParentBookingScopeAsync(int startBookingId, InsertToLiveScope scope)
    {
        var effectiveId = await Context.GetEffectiveJobBookingIdAsync(startBookingId);

        var startMeta = await Context.TucJobBookings
            .Where(b => b.UcbkId == effectiveId)
            .Select(b => new
            {
                b.UcbkId,
                b.RecurringMode,
                b.UcbkOneOff,
                b.RouteId,
                b.BookingParentId
            })
            .FirstOrDefaultAsync();

        if (startMeta is null)
        {
            throw new ArgumentException($"Recurring booking {startBookingId} not found", nameof(startBookingId));
        }

        if (startMeta.UcbkOneOff == true)
        {
            throw new InvalidOperationException(
                $"Booking {startBookingId} is a one-off, not a recurring booking.");
        }

        var isParent = !startMeta.BookingParentId.HasValue
                       || startMeta.BookingParentId.Value == startMeta.UcbkId;
        if (!isParent)
        {
            throw new InvalidOperationException(
                $"Booking {startBookingId} is a child — Insert-to-live can only be initiated from the parent booking.");
        }

        if (startMeta.RecurringMode != (byte)RecurringMode.Manual)
        {
            throw new InvalidOperationException(
                $"Booking {startBookingId} is not in Manual mode (current mode: {(RecurringMode)startMeta.RecurringMode}). Only Manual bookings can be pushed via Insert-to-live.");
        }

        switch (scope)
        {
            case InsertToLiveScope.Group:
                // The starting parent IS the family root. SP will fan out
                // to children automatically.
                return [startMeta.UcbkId];

            case InsertToLiveScope.Route:
            {
                if (!startMeta.RouteId.HasValue)
                {
                    throw new InvalidOperationException(
                        $"Booking {startBookingId} has no RouteId — route-scope push needs a route assignment.");
                }

                // All Manual PARENT bookings on the same route. Children
                // come along via each parent's SP fan-out.
                var parentIds = await Context.TucJobBookings
                    .Where(b => b.RouteId == startMeta.RouteId.Value
                                && b.UcbkOneOff != true
                                && b.RecurringMode == (byte)RecurringMode.Manual
                                && (!b.BookingParentId.HasValue || b.BookingParentId.Value == b.UcbkId))
                    .Select(b => b.UcbkId)
                    .ToListAsync();

                if (parentIds.Count == 0)
                {
                    throw new InvalidOperationException(
                        $"Route {startMeta.RouteId.Value} has no Manual-mode parent bookings to push.");
                }

                return parentIds;
            }

            default:
                throw new ArgumentOutOfRangeException(nameof(scope), scope, "Unsupported insert-to-live scope");
        }
    }

    // ISO 1=Mon.7=Sun position lookup on the tucJobBooking.ucbkDays mask.
    private static bool MaskMatches(string daysMask, int isoDow)
    {
        if (string.IsNullOrEmpty(daysMask) || isoDow < 1 || isoDow > daysMask.Length)
        {
            return false;
        }

        return daysMask[isoDow - 1] == '1';
    }

    // DATEDIFF(WEEK, ...) equivalent using SQL Server's Sunday-anchored
    // ISO week boundary (@@DATEFIRST = 7).
    private static int WeeksBetween(DateOnly start, DateOnly end)
    {
        var startSunday = start.AddDays(-DaysFromMonday(start) - 1);
        var endSunday = end.AddDays(-DaysFromMonday(end) - 1);
        return (endSunday.DayNumber - startSunday.DayNumber) / 7;
        int DaysFromMonday(DateOnly d) => ((int)d.DayOfWeek + 6) % 7;
    }

    private static DateOnly FirstWorkdayOfMonth(DateOnly d)
    {
        var candidate = new DateOnly(d.Year, d.Month, 1);
        while (candidate.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            candidate = candidate.AddDays(1);
        }

        return candidate;
    }

    private static DateOnly LastWorkdayOfMonth(DateOnly d)
    {
        var candidate = new DateOnly(d.Year, d.Month, DateTime.DaysInMonth(d.Year, d.Month));
        while (candidate.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            candidate = candidate.AddDays(-1);
        }

        return candidate;
    }

    private async Task<string> UpdateSimplePropertyAsync(int jobId, JobProperty property, string value)
    {
        switch (property)
        {
            case JobProperty.Items:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Quantity, ParseValue<short>(value, property)));
                break;

            case JobProperty.SpeedID:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId && j.UcbkDone != true)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkSpeed, ParseValue<int>(value, property)));
                break;

            case JobProperty.ClientID:
                var clientId = ParseValue<int>(value, property);
                var code = await Context.TucClients
                    .Where(c => c.UcclId == clientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();

                await Context.TucJobBookings.Where(j =>
                        j.UcbkId == jobId || j.BookingParentId == jobId || j.ParentId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkClientId, clientId)
                        .SetProperty(j => j.UcbkClientCode, code));
                break;

            case JobProperty.RouteId:
                int? routeIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j =>
                        j.UcbkId == jobId || j.BookingParentId == jobId || j.ParentId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.RouteId, routeIdValue));
                break;

            case JobProperty.Pedal:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkCbd, ParseValue<bool>(value, property)));
                break;

            case JobProperty.Attention:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkAttention, ParseValue<bool>(value, property)));
                break;

            case JobProperty.Reprice:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Reprice, ParseValue<bool>(value, property)));
                break;

            case JobProperty.Truck:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.Truck, ParseValue<bool>(value, property))
                        .SetProperty(j => j.UcbkVan, false));
                break;

            case JobProperty.Van:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkVan, ParseValue<bool>(value, property))
                        .SetProperty(j => j.Truck, false));
                break;

            case JobProperty.VanOK:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.VanOk, ParseValue<bool>(value, property)));
                break;

            case JobProperty.RefA:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkClientRefa, Truncate(value, MaxRefALength)));
                break;

            case JobProperty.RefB:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkClientRefb, Truncate(value, MaxRefBLength)));
                break;

            case JobProperty.OurRef:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkOurRef, Truncate(value, MaxOurRefLength)));
                break;

            case JobProperty.DGClass:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgclass, ParseValue<int>(value, property)));
                break;

            case JobProperty.Direct:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Direct, ParseValue<bool>(value, property)));
                break;

            case JobProperty.TrackingMobile:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMobile, Truncate(value, MaxTrackingLength)));
                break;

            case JobProperty.TrackingEmail:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingEmail, Truncate(value, MaxTrackingLength)));
                break;

            case JobProperty.Amount:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkAmount, ParseValue<decimal>(value, property)));
                break;

            case JobProperty.AcceptedJobTypeID:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.AcceptedJobTypeId, ParseValue<short>(value, property)));
                break;

            case JobProperty.DeliverBy:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.DeliverByTime, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.BookedTime:
                // Ready card reads UcbkDate.CombineWithTime(UcbkTime) — date from
                // one column, time from another. Writing only UcbkDate would
                // leave the time stale and reappear under the Created card
                // (which renders the raw UcbkDate). Mirror the live-job path
                // (JobRepository.EditOperations BookedTime) and write both.
                var bookedTime = ParseValue<DateTimeOffset>(value, property).DateTime;
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkDate, bookedTime)
                        .SetProperty(j => j.UcbkTime, bookedTime));
                break;

            case JobProperty.StopDate:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.StopDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.RestartDate:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.RestartDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.CourierId:
                int? courierIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.CourierId, courierIdValue));

                // Cascade to already-materialised future occurrences. With a
                // create-ahead window (RecurringInitialDays >= 1) tomorrow's job
                // is spun into a standalone tucJob before the operator edits the
                // template, so a template-only write never reaches it. Re-drive
                // every not-yet-actioned future job in the booking family (all
                // legs) so changing/clearing the courier takes effect on
                // tomorrow's run; completed and voided jobs are left untouched.
                var today = _clock.TenantToday;
                var familyTemplateIds = await Context.TucJobBookings
                    .Where(b => b.UcbkId == jobId || b.BookingParentId == jobId)
                    .Select(b => b.UcbkId)
                    .ToListAsync();

                await Context.TucJobs
                    .Where(j => j.BookingParentId.HasValue
                                && familyTemplateIds.Contains(j.BookingParentId.Value)
                                && j.UcjbDate >= today
                                && !j.UcjbJobDone
                                && !j.UcjbVoid)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbCourierId, courierIdValue));
                break;

            case JobProperty.InactiveBy:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkInActiveBy, ParseValue<int>(value, property)));
                break;

            case JobProperty.AgentId:
                int? agentIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.AgentId, agentIdValue));
                break;

            case JobProperty.NpAgentId:
                int? npAgentIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.AgentId, npAgentIdValue)
                        .SetProperty(j => j.NpAgentId, npAgentIdValue));
                break;

            case JobProperty.SavedFlightNumber:
                var savedFlight = string.IsNullOrWhiteSpace(value)
                    ? null
                    : Truncate(value.Trim().ToUpperInvariant(), MaxSavedFlightNumberLength);

                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.SavedFlightNumber, savedFlight));
                break;

            case JobProperty.ConNote:
            case JobProperty.AirportOnly:
            case JobProperty.Time:
            case JobProperty.Date:
            case JobProperty.Size:
            case JobProperty.Weight:
            case JobProperty.ClientCode:
            case JobProperty.ContactID:
            case JobProperty.InternalStatusID:
            case JobProperty.Status:
            case JobProperty.FromContactName:
            case JobProperty.ToContactName:
            case JobProperty.FromContactPhone:
            case JobProperty.ToContactPhone:
            case JobProperty.DeliverToLeaveID:
            case JobProperty.UndeliverableLocationID:
            case JobProperty.Delivered:
            case JobProperty.CompletedTime:
            case JobProperty.DGDocumentation:
            case JobProperty.TrackingMethod:
            case JobProperty.Void:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.NotifiedJobTypeID:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.FollowupTime:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.CustomJobName:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.Barcode:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RecurringMode:
            case JobProperty.RecurringInitialDays:
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        return null;
    }

    private async Task<string> UpdatePropertyWithChildrenAsync(int jobId, JobProperty property, string value)
    {
        var parentAndChildren = Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.BookingParentId == jobId);

        switch (property)
        {
            case JobProperty.Time:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.UcbkTime, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.Date:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.UcbkDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.Weight:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.UcbkWeight, ParseValue<short>(value, property)));
                break;

            case JobProperty.CustomJobName:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.CustomJobName, Truncate(value, MaxCustomNameLength)));
                break;

            case JobProperty.ConNote:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.Connote, Truncate(value, MaxConNoteLength)));
                break;
            case JobProperty.AirportOnly:
            case JobProperty.Size:
            case JobProperty.Items:
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID:
            case JobProperty.ClientID:
            case JobProperty.ClientCode:
            case JobProperty.ContactID:
            case JobProperty.Pedal:
            case JobProperty.Attention:
            case JobProperty.Reprice:
            case JobProperty.Truck:
            case JobProperty.Van:
            case JobProperty.VanOK:
            case JobProperty.InternalStatusID:
            case JobProperty.Status:
            case JobProperty.RefA:
            case JobProperty.RefB:
            case JobProperty.OurRef:
            case JobProperty.FromContactName:
            case JobProperty.ToContactName:
            case JobProperty.FromContactPhone:
            case JobProperty.ToContactPhone:
            case JobProperty.DeliverToLeaveID:
            case JobProperty.UndeliverableLocationID:
            case JobProperty.Delivered:
            case JobProperty.CompletedTime:
            case JobProperty.DGClass:
            case JobProperty.DGDocumentation:
            case JobProperty.TrackingMethod:
            case JobProperty.Direct:
            case JobProperty.Void:
            case JobProperty.TrackingMobile:
            case JobProperty.TrackingEmail:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.Amount:
            case JobProperty.NotifiedJobTypeID:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.DeliverBy:
            case JobProperty.BookedTime:
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.Barcode:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.RecurringMode:
            case JobProperty.SavedFlightNumber:
            case JobProperty.RecurringInitialDays:
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        return null;
    }

    private async Task<string> UpdateContactPropertyAsync(int jobId, JobProperty property, string value)
    {
        var truncated = Truncate(value, MaxContactLength);

        switch (property)
        {
            case JobProperty.FromContactName:
            {
                var firstChildId = await GetFirstChildIdAsync(jobId);
                var ids = BuildIdList(jobId, firstChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromContact, truncated));
                break;
            }
            case JobProperty.FromContactPhone:
            {
                var firstChildId = await GetFirstChildIdAsync(jobId);
                var ids = BuildIdList(jobId, firstChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromPhone, truncated));
                break;
            }
            case JobProperty.ToContactName:
            {
                var lastChildId = await GetLastChildIdAsync(jobId);
                var ids = BuildIdList(jobId, lastChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, truncated));
                break;
            }
            case JobProperty.ToContactPhone:
            {
                var lastChildId = await GetLastChildIdAsync(jobId);
                var ids = BuildIdList(jobId, lastChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToPhone, truncated));
                break;
            }
            case JobProperty.ConNote:
            case JobProperty.AirportOnly:
            case JobProperty.Time:
            case JobProperty.Date:
            case JobProperty.Size:
            case JobProperty.Items:
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID:
            case JobProperty.Weight:
            case JobProperty.ClientID:
            case JobProperty.ClientCode:
            case JobProperty.ContactID:
            case JobProperty.Pedal:
            case JobProperty.Attention:
            case JobProperty.Reprice:
            case JobProperty.Truck:
            case JobProperty.Van:
            case JobProperty.VanOK:
            case JobProperty.InternalStatusID:
            case JobProperty.Status:
            case JobProperty.RefA:
            case JobProperty.RefB:
            case JobProperty.OurRef:
            case JobProperty.DeliverToLeaveID:
            case JobProperty.UndeliverableLocationID:
            case JobProperty.Delivered:
            case JobProperty.CompletedTime:
            case JobProperty.DGClass:
            case JobProperty.DGDocumentation:
            case JobProperty.TrackingMethod:
            case JobProperty.Direct:
            case JobProperty.Void:
            case JobProperty.TrackingMobile:
            case JobProperty.TrackingEmail:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.Amount:
            case JobProperty.NotifiedJobTypeID:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.DeliverBy:
            case JobProperty.BookedTime:
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.CustomJobName:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.Barcode:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.RecurringMode:
            case JobProperty.SavedFlightNumber:
            case JobProperty.RecurringInitialDays:
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        return null;
    }

    private async Task<string> UpdatePropertyWithNoteAsync(int jobId, JobProperty property, string value)
    {
        switch (property)
        {
            case JobProperty.Size:
            {
                var size = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkSize, size));
                return $"Changed Size to {size}";
            }
            case JobProperty.DGDocumentation:
            {
                var dgDoc = ParseValue<bool>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgdocument, dgDoc));
                return $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
            }
            case JobProperty.TrackingMethod:
            {
                var trackingMethodId = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethodId));
                return $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
            }
            case JobProperty.Frequency:
            {
                var frequency = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkFrequency, frequency));
                return $"Frequency of recurring job set to: {((Frequency)frequency).ToDisplayString()}";
            }
            case JobProperty.HolidayDelivery:
            {
                var holidayOption = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.HolidayDeliveryOption, holidayOption));
                return
                    $"Holiday Delivery Option set to: {((HolidayDeliveryOptions)holidayOption).ToDisplayString()}";
            }
            case JobProperty.DaysOfWeek:
            {
                var dayEnum = (DaysOfWeek)ParseValue<int>(value, property);
                var daysInt = (int)dayEnum;
                var daysString = dayEnum.ToBinaryString();

                var effectiveBookingId = await Context.GetEffectiveJobBookingIdAsync(jobId);

                await Context.TucJobBookings
                    .Where(j => j.UcbkId == effectiveBookingId || j.BookingParentId == effectiveBookingId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkDaysInt, daysInt)
                        .SetProperty(j => j.UcbkDays, daysString));

                return $"Days of recurring jobs set to: {dayEnum.ToDisplayString()}";
            }
            case JobProperty.Active:
            {
                var isActive = ParseValue<bool>(value, property);
                var staffId = _infoService.GetStaffId();
                var currentTenantTime = _clock.TenantNow;

                // Keep RecurringMode in sync so the new tri-state filter
                // sees Active/Inactive transitions immediately. Legacy
                // boolean callers don't know about Manual — that state can
                // only be set via JobProperty.RecurringMode below.
                var newMode = isActive
                    ? (byte)RecurringMode.Active
                    : (byte)RecurringMode.Inactive;

                if (isActive)
                {
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.UcbkActive, true)
                            .SetProperty(j => j.RecurringMode, newMode));
                }
                else
                {
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.UcbkActive, false)
                            .SetProperty(j => j.RecurringMode, newMode)
                            .SetProperty(j => j.UcbkInActiveBy, staffId)
                            .SetProperty(j => j.UcbkInActiveDate, currentTenantTime));
                }

                return $"Changed Active to {(isActive ? "Yes" : "No")}";
            }
            case JobProperty.RecurringMode:
            {
                // Three-state operator transition. ucbkActive is synced per
                // Steve's compatibility rule so legacy active-only screens
                // continue to behave sensibly during rollout:
                //   Inactive => ucbkActive=0 (stamp who/when)
                //   Active   => ucbkActive=1
                //   Manual   => ucbkActive=1 (visible but excluded from
                //               auto-materialiser via uspPrebookSet filter)
                var modeValue = ParseValue<byte>(value, property);
                if (!Enum.IsDefined(typeof(RecurringMode), modeValue))
                {
                    throw new ArgumentException(
                        $"Invalid value '{value}' for RecurringMode. Expected 0 (Inactive), 1 (Active), or 2 (Manual).",
                        nameof(value));
                }

                var mode = (RecurringMode)modeValue;
                var staffId = _infoService.GetStaffId();
                var currentTenantTime = _clock.TenantNow;

                if (mode == RecurringMode.Inactive)
                {
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.RecurringMode, modeValue)
                            .SetProperty(j => j.UcbkActive, false)
                            .SetProperty(j => j.UcbkInActiveBy, staffId)
                            .SetProperty(j => j.UcbkInActiveDate, currentTenantTime));
                }
                else
                {
                    // Active or Manual — both surface as ucbkActive=1.
                    // Inactive-audit fields are preserved as historical
                    // markers per Steve's recommendation; they are not
                    // cleared on a re-activate.
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.RecurringMode, modeValue)
                            .SetProperty(j => j.UcbkActive, true));
                }

                return $"Changed Mode to {mode}";
            }
            case JobProperty.RecurringInitialDays:
            {
                var newInitialDays = ParseValue<int>(value, property);

                // Cap per Q5 recommendation (30 days). Bounds backfill preview
                // cost and prevents accidental multi-year batches. Adjust here
                // if product decides on a different limit.
                if (newInitialDays is < 0 or > MaxRecurringInitialDays)
                {
                    throw new ArgumentException(
                        $"RecurringInitialDays must be between 0 and {MaxRecurringInitialDays}. Got: {newInitialDays}.",
                        nameof(value));
                }

                // Only write on the parent template — children are ignored by
                // uspPrebookSet and inherit target-date behaviour via the SP
                // fan-out in InsertSchedule / InsertJobAndChildren.
                var effectiveBookingId = await Context.GetEffectiveJobBookingIdAsync(jobId);

                var beforeMeta = await Context.TucJobBookings
                    .Where(j => j.UcbkId == effectiveBookingId)
                    .Select(j => new { InitialDays = j.RecurringInitialDays ?? 0, j.UcbkFrequency })
                    .FirstOrDefaultAsync();
                var oldInitialDays = beforeMeta?.InitialDays ?? 0;
                var isFortnightly = beforeMeta?.UcbkFrequency == 2;

                await Context.TucJobBookings.Where(j => j.UcbkId == effectiveBookingId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.RecurringInitialDays, newInitialDays));

                // Fortnightly anchor re-seed. Client-side guarded so we only
                // hit the SP when it will actually do work (the SP itself
                // also returns early for non-fortnightly, but skipping the
                // round-trip keeps non-fortnightly edits SP-free and makes
                // repository tests SQL-Server-independent).
                if (newInitialDays != oldInitialDays && isFortnightly)
                {
                    await Context.Database.ExecuteSqlRawAsync(
                        "EXEC dbo.UTL_stpJobBooking_RecomputeFirstDueOnEdit @JobBookingID = {0}",
                        effectiveBookingId);
                }

                return $"Create-ahead days changed from {oldInitialDays} to {newInitialDays}";
            }
            case JobProperty.ConNote:
            case JobProperty.AirportOnly:
            case JobProperty.Time:
            case JobProperty.Date:
            case JobProperty.Items:
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID:
            case JobProperty.Weight:
            case JobProperty.ClientID:
            case JobProperty.ClientCode:
            case JobProperty.ContactID:
            case JobProperty.Pedal:
            case JobProperty.Attention:
            case JobProperty.Reprice:
            case JobProperty.Truck:
            case JobProperty.Van:
            case JobProperty.VanOK:
            case JobProperty.InternalStatusID:
            case JobProperty.Status:
            case JobProperty.RefA:
            case JobProperty.RefB:
            case JobProperty.OurRef:
            case JobProperty.FromContactName:
            case JobProperty.ToContactName:
            case JobProperty.FromContactPhone:
            case JobProperty.ToContactPhone:
            case JobProperty.DeliverToLeaveID:
            case JobProperty.UndeliverableLocationID:
            case JobProperty.Delivered:
            case JobProperty.CompletedTime:
            case JobProperty.DGClass:
            case JobProperty.Direct:
            case JobProperty.Void:
            case JobProperty.TrackingMobile:
            case JobProperty.TrackingEmail:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.Amount:
            case JobProperty.NotifiedJobTypeID:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.DeliverBy:
            case JobProperty.BookedTime:
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.CustomJobName:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.Barcode:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.SavedFlightNumber:
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }
    }

    private Task<int?> GetFirstChildIdAsync(int parentJobId) =>
        Context.TucJobBookings
            .Where(c => c.BookingParentId == parentJobId)
            .OrderBy(c => c.UcbkId)
            .Select(c => (int?)c.UcbkId)
            .FirstOrDefaultAsync();

    private Task<int?> GetLastChildIdAsync(int parentJobId) =>
        Context.TucJobBookings
            .Where(c => c.BookingParentId == parentJobId)
            .OrderByDescending(c => c.UcbkId)
            .Select(c => (int?)c.UcbkId)
            .FirstOrDefaultAsync();

    private static List<int> BuildIdList(int parentId, int? childId)
    {
        var ids = new List<int> { parentId };
        if (childId.HasValue)
        {
            ids.Add(childId.Value);
        }

        return ids;
    }

    private void ApplyPrebookTimezoneConversion(List<PrebookListViewModel> items)
    {
        var tenantTimeZone = _infoService.GetTenantTimeZone();

        foreach (var item in items)
        {
            if (item.Booked > SqlMinDate)
            {
                item.Booked = TimeZoneHelper.SetDateTimeWithTimeZone(item.Booked.DateTime, tenantTimeZone);
            }

            if (item.NextDueTime.HasValue && item.NextDueTime.Value > SqlMinDate)
            {
                item.NextDueTime =
                    TimeZoneHelper.SetDateTimeWithTimeZone(item.NextDueTime.Value.DateTime, tenantTimeZone);
            }
        }
    }

    private static T ParseValue<T>(string value, JobProperty property) where T : IParsable<T> =>
        T.TryParse(value, null, out var result)
            ? result
            : throw new ArgumentException(
                $"Invalid value '{value}' for property {property}. Expected type: {typeof(T).Name}.", nameof(value));

    private static string Truncate(string value, int maxLength) =>
        string.IsNullOrEmpty(value) ? value : value[..Math.Min(value.Length, maxLength)];

    private IQueryable<TucJobBooking> BuildRecurringJobQuery(RecurringJobQueryRequest request, bool isUsTenant)
    {
        var modeFilter = request.RecurringMode.HasValue
            ? (byte)request.RecurringMode.Value
            : (byte)(request.Active ? RecurringMode.Active : RecurringMode.Inactive);

        var query = Context.TucJobBookings
            .Where(j => j.RecurringMode == modeFilter && j.UcbkOneOff != true);

        // US tenants: exclude child jobs (only show parent jobs)
        if (isUsTenant)
        {
            query = query.Where(j => !j.BookingParentId.HasValue || j.BookingParentId == j.UcbkId);
        }

        if (!string.IsNullOrWhiteSpace(request.SearchText))
        {
            var searchPattern = $"%{request.SearchText}%";
            query = query.Where(j =>
                // Job identifiers
                EF.Functions.Like(j.UcbkJobNumber, searchPattern) ||
                EF.Functions.Like(j.CustomJobName, searchPattern) ||
                EF.Functions.Like(j.Barcode, searchPattern) ||
                // Client fields
                EF.Functions.Like(j.UcbkClientCode, searchPattern) ||
                EF.Functions.Like(j.UcbkClient.UcclName, searchPattern) ||
                // References
                EF.Functions.Like(j.UcbkClientRefa, searchPattern) ||
                EF.Functions.Like(j.UcbkClientRefb, searchPattern) ||
                EF.Functions.Like(j.UcbkOurRef, searchPattern) ||
                EF.Functions.Like(j.Connote, searchPattern) ||
                // Contact fields
                EF.Functions.Like(j.PickupFromContact, searchPattern) ||
                EF.Functions.Like(j.DeliverToContact, searchPattern) ||
                EF.Functions.Like(j.PickupFromPhone, searchPattern) ||
                EF.Functions.Like(j.DeliverToPhone, searchPattern) ||
                // Courier
                EF.Functions.Like(j.Courier.UccrName, searchPattern) ||
                EF.Functions.Like(j.Courier.Code, searchPattern) ||
                // Run/Schedule
                EF.Functions.Like(j.RunName, searchPattern) ||
                EF.Functions.Like(j.ScheduleName, searchPattern) ||
                // Pickup address
                EF.Functions.Like(j.PickupAddressLine1, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine2, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine3, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine4, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine5, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine6, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine7, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine8, searchPattern) ||
                // Delivery address
                EF.Functions.Like(j.DeliveryAddressLine1, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine2, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine3, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine4, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine5, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine6, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine7, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine8, searchPattern)
            );
        }

        // Apply Speed filter
        if (request.SpeedId.HasValue)
        {
            query = query.Where(j => j.UcbkSpeed == request.SpeedId.Value);
        }

        // Apply Courier filter
        if (request.CourierId.HasValue)
        {
            query = query.Where(j => j.CourierId == request.CourierId.Value);
        }

        // Apply Days of Week filter (bitwise match - job must run on at least one of the selected days)
        if (request.DaysOfWeek is > 0)
        {
            query = query.Where(j => (j.UcbkDaysInt & request.DaysOfWeek.Value) != 0);
        }

        // Apply Recurring Route filter
        if (request.RouteId.HasValue)
        {
            query = query.Where(j => j.RouteId == request.RouteId.Value);
        }

        return query;
    }

    private static IQueryable<TucJobBooking> ApplyRecurringJobSort(
        IQueryable<TucJobBooking> query,
        string order,
        string direction,
        bool applyDefaultSort)
    {
        var isDescending = direction == "desc";
        return order switch
        {
            "booked" => isDescending
                ? query.OrderByDescending(j => j.UcbkDate).ThenByDescending(j => j.UcbkTime)
                : query.OrderBy(j => j.UcbkDate).ThenBy(j => j.UcbkTime),
            "speed" => isDescending
                ? query.OrderByDescending(j => j.UcbkSpeed)
                : query.OrderBy(j => j.UcbkSpeed),
            "client" => isDescending
                ? query.OrderByDescending(j => j.UcbkClientId)
                : query.OrderBy(j => j.UcbkClientId),
            "from" => isDescending
                ? query.OrderByDescending(j => j.PickupAddressLine6)
                : query.OrderBy(j => j.PickupAddressLine6),
            "to" => isDescending
                ? query.OrderByDescending(j => j.DeliveryAddressLine6)
                : query.OrderBy(j => j.DeliveryAddressLine6),
            "courier" => isDescending
                ? query.OrderByDescending(j => j.CourierId)
                : query.OrderBy(j => j.CourierId),
            "customJobName" => isDescending
                ? query.OrderByDescending(j => j.CustomJobName)
                : query.OrderBy(j => j.CustomJobName),
            "nextDueTime" => isDescending
                ? query.OrderByDescending(j => j.UcbkNextDue)
                : query.OrderBy(j => j.UcbkNextDue),
            _ => applyDefaultSort
                ? query.OrderByDescending(j => j.UcbkDate).ThenByDescending(j => j.UcbkTime)
                : query
        };
    }

    internal sealed record TemplatePricing(
        int UcbkId,
        int? BookingParentId,
        decimal? RawBaseAmount,
        decimal? UcbkAmount,
        decimal? FuelSurchargeAmount,
        bool RatedManually);

    internal sealed record RepriceGroup(decimal RawBaseAmount, IReadOnlyList<int> JobIds);

    internal sealed record RepricePlan(
        IReadOnlyDictionary<int, decimal> SelfHealTemplateRawBases,
        IReadOnlyList<RepriceGroup> Groups,
        int RepricedJobCount);
}