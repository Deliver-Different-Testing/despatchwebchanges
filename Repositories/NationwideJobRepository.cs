using System.Collections.Concurrent;
using System.Diagnostics;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class NationwideJobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService,
    IInboundAgentLinkService inboundAgentLinkService)
    : BaseJobRepository(contextFactory, infoService, clock, clearListEnvelopeService), INationwideJobRepository
{
    private readonly ITenantClock _clock = clock;
    private readonly ITenantInfoService _infoService = infoService;

    public async Task AddJobNationwideAsync(AssignFlightToJobRequest requestData,
        IReadOnlyList<string> webhookIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(webhookIds);

        if (requestData.FlightSegments.Count == 0)
        {
            Log.Error("No flight segments found for JobId: {JobId}", requestData.JobId);
            return;
        }

        var hasExistingFlight = await Context.TucJobNationwides.AnyAsync(
            n => n.UcnwJobId == requestData.JobId, cancellationToken);
        if (hasExistingFlight)
        {
            throw new InvalidOperationException(
                $"Job {requestData.JobId} already has a flight assigned");
        }

        var isUsCustomer = _infoService.IsUsTenant();

        // Get the primary flight (first leg) and last flight
        var orderedSegments = requestData.FlightSegments.OrderBy(f => f.SegmentOrder).ToList();
        var primaryFlight = orderedSegments.First();
        var lastFlight = orderedSegments.Last();
        var primaryFlightNumber = primaryFlight.FlightNumber;

        Log.Information(
            "Starting AddJobNationwideAsync for JobId: {JobId}, PrimaryFlight: {PrimaryFlightNumber}, TotalSegments: {SegmentCount}",
            requestData.JobId, primaryFlightNumber, requestData.FlightSegments.Count);

        ArgumentException.ThrowIfNullOrWhiteSpace(primaryFlight.CarrierFsCode);
        ArgumentException.ThrowIfNullOrWhiteSpace(primaryFlight.FlightNumber);

        var strategy = Context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                Log.Debug("Fetching job details for JobId: {JobId}, PrimaryFlight: {PrimaryFlightNumber}",
                    requestData.JobId, primaryFlightNumber);

                var job = await Context.TucJobs
                    .AsTracking()
                    .Include(j => j.Parent)
                    .Where(j => j.UcjbId == requestData.JobId)
                    .FirstOrDefaultAsync(cancellationToken);
                ArgumentNullException.ThrowIfNull(job);

                var timeZoneLookup = await BuildTimeZoneLookupAsync(cancellationToken);

                Log.Information(
                    "Job {JobNumber} retrieved for PrimaryFlight: {PrimaryFlightNumber}, ClientId: {ClientId}",
                    job.UcjbNumber, primaryFlightNumber, job.UcjbClientId);

                var firstFlightDepartureTimeZoneId =
                    GetTimeZoneId(timeZoneLookup, primaryFlight.DepartureAirportTimeZone);
                var lastFlightArrivalTimeZoneId = GetTimeZoneId(timeZoneLookup, lastFlight.ArrivalAirportTimeZone);

                var departureAirportId = requestData.FromAirportId ?? job.FromAirportId;
                if (!departureAirportId.HasValue)
                {
                    throw new InvalidOperationException(
                        "Departure airport ID is required but was not set on the job or request.");
                }

                var arrivalAirportId = requestData.ToAirportId ?? job.ToAirportId;
                if (!arrivalAirportId.HasValue)
                {
                    throw new InvalidOperationException(
                        "Arrival airport ID is required but was not set on the job or request.");
                }

                var airports = await GetAirportAddressInfosAsync(
                    [departureAirportId.Value, arrivalAirportId.Value]);

                Log.Debug(
                    "Processing airports for PrimaryFlight: {PrimaryFlightNumber}, DepartureAirportId: {DepartureAirportId}, ArrivalAirportId: {ArrivalAirportId}",
                    primaryFlightNumber, departureAirportId, arrivalAirportId);

                // Update flight job status
                UpdateFlightJobStatus(job, primaryFlight);

                // Update pickup job if applicable
                if (job.FromAirportId != null || requestData.FromAirportId != null)
                {
                    var pickUpJob = await FindRelatedAgentJobAsync(job.ParentId, NationwideJobConstants.PickupJobSuffix,
                        isUsCustomer);
                    await UpdatePickupJobAsync(pickUpJob, primaryFlight, departureAirportId.Value,
                        firstFlightDepartureTimeZoneId, airports, primaryFlightNumber);
                }

                // Update main job addresses
                job.DeliverByTime = lastFlight.ArrivalTime.DateTime;
                UpdateJobAddressWithAirportInfo(airports, job, departureAirportId.Value,
                    firstFlightDepartureTimeZoneId, false);
                UpdateJobAddressWithAirportInfo(airports, job, arrivalAirportId.Value,
                    lastFlightArrivalTimeZoneId, true);

                // Update delivery job if applicable
                Log.Information(
                    "Checking delivery job update: job.ToAirportId={ToAirportId}, requestData.ToAirportId={RequestToAirportId}, job.ParentId={ParentId}",
                    job.ToAirportId, requestData.ToAirportId, job.ParentId);

                if (job.ToAirportId != null || requestData.ToAirportId != null)
                {
                    var deliveryJob = await FindRelatedAgentJobAsync(job.ParentId,
                        NationwideJobConstants.DeliveryJobSuffix,
                        isUsCustomer);

                    Log.Information("Delivery job lookup result: Found={Found}, DeliveryJobId={DeliveryJobId}",
                        deliveryJob != null, deliveryJob?.UcjbId);

                    await UpdateDeliveryJobAsync(deliveryJob, job.Parent, lastFlight, requestData,
                        arrivalAirportId.Value, lastFlightArrivalTimeZoneId, airports, primaryFlightNumber);
                }
                else
                {
                    Log.Warning(
                        "Skipping delivery job update: Neither job.ToAirportId nor requestData.ToAirportId is set for JobId={JobId}",
                        requestData.JobId);
                }

                var currentTime = _clock.TenantNow;
                job.UcjbDispDate = currentTime;
                job.UcjbDispTime = currentTime;

                // Save TucJob updates separately from TucJobNationwide inserts.
                // Several tucJob triggers (ChangeAmount, ChangeWeight, Update_GPS) contain
                // SELECT 1 which produces extra result sets that corrupt EF Core's batch
                // reader when mixed with INSERT OUTPUT results in the same batch.
                await Context.SaveChangesAsync(cancellationToken);

                // Create all flight records
                var primaryFlightRecord = await CreateFlightRecordsAsync(
                    job, orderedSegments, webhookIds, timeZoneLookup,
                    firstFlightDepartureTimeZoneId, primaryFlightNumber);

                Log.Debug("Saving changes for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                    primaryFlightNumber, requestData.JobId);

                // Save flight records (TucJobNationwide inserts only, no trigger interference)
                await Context.SaveChangesAsync(cancellationToken);

                // Create journey record (requires primary flight record ID from first save)
                var flightStaffId = _infoService.GetStaffIdOrNull();
                var journeyRecord = new JobDeliveryJourney
                {
                    JobId = requestData.JobId,
                    FlightId = primaryFlightRecord.UcnwId,
                    ChangeType = nameof(DeliveryJourneyChangeType.FlightAssignment),
                    StaffId = flightStaffId,
                    UpdatedAt = _clock.UtcNow,
                    UpdatedByType = DeliveryJourneyUpdatedBy.TypeForStaffId(flightStaffId)
                };
                await Context.JobDeliveryJourneys.AddAsync(journeyRecord, cancellationToken);

                await SaveNoteAsync(jobId: requestData.JobId,
                    noteText: $"Flight {primaryFlight.FlightNumber} added to job {requestData.JobId}",
                    isImportant: false,
                    isRecurringJob: false,
                    noteType: NoteType.FlightUpdate,
                    saveChanges: false);

                await Context.SaveChangesAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                Log.Information(
                    "Successfully completed AddJobNationwideAsync for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}, FlightId: {FlightId}",
                    primaryFlightNumber, requestData.JobId, primaryFlightRecord.UcnwId);
            }
            catch (Exception e)
            {
                await transaction.RollbackAsync(cancellationToken);
                Log.Error(e, "An error occured adding PrimaryFlight: {PrimaryFlightNumber} to job {JobId}",
                    requestData.FlightSegments[0]?.FlightNumber,
                    requestData.JobId);
                throw;
            }
        });
    }

    public async Task<IReadOnlyList<AirportSuggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true)
    {
        const double maxDistanceMiles = 500;

        // Query 1: Get job coordinates (single row)
        var jobCoords = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => usePickup
                ? new { Latitude = j.PickUpLatitude, Longitude = j.PickUpLongitude }
                : new { Latitude = j.DeliveryLatitude, Longitude = j.DeliveryLongitude })
            .FirstOrDefaultAsync();

        if (jobCoords?.Latitude == null || jobCoords.Longitude == null)
        {
            return [];
        }

        var jobLatitude = jobCoords.Latitude.Value;
        var jobLongitude = jobCoords.Longitude.Value;

        // Coarse bounding box: ~8 degrees ≈ 550 miles latitude, adjusted for longitude
        const double boundingBoxDegrees = 8.0;
        var cosLat = Math.Cos((double)jobLatitude * Math.PI / 180.0);
        var lonDegrees = cosLat > 0.01 ? boundingBoxDegrees / cosLat : 180.0;
        var minLat = jobLatitude - (decimal)boundingBoxDegrees;
        var maxLat = jobLatitude + (decimal)boundingBoxDegrees;
        var minLon = jobLongitude - (decimal)lonDegrees;
        var maxLon = jobLongitude + (decimal)lonDegrees;

        // Query 2: Get active airports within bounding box
        var airports = await Context.TblAirports
            .Where(a => a.Active && a.Latitude != null && a.Longitude != null
                        && a.Latitude >= minLat && a.Latitude <= maxLat
                        && a.Longitude >= minLon && a.Longitude <= maxLon)
            .Select(a => new
            {
                a.AirportId,
                a.Name,
                AirportLatitude = a.Latitude!.Value,
                AirportLongitude = a.Longitude!.Value,
                TimeZone = a.Timezone
            })
            .ToListAsync();

        // Calculate distances in C#, filter and sort
        return
        [
            .. airports
                .Select(a => new
                {
                    a.AirportId,
                    a.Name,
                    Distance = DistanceCalculator.CalculateDistance(
                        jobLatitude,
                        jobLongitude,
                        a.AirportLatitude,
                        a.AirportLongitude),
                    Timezone = a.TimeZone
                })
                .Where(result => result.Distance <= maxDistanceMiles)
                .OrderBy(result => result.Distance)
                .Select(result => new AirportSuggestion
                {
                    Id = result.AirportId,
                    Text = $"{result.Name} ({result.Distance} mi)",
                    Timezone = result.Timezone
                })
        ];
    }

    public async Task<IReadOnlyList<AgentViewModel>> GetAgentsAsync(int jobId)
    {
        var job = await GetJobDetailsAsync(jobId);
        ArgumentNullException.ThrowIfNull(job);

        Log.Information(
            "Job details retrieved for {JobId}: AirportId={AirportId}, VehicleSizeId={VehicleSizeId}",
            jobId, job.AirPortId, job.VehicleSizeId);

        var agents = await GetEligibleAgentsAsync(job.AirPortId, job.VehicleSizeId);
        Log.Information("Found {AgentCount} eligible agents for job {JobId}",
            agents?.Count ?? 0, jobId);

        var results = await ProcessAgentsInParallelAsync(job, agents);
        Log.Information("Processed {ResultCount} agents with rates for job {JobId}",
            results?.Count ?? 0, jobId);

        return results;
    }

    public async Task<AgentInboundEmailResult> AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false,
        string emailSubject = null, string emailBody = null)
    {
        var job = await Context.TucJobs
            .AsTracking()
            .FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        var currentDate = _clock.TenantNow;
        var isDepartureAirportAgent = job.FromAirportId != null && job.ToAirportId == null;
        var isGroundJob = !string.IsNullOrEmpty(job.UcjbNumber) && !char.IsDigit(job.UcjbNumber.Last());

        job.AgentId = agentId;
        job.UcjbStatus = isGroundJob ? (int)JobStatus.GroundAgentAssigned
            : isDepartureAirportAgent ? (int)JobStatus.InboundAgentAssigned
            : (int)JobStatus.OutboundAgentAssigned;

        job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
        job.UcjbDispDate = currentDate;
        job.UcjbDispTime = currentDate;

        // Get Agent Name
        var agentName = await GetAgentNameAsync(agentId);

        if (includeStopJobs)
        {
            var mainJobNumber = job.UcjbNumber;
            ArgumentException.ThrowIfNullOrEmpty(mainJobNumber);

            // Stop jobs have the pattern: mainJobNumber + letter (e.g., KT22451a, KT22451b, KT22451c)
            // Query stop jobs directly instead of using eager-loaded includes
            var parentId = job.ParentId ?? job.UcjbId;
            var stopJobs = await Context.TucJobs
                .AsTracking()
                .Where(j => j.ParentId == parentId &&
                            j.UcjbId != jobId &&
                            j.UcjbNumber != null &&
                            j.UcjbNumber.StartsWith(mainJobNumber) &&
                            j.UcjbNumber.Length == mainJobNumber.Length + 1)
                .ToListAsync();

            foreach (var stopJob in stopJobs.Where(j => char.IsLetter(j.UcjbNumber!.Last())))
            {
                stopJob.AgentId = agentId;
                stopJob.UcjbStatus = isGroundJob ? (int)JobStatus.GroundAgentAssigned
                    : isDepartureAirportAgent ? (int)JobStatus.InboundAgentAssigned
                    : (int)JobStatus.OutboundAgentAssigned;
                stopJob.UcjbDispDate = currentDate;
                stopJob.UcjbDispTime = currentDate;

                var stopJobNote = new TucNote
                {
                    JobId = stopJob.UcjbId,
                    NoteTypeId = (int)NoteType.AgentUpdate,
                    NoteText = $"Agent {agentName} assigned",
                    CreatedBy = _infoService.GetStaffId(),
                    CreatedDate = currentDate,
                    CreatedDateUtc = _clock.UtcNow
                };

                await Context.AddAsync(stopJobNote);
            }
        }

        // Note Record
        var note = new TucNote
        {
            JobId = jobId,
            NoteTypeId = (int)NoteType.AgentUpdate,
            NoteText = $"Agent {agentName} assigned",
            CreatedBy = _infoService.GetStaffId(),
            CreatedDate = currentDate,
            CreatedDateUtc = _clock.UtcNow
        };
        await Context.TucNotes.AddAsync(note);

        var agentStaffId = _infoService.GetStaffIdOrNull();
        var journeyRecord = new JobDeliveryJourney
        {
            JobId = jobId,
            NewAgentId = agentId,
            UpdatedAt = DateTime.UtcNow,
            ChangeType = nameof(DeliveryJourneyChangeType.AgentAssignment),
            StaffId = agentStaffId,
            UpdatedByType = DeliveryJourneyUpdatedBy.TypeForStaffId(agentStaffId)
        };
        await Context.AddAsync(journeyRecord);

        await Context.SaveChangesAsync();

        // Best-effort: email the agent a link to the job in the inbound-agent portal.
        // The assignment is already committed, so a send failure must not unwind it. Only
        // send when there is actually a link to include (agent email + InboundUrl present).
        try
        {
            var preview = await EvaluateAgentInboundEmailAsync(agentId, jobId);
            if (preview.WillEmail)
            {
                await SendAgentRequestMessageAsync(agentId, jobId, emailSubject, emailBody);
            }

            return preview;
        }
        catch (Exception ex)
        {
            Log.Warning(ex,
                "Job {JobId}: failed to email agent {AgentId} the inbound link (best-effort, ignored)",
                jobId, agentId);
            return new AgentInboundEmailResult(AgentInboundEmailStatus.Failed, null);
        }
    }

    public Task<AgentInboundEmailResult> GetAgentInboundEmailPreviewAsync(int agentId, int jobId) =>
        EvaluateAgentInboundEmailAsync(agentId, jobId);

    /// <inheritdoc />
    public async Task<IReadOnlyList<BulkAssignmentResult>> AssignAgentToJobsAsync(int agentId,
        IReadOnlyList<int> jobIds, bool includeStopJobs = false,
        string emailSubject = null, string emailBody = null)
    {
        var results = new List<BulkAssignmentResult>(jobIds.Count);

        foreach (var jobId in jobIds)
        {
            try
            {
                // Same gate the single-job UI enforces before assigning — a job whose
                // flight leg has no flight booked cannot take an agent yet.
                if (!await CanAssignAgentToJobAsync(jobId))
                {
                    results.Add(new BulkAssignmentResult(jobId, false,
                        "A flight must be assigned to the flight portion before an agent can be assigned.",
                        null));
                    continue;
                }

                var email = await AddAgentToJobAsync(agentId, jobId, includeStopJobs, emailSubject, emailBody);
                results.Add(new BulkAssignmentResult(jobId, true, null, email.Status));
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Bulk agent assignment: job {JobId} failed, continuing with the batch", jobId);
                results.Add(new BulkAssignmentResult(jobId, false, ex.Message, null));
            }
        }

        return results;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<BulkAssignmentResult>> AssignNpAgentToJobsAsync(int npAgentId,
        IReadOnlyList<int> jobIds)
    {
        var results = new List<BulkAssignmentResult>(jobIds.Count);

        foreach (var jobId in jobIds)
        {
            try
            {
                await AssignNpAgentToJobAsync(npAgentId, jobId);
                results.Add(new BulkAssignmentResult(jobId, true, null, null));
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Bulk network partner assignment: job {JobId} failed, continuing with the batch",
                    jobId);
                results.Add(new BulkAssignmentResult(jobId, false, ex.Message, null));
            }
        }

        return results;
    }

    /// <inheritdoc />
    public async Task AssignNpAgentToJobAsync(int npAgentId, int jobId)
    {
        var agent = await Context.TucAgents
            .FirstOrDefaultAsync(a => a.UcagId == npAgentId);
        ArgumentNullException.ThrowIfNull(agent);

        if (!agent.IsNetworkPartner)
        {
            throw new ArgumentException(
                $"Agent {npAgentId} is not a network partner.", nameof(npAgentId));
        }

        var job = await Context.TucJobs
            .AsTracking()
            .FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        // Deliberately narrow: NpAgentId drives the network partner's row-level
        // visibility (see the tucJob query filter), so the courier-facing status
        // and dispatch stamps stay exactly as they were.
        job.NpAgentId = npAgentId;

        var staffId = _infoService.GetStaffIdOrNull();

        await Context.TucNotes.AddAsync(new TucNote
        {
            JobId = jobId,
            NoteTypeId = (int)NoteType.AgentUpdate,
            NoteText = $"Network partner {agent.UcagName} assigned",
            CreatedBy = _infoService.GetStaffId(),
            CreatedDate = _clock.TenantNow,
            CreatedDateUtc = _clock.UtcNow
        });

        await Context.AddAsync(new JobDeliveryJourney
        {
            JobId = jobId,
            NewAgentId = npAgentId,
            UpdatedAt = DateTime.UtcNow,
            ChangeType = nameof(DeliveryJourneyChangeType.NetworkPartnerAssignment),
            StaffId = staffId,
            UpdatedByType = DeliveryJourneyUpdatedBy.TypeForStaffId(staffId)
        });

        await Context.SaveChangesAsync();
    }

    public async Task<JobSearchResult> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant,
        string clientIds, NationwideWidget windowPane,
        IReadOnlyList<int> selectedViewIds,
        CancellationToken cancellationToken = default)
    {
        if (!isInternal && string.IsNullOrEmpty(clientIds))
        {
            return new JobSearchResult
            {
                Jobs = [],
                TotalCount = 0,
                HasMore = false
            };
        }

        return await DespatchQry(
            AppPage.Domestic,
            queryParams,
            isInternal,
            isUsTenant,
            clientIds,
            selectedViewIds,
            windowPane,
            cancellationToken: cancellationToken);
    }

    public async Task<IReadOnlyList<AirlineSuggestion>> GetActiveAirlineOptionsAsync() =>
        await Context.FlightCarriers
            .Where(fc => fc.IsActive)
            .Select(x => new AirlineSuggestion
            {
                Id = x.FlightCarrierId,
                Text = x.CarrierCode,
                FullAirlineName = x.FlightCarrierName
            })
            .ToListAsync();

    public async Task<string> GetAirlineCodeByIdAsync(int airlineId) =>
        await Context.FlightCarriers
            .Where(fc => fc.FlightCarrierId == airlineId)
            .Select(fc => fc.CarrierCode)
            .FirstOrDefaultAsync();

    public async Task SendAgentRequestMessageAsync(int agentId, int jobId, string emailSubject = null,
        string emailBody = null)
    {
        var agentEmail = await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => a.UcagFax)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(agentEmail))
        {
            Log.Information("Agent {AgentId} has no email; skipping agent message for job {JobId}",
                agentId, jobId);
            return;
        }

        var replyToAddress = Environment.GetEnvironmentVariable("ReplyToEmailAddress")
                             ?? "support@deliverdifferent.com";

        var staffId = _infoService.GetStaffId();

        var jobData = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                j.UcjbNumber,
                j.ParentId,
                DeliveryCompany = j.DeliveryAddressLine1,
                DeliveryStreetNumber = j.DeliveryAddressLine3,
                DeliveryStreetName = j.DeliveryAddressLine4,
                DeliveryCity = j.DeliveryAddressLine6,
                j.UcjbQty,
                j.UcjbWeight,
                DeliveryContactName = j.DeliverToContact,
                DeliveryContactPhone = j.DeliverToPhone
            })
            .FirstOrDefaultAsync();
        ArgumentNullException.ThrowIfNull(jobData);

        // Flight legs are stored against the flight job, but the agent is usually assigned to a
        // sibling (pickup/delivery) job under the same parent. Resolve the leg across the whole
        // family so the flight tokens fill regardless of which family member was emailed.
        // Final arrival leg = latest ETA, then latest leg number.
        var parentId = jobData.ParentId ?? jobId;
        var finalLeg = await Context.TucJobNationwides
            .Where(n => Context.TucJobs
                .Where(j => j.UcjbId == parentId || j.ParentId == parentId)
                .Select(j => (int?)j.UcjbId)
                .Contains(n.UcnwJobId))
            .OrderByDescending(n => n.UcnwEta)
            .ThenByDescending(n => n.UcnwLegNumber)
            .Select(n => new { n.UcnwFlightNo, n.UcnwEta, n.DepartureAirportCity })
            .FirstOrDefaultAsync();

        var agentName = await GetAgentNameAsync(agentId);
        var inboundUrl = await inboundAgentLinkService.BuildJobLinkAsync(jobId) ?? string.Empty;

        var weightUnit = _infoService.IsUsTenant() ? "lb" : "kg";

        var tokens = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["AgentName"] = agentName ?? string.Empty,
            ["JobNumber"] = jobData.UcjbNumber ?? string.Empty,
            ["DeliveryCompany"] = jobData.DeliveryCompany ?? string.Empty,
            ["DeliveryStreetNumber"] = jobData.DeliveryStreetNumber ?? string.Empty,
            ["DeliveryStreetName"] = jobData.DeliveryStreetName ?? string.Empty,
            ["DeliveryCity"] = jobData.DeliveryCity ?? string.Empty,
            ["InboundUrl"] = inboundUrl,
            ["FlightNumber"] = finalLeg?.UcnwFlightNo ?? string.Empty,
            ["FlightETA"] = _infoService.FormatDateForTenant(finalLeg?.UcnwEta) ?? string.Empty,
            ["FromSuburbCity"] = finalLeg?.DepartureAirportCity ?? string.Empty,
            ["Quantity"] = jobData.UcjbQty?.ToString() ?? string.Empty,
            ["Weight"] = jobData.UcjbWeight.HasValue
                ? $"{jobData.UcjbWeight.Value} {weightUnit}"
                : string.Empty,
            ["DeliveryContactName"] = jobData.DeliveryContactName ?? string.Empty,
            ["DeliveryContactPhone"] = jobData.DeliveryContactPhone ?? string.Empty
        };

        var subject = AgentEmailTemplates.Substitute(
            string.IsNullOrWhiteSpace(emailSubject) ? AgentEmailTemplates.DefaultSubject : emailSubject, tokens);
        var body = AgentEmailTemplates.Substitute(
            string.IsNullOrWhiteSpace(emailBody) ? AgentEmailTemplates.DefaultBody : emailBody, tokens);

        // The external mailer sends the body as HTML, so render the plain-text template into a
        // branded, inline-styled fragment; otherwise the newlines collapse onto a single line.
        var htmlBody = AgentEmailTemplates.RenderHtmlBody(body, inboundUrl);

        var request = new TucManualMessage
        {
            JobId = jobId,
            Subject = subject,
            ReplyToEmailAddress = replyToAddress,
            UcmmMessage = htmlBody,
            UcmmStaffId = staffId,
            SendToEmailAddress = agentEmail
        };

        await Context.AddAsync(request);
        await Context.SaveChangesAsync();
    }

    public async Task RestoreNationwideJobAsync(int jobId)
    {
        // First, verify the job exists
        var jobExists = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);
        if (!jobExists)
        {
            throw new ArgumentException($"Job with ID {jobId} not found", nameof(jobId));
        }

        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbStatus, (int)JobStatus.New)
                .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.NewJobs)
                .SetProperty(j => j.UcjbJobDone, false)
                .SetProperty(j => j.UcjbVoid, false)
                .SetProperty(j => j.UcjbCourierId, (int?)null)
                .SetProperty(j => j.UcjbDispDate, (DateTime?)null)
                .SetProperty(j => j.UcjbDispTime, (DateTime?)null)
                .SetProperty(j => j.UcjbPaged, false)
                .SetProperty(j => j.UcjbPagedTime, (DateTime?)null)
                .SetProperty(j => j.UcjbComplTime, (DateTime?)null)
                .SetProperty(j => j.UcjbMobileSend, false)
                .SetProperty(j => j.AutoDespatch, false)
                .SetProperty(j => j.PickRunOrder, (int?)null)
                .SetProperty(j => j.DropRunOrder, (int?)null)
                .SetProperty(j => j.DesCheck, false)
                .SetProperty(j => j.FdcourierId, (int?)null)
                .SetProperty(j => j.FirstJob, false)
                .SetProperty(j => j.AgentId, (int?)null)
                .SetProperty(j => j.UcjbFlightDetails, string.Empty));

        // Get flight IDs for cascade deletion
        var flightIds = await Context.TucJobNationwides
            .Where(flight => flight.UcnwJobId == jobId)
            .Select(flight => flight.UcnwId)
            .ToListAsync();

        if (flightIds.Count != 0)
        {
            // Delete delivery journeys linked to these flights
            await Context.JobDeliveryJourneys
                .Where(journey => journey.FlightId.HasValue && flightIds.Contains(journey.FlightId.Value))
                .ExecuteDeleteAsync();

            // Delete the flight records
            await Context.TucJobNationwides
                .Where(flight => flight.UcnwJobId == jobId)
                .ExecuteDeleteAsync();
        }

        // Remove read tracker record
        await Context.TucJobReadTrackers
            .Where(tracker => tracker.JobId == jobId)
            .ExecuteDeleteAsync();

        // Make a note of restore
        await SaveNoteAsync(jobId, "Job restored", true);
    }

    public async Task<IReadOnlyList<Suggestion>> GetAllAgentOptionsBySearchAsync(
        string searchTerm,
        bool? isNetworkPartner = null)
    {
        var query = Context.TucAgents.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(a => a.UcagName.Contains(searchTerm));
        }

        // 3-way Assign Route picker (HANDOVER-KEVIN-2026-05-26.md):
        //   null  → all agents (existing Nationwide behaviour, untouched)
        //   false → regular agents only (Agent radio)
        //   true  → Network Partners only (NP radio)
        if (isNetworkPartner.HasValue)
        {
            var npFlag = isNetworkPartner.Value;
            query = query.Where(a => a.IsNetworkPartner == npFlag);
        }

        var agents = await query
            .Select(a => new Suggestion
            {
                Id = a.UcagId,
                Text = a.UcagName
            })
            .OrderBy(a => a.Text)
            .ToListAsync();

        return agents;
    }

    public async Task<IReadOnlyList<string>> GetFlightWebhookIdByJobIdAsync(int jobId) =>
        await Context.TucJobNationwides
            .Where(nj => nj.UcnwJobId == jobId)
            .Select(nj => nj.WebhookAlertId)
            .Distinct()
            .ToListAsync();

    public async Task<IReadOnlyList<SavedFlightCandidate>> GetSavedFlightCandidatesAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds is null || jobIds.Count == 0)
        {
            return [];
        }

        var rows = await (
            from j in Context.TucJobs
            where jobIds.Contains(j.UcjbId) && j.BookingParentId != null
            join b in Context.TucJobBookings on j.BookingParentId equals b.UcbkId
            where b.SavedFlightNumber != null && b.SavedFlightNumber != ""
                                              && b.FromAirportId != null && b.ToAirportId != null
            select new
            {
                JobId = j.UcjbId,
                b.FromAirportId,
                b.ToAirportId,
                b.SavedFlightNumber,
                j.UcjbDate,
                j.UcjbTime
            }).ToListAsync();

        return
        [
            .. rows
                .Select(r => new SavedFlightCandidate
                {
                    JobId = r.JobId,
                    FromAirportId = r.FromAirportId,
                    ToAirportId = r.ToAirportId,
                    SavedFlightNumber = r.SavedFlightNumber,
                    // Wall-clock departure: date column + time-of-day column, zero
                    // offset so the search keys off the right calendar date.
                    DepartureDate = new DateTimeOffset(
                        r.UcjbTime.HasValue
                            ? r.UcjbDate.Date.Add(r.UcjbTime.Value.TimeOfDay)
                            : r.UcjbDate,
                        TimeSpan.Zero)
                })
        ];
    }

    public async Task<AgentInfoDialogViewModel> GetAgentInfoForDialogAsync(int agentId) =>
        await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => new AgentInfoDialogViewModel
            {
                AgentId = a.UcagId,
                AgentEmail = a.UcagFax,
                AgentPhone = a.UcagPhone,
                AgentName = a.UcagName,
                AgentNotes = a.UcagNotes,
                AgentRanking = a.Ranking != null ? a.Ranking.AgentRankingName : string.Empty,
                Address = new AddressViewModel(
                    a.AddressLine1,
                    a.AddressLine2,
                    a.AddressLine3,
                    a.AddressLine4,
                    a.AddressLine5,
                    a.AddressLine6,
                    a.AddressLine7,
                    a.AddressLine8),
                Airports = a.AgentVehicles.Count != 0
                    ? a.AgentVehicles.Select(av => new AirportViewModel
                    {
                        Name = av.Airport.Name,
                        Code = av.Airport.AirportCode,
                        City = av.Airport.AddressLine5,
                        Country = av.Airport.AddressLine8,
                        Latitude = (double)av.Airport.Latitude,
                        Longitude = (double)av.Airport.Longitude,
                        Timezone = av.Airport.Timezone
                    }).ToList()
                    : new List<AirportViewModel>()
            })
            .FirstOrDefaultAsync();

    public async Task<FlightRateCalculationDto> GetFlightRateCalculationDtoAsync(int jobId, string carrierCode,
        bool extraStopOffs, DateTime? bookTime) =>
        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new FlightRateCalculationDto
            {
                ClientId = j.UcjbClientId ?? 0,
                FromCity = j.PickupAddressLine5,
                FromState = j.PickupAddressLine6,
                ToCity = j.DeliveryAddressLine5,
                ToState = j.DeliveryAddressLine6,
                CarrierCode = carrierCode,
                TotalWeight = j.UcjbWeight.HasValue ? (decimal)j.UcjbWeight.Value : 0,
                Quantity = j.UcjbQty ?? 0,
                TotalPallets = j.TucJobItemJobs != null ? j.TucJobItemJobs.Count : 0,
                ExtraStopOffs = extraStopOffs ? 1 : 0,
                BookTime = bookTime,
                VehicleSizeId = j.UcjbSize ?? 0,
                DangerousGoods = j.Dgdocument ?? false,
                DryIceWeight = j.DryIceWeight ?? 0,
                PickupWaitTime = j.WaitedPickUp ?? 0,
                DeliveryWaitTime = j.WaitedDelivery ?? 0,
                Ppd = 0
            })
            .FirstOrDefaultAsync();

    public async Task<string> GetAgentNameAsync(int agentId) =>
        await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => a.UcagName)
            .FirstOrDefaultAsync();

    public async Task<RecoveryAgentJobViewModel> GetRecoveryAgentDialogDataAsync(int jobId)
    {
        var recoveryAgentData = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new RecoveryAgentJobViewModel
            {
                JobId = j.UcjbId,
                JobNumber = j.UcjbNumber,
                AssignedAgent = j.Agent != null
                    ? new Suggestion
                    {
                        Id = j.Agent.UcagId,
                        Text = j.Agent.UcagName
                    }
                    : null,
                PickUpAddress = new AddressViewModel(
                    j.PickupAddressLine1,
                    j.PickupAddressLine2,
                    j.PickupAddressLine3,
                    j.PickupAddressLine4,
                    j.PickupAddressLine5,
                    j.PickupAddressLine6,
                    j.PickupAddressLine7,
                    j.PickupAddressLine8),
                DeliveryAddress = new AddressViewModel(
                    j.DeliveryAddressLine1,
                    j.DeliveryAddressLine2,
                    j.DeliveryAddressLine3,
                    j.DeliveryAddressLine4,
                    j.DeliveryAddressLine5,
                    j.DeliveryAddressLine6,
                    j.DeliveryAddressLine7,
                    j.DeliveryAddressLine8),
                PackageType = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : "Unknown",
                Priority = "High",
                LastKnownLocation = "Unknown",
                Customer = j.UcjbClient != null ? j.UcjbClient.UcclName : "Unknown",
                RecoveryJobs = j.Parent != null
                    ? j.Parent.InverseParent
                        .Where(rj => EF.Functions.Like(rj.UcjbNumber, "%R_"))
                        .Select(rj => new RecoveryJobViewModel
                        {
                            JobId = rj.UcjbId,
                            AssignedAgent = rj.Agent != null
                                ? new Suggestion
                                {
                                    Id = rj.Agent.UcagId,
                                    Text = rj.Agent.UcagName
                                }
                                : null,
                            RecoveryAgents = rj.JobRecoveryAgents.Count != 0
                                ? rj.JobRecoveryAgents.Select(ra => new RecoveryAgentViewModel
                                {
                                    RecoveryId = ra.RecoveryId,
                                    AgentName = ra.Agent != null ? ra.Agent.UcagName : null,
                                    Airport = ra.Airport != null ? ra.Airport.Name : null,
                                    PrimaryRecoveryAgent = ra.IsPrimary,
                                    AssignStatus = ra.IsActive ? "Currently Assigned" : "Not Assigned"
                                })
                                : null
                        })
                    : j.InverseParent
                        .Where(rj => EF.Functions.Like(rj.UcjbNumber, "%R_"))
                        .Select(rj => new RecoveryJobViewModel
                        {
                            JobId = rj.UcjbId,
                            AssignedAgent = rj.Agent != null
                                ? new Suggestion
                                {
                                    Id = rj.Agent.UcagId,
                                    Text = rj.Agent.UcagName
                                }
                                : null,
                            RecoveryAgents = rj.JobRecoveryAgents.Select(ra => new RecoveryAgentViewModel
                            {
                                RecoveryId = ra.RecoveryId,
                                AgentName = ra.Agent != null ? ra.Agent.UcagName : null,
                                Airport = ra.Airport != null ? ra.Airport.Name : null,
                                PrimaryRecoveryAgent = ra.IsPrimary,
                                AssignStatus = ra.IsActive ? "Currently Assigned" : "Not Assigned"
                            })
                        })
            })
            .FirstOrDefaultAsync();

        return recoveryAgentData;
    }

    public async Task<IReadOnlyList<Suggestion>> GetAgentOptionsByAirportAsync(int airportId) =>
        await Context.TblAirports
            .Where(a => a.AirportId == airportId)
            .SelectMany(a => a.AgentVehicles)
            .Select(agentVehicle => new Suggestion
            {
                Id = agentVehicle.Agent.UcagId,
                Text = agentVehicle.Agent.UcagName
            })
            .Distinct()
            .ToListAsync();

    public async Task<IReadOnlyList<Suggestion>> GetAllActiveAirportsWithAgentsAsync() =>
        await Context.TblAirports
            .Where(a => a.Active && a.AgentVehicles.Any())
            .Select(a => new Suggestion
            {
                Id = a.AirportId,
                Text = a.Name
            })
            .ToListAsync();

    public async Task<IReadOnlyList<Suggestion>> GetAllActiveAirportSuggestionsAsync() =>
        await Context.TblAirports
            .Where(a => a.Active)
            .Select(a => new Suggestion
            {
                Id = a.AirportId,
                Text = a.Name
            })
            .ToListAsync();

    public async Task UpdateRecoveryAgentAsync(UpdateAgentRecoveryRequest request)
    {
        var recoveryAgent = await Context.JobRecoveryAgents.FindAsync(request.RecoveryId);
        ArgumentNullException.ThrowIfNull(recoveryAgent);

        if (request.IsPrimaryRecoveryAgent)
        {
            // Get the job ID through the recovery job relationship
            var recoveryJob = await Context.TucJobs
                .FirstOrDefaultAsync(j => j.JobRecoveryAgents
                    .Any(ra => ra.RecoveryId == request.RecoveryId));

            if (recoveryJob != null)
            {
                // Find the parent job (main job) to get all related recovery jobs
                var parentJobId = recoveryJob.ParentId ?? recoveryJob.UcjbId;

                // Remove primary status from all other recovery agents in related recovery jobs
                var otherPrimaryAgents = await Context.JobRecoveryAgents
                    .AsTracking()
                    .Where(ra => ra.Job.ParentId == parentJobId &&
                                 ra.RecoveryId != request.RecoveryId &&
                                 ra.IsPrimary)
                    .ToListAsync();

                foreach (var agent in otherPrimaryAgents)
                {
                    agent.IsPrimary = false;
                }

                // Also check recovery jobs where the parent job is the main job
                var childJobPrimaryAgents = await Context.JobRecoveryAgents
                    .AsTracking()
                    .Where(ra => ra.Job.UcjbId != parentJobId &&
                                 ra.Job.ParentId == parentJobId &&
                                 ra.RecoveryId != request.RecoveryId &&
                                 ra.IsPrimary)
                    .ToListAsync();

                foreach (var agent in childJobPrimaryAgents)
                {
                    agent.IsPrimary = false;
                }
            }
        }

        // Update the recovery agent
        recoveryAgent.IsPrimary = request.IsPrimaryRecoveryAgent;
        recoveryAgent.UpdatedOn = _clock.TenantNow;

        await Context.SaveChangesAsync();
    }

    public async Task RemoveRecoveryAgentAsync(int recoveryId)
    {
        // Check if this is the only recovery agent on the job
        var recoveryJob = await Context.TucJobs
            .Include(j => j.JobRecoveryAgents)
            .FirstOrDefaultAsync(j => j.JobRecoveryAgents.Any(ra => ra.RecoveryId == recoveryId));
        ArgumentNullException.ThrowIfNull(recoveryJob);

        // Get the recovery agent to remove
        var recoveryAgent = await Context.JobRecoveryAgents.FindAsync(recoveryId);
        ArgumentNullException.ThrowIfNull(recoveryAgent);


        // Remove the recovery agent
        Context.JobRecoveryAgents.Remove(recoveryAgent);

        await Context.SaveChangesAsync();
    }

    public async Task<string> GetWebhookEventsAsStringAsync()
    {
        var webhookEvents = await Context.FlightWebhookEventTypes
            .Where(e => e.IsActive && e.IsEnabled)
            .Select(e => new WebhookEventDto
            {
                EventCode = e.EventCode,
                AdditionalParameter = e.RequiresParameter ? e.ParameterValue : null
            })
            .ToListAsync();

        var eventStrings = webhookEvents.Select(e => e.AdditionalParameter != null
            ? $"{e.EventCode}{e.AdditionalParameter}"
            : e.EventCode);

        return string.Join(",", eventStrings);
    }

    public async Task<FlightCargoProcessingModel> CalculateCargoReadyTimeAsync(
        int jobId,
        string carrierFsCode,
        DateTime flightArrivalTime)
    {
        var now = _clock.TenantNow;

        // Fetch cargo data including the arrival airport's timezone
        var cargoData = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                j.DeliverByTime,
                ProcessingTimeMins = j.ToAirport.ProcessingTime ?? 60, // Default to 60 minutes if not set
                CargoOpeningTime = j.ToAirport.CargoFacilities
                    .Where(c => c.Carrier.CarrierCode == carrierFsCode)
                    .Select(c => c.OpeningTime)
                    .FirstOrDefault(),
                CargoClosingTime = j.ToAirport.CargoFacilities
                    .Where(c => c.Carrier.CarrierCode == carrierFsCode)
                    .Select(c => c.ClosingTime)
                    .FirstOrDefault(),
                ArrivalAirportTimeZone = j.ToAirport.Timezone
            })
            .FirstOrDefaultAsync();

        if (cargoData == null)
        {
            return null;
        }

        // Get the arrival airport timezone, default to tenant timezone if not available
        TimeZoneInfo arrivalTimeZone;
        try
        {
            arrivalTimeZone = !string.IsNullOrEmpty(cargoData.ArrivalAirportTimeZone)
                ? TimeZoneInfo.FindSystemTimeZoneById(cargoData.ArrivalAirportTimeZone)
                : TimeZoneInfo.Local;
        }
        catch (TimeZoneNotFoundException)
        {
            Log.Warning("Timezone {TimeZone} not found for job {JobId}, using local timezone",
                cargoData.ArrivalAirportTimeZone, jobId);
            arrivalTimeZone = TimeZoneInfo.Local;
        }

        // Get the offset for the arrival airport timezone
        var arrivalOffset = arrivalTimeZone.GetUtcOffset(flightArrivalTime);

        // Determine cargo opening/closing times, using defaults if not configured
        var openingTime = cargoData.CargoOpeningTime ?? now.ResetTimeToStartOfDay();
        var closingTime = cargoData.CargoClosingTime ?? now.ResetTimeToEndOfDay();

        // Combine the arrival date with the cargo facility time portions and apply the timezone offset
        var cargoOpeningDateTime = new DateTime(
            flightArrivalTime.Year,
            flightArrivalTime.Month,
            flightArrivalTime.Day,
            openingTime.Hour,
            openingTime.Minute,
            openingTime.Second);

        var cargoClosingDateTime = new DateTime(
            flightArrivalTime.Year,
            flightArrivalTime.Month,
            flightArrivalTime.Day,
            closingTime.Hour,
            closingTime.Minute,
            closingTime.Second);

        return new FlightCargoProcessingModel
        {
            ArrivalTime = flightArrivalTime,
            DeliverByTime = cargoData.DeliverByTime,
            ProcessingTimeMins = cargoData.ProcessingTimeMins,
            CargoOpeningTime = new DateTimeOffset(cargoOpeningDateTime, arrivalOffset),
            CargoClosingTime = new DateTimeOffset(cargoClosingDateTime, arrivalOffset)
        };
    }

    public async Task<bool> CanAssignAgentToJobAsync(int agentJobId)
    {
        if (Debugger.IsAttached)
        {
            return true;
        }

        var result = await Context.TucJobs
            .Where(j => j.UcjbId == agentJobId)
            .SelectMany(j => j.Parent.InverseParent)
            .Select(siblingJob => new
            {
                HasFlightSpeedGrouping = siblingJob.UcjbSpeedNavigation != null
                                         && (siblingJob.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                                             || siblingJob.UcjbSpeedNavigation.GroupingId ==
                                             (int)UrgentSpeedGrouping.Flight),
                HasTucJobNationwides = siblingJob.TucJobNationwides.Any()
            })
            .ToListAsync();

        var flightSpeedJobs = result
            .Where(r => r.HasFlightSpeedGrouping)
            .ToList();
        return flightSpeedJobs.Count == 0
               || flightSpeedJobs.Any(job => job.HasTucJobNationwides);
    }

    public async Task<IReadOnlyList<GetAirportsDto>> GetAllActiveAirportsAsync() =>
        await Context.TblAirports
            .Where(a => a.Active)
            .Select(a => new GetAirportsDto
            {
                AirportId = a.AirportId,
                FlightBufferMinutes = a.FlightBufferMinutes,
                AirportCode = a.AirportCode,
                Timezone = a.Timezone
            })
            .ToListAsync();

    /// <inheritdoc />
    public async Task<IReadOnlyList<FlightRateDto>> GetCarrierFlightRatesAsync(FlightRateCalculationDto dto)
    {
        var results = await Context.Procedures.DD_stpGetCarrierFlightRateAsync(
            dto.ClientId,
            dto.FromCity,
            dto.FromState,
            dto.ToCity,
            dto.ToState,
            dto.CarrierCode,
            dto.TotalWeight,
            dto.Quantity,
            dto.Cubic,
            dto.TotalPallets,
            dto.ExtraStopOffs,
            dto.BookTime,
            dto.VehicleSizeId,
            dto.DangerousGoods,
            dto.DryIceWeight,
            dto.PickupWaitTime,
            dto.DeliveryWaitTime
        );

        return
        [
            .. results
                .Select(r => new FlightRateDto
                {
                    JobTypeId = r.JobTypeID ?? 0,
                    Name = r.Name ?? string.Empty,
                    Speed = r.Speed ?? string.Empty,
                    Description = r.Description ?? string.Empty,
                    Rate = r.Rate ?? 0,
                    SaleRate = r.SaleRate ?? 0,
                    Availability = r.Availability ?? string.Empty,
                    AvailabilityColour = r.AvailabilityColour ?? string.Empty,
                    BookDate = r.BookDate ?? _clock.TenantNow,
                    Duration = r.Duration,
                    FlightRate = r.FlightRate ?? 0
                })
        ];
    }

    private async Task<AgentInboundEmailResult> EvaluateAgentInboundEmailAsync(int agentId, int jobId)
    {
        var agentEmail = await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => a.UcagFax)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(agentEmail))
        {
            return new AgentInboundEmailResult(AgentInboundEmailStatus.NoAgentEmail, null);
        }

        var link = await inboundAgentLinkService.BuildJobLinkAsync(jobId);
        return string.IsNullOrWhiteSpace(link)
            ? new AgentInboundEmailResult(AgentInboundEmailStatus.NoInboundUrl, agentEmail)
            : new AgentInboundEmailResult(AgentInboundEmailStatus.Queued, agentEmail);
    }

    private static void UpdateFlightJobStatus(TucJob job, FlightSegmentViewModel primaryFlight)
    {
        Log.Debug(
            "Updating job status for PrimaryFlight: {PrimaryFlightNumber}, OldStatus: {OldStatus}, NewStatus: {NewStatus}",
            primaryFlight.FlightNumber, job.UcjbStatus, (int)JobStatus.Dispatched);

        job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
        job.UcjbStatus = (int)JobStatus.Dispatched;
        job.UcjbDate = primaryFlight.DepartureTime.DateTime;
        job.UcjbTime = primaryFlight.DepartureTime.DateTime;
    }

    private async Task<TucJob> FindRelatedAgentJobAsync(int? parentJobId, char jobSuffix, bool isUsCustomer)
    {
        if (!parentJobId.HasValue)
        {
            Log.Warning("FindRelatedAgentJobAsync: No parent job ID provided");
            return null;
        }

        var targetGroupingId = isUsCustomer
            ? (int)SpeedGrouping.Agent
            : (int)UrgentSpeedGrouping.NationwideAgent;

        Log.Debug(
            "FindRelatedAgentJobAsync: Searching for job with ParentId={ParentId}, Suffix='{Suffix}', TargetGroupingId={GroupingId}",
            parentJobId, jobSuffix, targetGroupingId);

        var agentJob = await Context.TucJobs
            .AsTracking()
            .Include(j => j.UcjbSpeedNavigation)
            .ThenInclude(s => s.Grouping)
            .Where(j => j.ParentId == parentJobId &&
                        j.UcjbNumber != null &&
                        j.UcjbNumber.EndsWith(jobSuffix.ToString()) &&
                        j.UcjbSpeedNavigation != null &&
                        j.UcjbSpeedNavigation.Grouping != null &&
                        j.UcjbSpeedNavigation.Grouping.GroupingId == targetGroupingId)
            .FirstOrDefaultAsync();

        if (agentJob == null)
        {
            // Diagnostic: Find any jobs with matching suffix to understand why they didn't match
            var candidateJobs = await Context.TucJobs
                .Include(j => j.UcjbSpeedNavigation)
                .ThenInclude(s => s.Grouping)
                .Where(j => j.ParentId == parentJobId &&
                            j.UcjbNumber != null &&
                            j.UcjbNumber.EndsWith(jobSuffix.ToString()))
                .Select(j => new
                {
                    j.UcjbId,
                    j.UcjbNumber,
                    SpeedId = j.UcjbSpeed,
                    HasSpeedNav = j.UcjbSpeedNavigation != null,
                    GroupingId = j.UcjbSpeedNavigation != null && j.UcjbSpeedNavigation.Grouping != null
                        ? j.UcjbSpeedNavigation.Grouping.GroupingId
                        : (int?)null
                })
                .ToListAsync();

            if (candidateJobs.Count != 0)
            {
                Log.Warning(
                    "FindRelatedAgentJobAsync: Found {Count} jobs with suffix '{Suffix}' for parent {ParentJobId}, but none matched grouping {TargetGroupingId}. Candidates: {@Candidates}",
                    candidateJobs.Count, jobSuffix, parentJobId, targetGroupingId, candidateJobs);
            }
            else
            {
                // Check if ANY child jobs exist for this parent
                var allChildJobs = await Context.TucJobs
                    .Where(j => j.ParentId == parentJobId)
                    .Select(j => new { j.UcjbId, j.UcjbNumber })
                    .ToListAsync();

                Log.Warning(
                    "FindRelatedAgentJobAsync: No jobs found with suffix '{Suffix}' for parent {ParentJobId}. All child jobs: {@AllChildren}",
                    jobSuffix, parentJobId, allChildJobs);
            }
        }
        else
        {
            Log.Debug("FindRelatedAgentJobAsync: Found agent job {JobNumber} (ID: {JobId}) for parent {ParentJobId}",
                agentJob.UcjbNumber, agentJob.UcjbId, parentJobId);
        }

        return agentJob;
    }

    private async Task UpdatePickupJobAsync(
        TucJob pickupJob,
        FlightSegmentViewModel primaryFlight,
        int departureAirportId,
        int? departureTimeZoneId,
        IReadOnlyList<AirportAddressInfoDto> airports,
        string primaryFlightNumber)
    {
        if (pickupJob == null)
        {
            Log.Warning("No pickup job found for PrimaryFlight: {PrimaryFlightNumber}",
                primaryFlightNumber);
            return;
        }

        Log.Information("Updating pickup job {PickupJobNumber} for PrimaryFlight: {PrimaryFlightNumber}",
            pickupJob.UcjbNumber, primaryFlightNumber);

        var airportProcessingTime = await GetAirportProcessingTimeAsync(departureAirportId);
        pickupJob.DeliverByTime = primaryFlight.DepartureTime.AddMinutes(-airportProcessingTime).DateTime;
        pickupJob.DeliverByTimeZoneId = departureTimeZoneId;

        UpdateJobAddressWithAirportInfo(airports, pickupJob, departureAirportId,
            departureTimeZoneId, true);
    }

    private async Task UpdateDeliveryJobAsync(
        TucJob deliveryJob,
        TucJob parentJob,
        FlightSegmentViewModel lastFlight,
        AssignFlightToJobRequest requestData,
        int arrivalAirportId,
        int? arrivalTimeZoneId,
        IReadOnlyList<AirportAddressInfoDto> airports,
        string primaryFlightNumber)
    {
        if (deliveryJob == null)
        {
            Log.Warning(
                "UpdateDeliveryJobAsync: No delivery job provided for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                primaryFlightNumber, requestData.JobId);
            return;
        }

        Log.Information(
            "UpdateDeliveryJobAsync: Updating delivery job {DeliveryJobNumber} (ID: {DeliveryJobId}) for PrimaryFlight: {PrimaryFlightNumber}",
            deliveryJob.UcjbNumber, deliveryJob.UcjbId, primaryFlightNumber);

        var airportProcessingTime = await GetAirportProcessingTimeAsync(arrivalAirportId);

        var packageReadyTime = requestData.PackageReadyTime ??
                               lastFlight.ArrivalTime.AddMinutes(airportProcessingTime);

        Log.Information(
            "UpdateDeliveryJobAsync: Setting delivery job start time. RequestPackageReadyTime={RequestTime}, CalculatedTime={CalculatedTime}, UsingTime={UsingTime}",
            requestData.PackageReadyTime, lastFlight.ArrivalTime.AddMinutes(airportProcessingTime), packageReadyTime);

        deliveryJob.UcjbDate = packageReadyTime.Date;
        deliveryJob.UcjbTime = packageReadyTime.DateTime;
        deliveryJob.DeliverByTime ??= requestData.PackageDeliverByTime?.DateTime;
        deliveryJob.DeliverByTimeZoneId = arrivalTimeZoneId;

        // Set parent deliver by time too
        parentJob.DeliverByTime ??= requestData.PackageDeliverByTime?.DateTime;

        // Update Pickup Address With Airport
        UpdateJobAddressWithAirportInfo(airports, deliveryJob, arrivalAirportId,
            arrivalTimeZoneId, false);

        // Add notes for agents if any added
        if (!string.IsNullOrEmpty(requestData.PackageDeliveryNotes))
        {
            Log.Debug("Adding delivery notes for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                primaryFlightNumber, requestData.JobId);

            await SaveNoteAsync(requestData.JobId, requestData.PackageDeliveryNotes, true, false,
                NoteType.DeliveryNotes, saveChanges: false);
        }
    }

    private static TucJobNationwide CreateFlightRecord(
        TucJob job,
        FlightSegmentViewModel segment,
        string webhookId,
        int legNumber,
        IReadOnlyDictionary<string, int> timeZoneLookup,
        DateTimeOffset? overrideEta = null)
    {
        Log.Debug(
            "Creating TucJobNationwide record for Flight: {FlightNumber}, Route: {DepartureAirport} -> {ArrivalAirport}, Leg: {LegNumber}",
            segment.FlightNumber, segment.DepartureAirportFsCode, segment.ArrivalAirportFsCode, legNumber);

        return new TucJobNationwide
        {
            UcnwJobId = job.UcjbId,
            UcnwJobNumber = job.UcjbNumber,
            UcnwClientId = job.UcjbClientId ?? 0,
            UcnwFlightNo = segment.CarrierFsCode + segment.FlightNumber,
            UcnwEtd = segment.DepartureTime.DateTime,
            UcnwEta = overrideEta?.DateTime ?? segment.ArrivalTime.DateTime,
            WebhookAlertId = webhookId,
            GateNumber = legNumber == NationwideJobConstants.PrimaryFlightLegNumber ? segment.DepartureTerminal : null,
            UcnwLegNumber = legNumber,
            UcnwAirlineName = segment.AirlineName,
            CarrierFsCode = segment.CarrierFsCode,
            DepartureAirportFsCode = segment.DepartureAirportFsCode,
            DepartureAirportName = segment.DepartureAirportName,
            DepartureAirportCity = segment.DepartureAirportCity,
            DepartureAirportCountry = segment.DepartureAirportCountry,
            DepartureAirportTimeZone = segment.DepartureAirportTimeZone,
            DepartureAirportTimeZoneId = GetTimeZoneId(timeZoneLookup, segment.DepartureAirportTimeZone),
            ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
            ArrivalAirportName = segment.ArrivalAirportName,
            ArrivalAirportCity = segment.ArrivalAirportCity,
            ArrivalAirportCountry = segment.ArrivalAirportCountry,
            ArrivalAirportTimeZone = segment.ArrivalAirportTimeZone,
            ArrivalAirportTimeZoneId = GetTimeZoneId(timeZoneLookup, segment.ArrivalAirportTimeZone),
            DepartureTerminal = segment.DepartureTerminal,
            ArrivalTerminal = segment.ArrivalTerminal,
            AircraftName = segment.AircraftName
        };
    }

    private async Task<TucJobNationwide> CreateFlightRecordsAsync(
        TucJob job,
        List<FlightSegmentViewModel> segments,
        IReadOnlyList<string> webhookIds,
        IReadOnlyDictionary<string, int> timeZoneLookup,
        int? departureTimeZoneId,
        string primaryFlightNumber)
    {
        var primarySegment = segments.First();

        // Create primary flight record with its own segment arrival time
        var primaryFlightRecord = CreateFlightRecord(
            job, primarySegment, webhookIds[0],
            NationwideJobConstants.PrimaryFlightLegNumber, timeZoneLookup);

        // Override departure timezone for primary flight
        primaryFlightRecord.DepartureAirportTimeZoneId = departureTimeZoneId;

        Log.Information("Adding main flight record for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
            primaryFlightNumber, job.UcjbId);

        await Context.AddAsync(primaryFlightRecord);

        // Add connection flight legs if there are multiple segments
        if (segments.Count <= 1)
        {
            return primaryFlightRecord;
        }

        Log.Information("Processing {ConnectionCount} connection flights for PrimaryFlight: {PrimaryFlightNumber}",
            segments.Count - 1, primaryFlightNumber);

        for (var i = 1; i < segments.Count; i++)
        {
            var leg = segments[i];
            var legNumber = i + 1;

            Log.Debug(
                "Adding connection leg {LegNumber} for PrimaryFlight: {PrimaryFlightNumber}, Flight: {ConnectionFlight}",
                legNumber, primaryFlightNumber, leg.FlightNumber);

            var connectionRecord = CreateFlightRecord(job, leg, webhookIds[i], legNumber, timeZoneLookup);
            await Context.AddAsync(connectionRecord);
        }

        return primaryFlightRecord;
    }

    private static int? GetTimeZoneId(IReadOnlyDictionary<string, int> timeZoneLookup, string timeZoneName) =>
        !string.IsNullOrEmpty(timeZoneName) && timeZoneLookup.TryGetValue(timeZoneName, out var id) ? id : null;

    private async Task<IReadOnlyDictionary<string, int>> BuildTimeZoneLookupAsync(
        CancellationToken cancellationToken = default)
    {
        var timeZones = await Context.TimeZones
            .Select(tz => new { tz.Id, tz.Name, tz.Code })
            .ToListAsync(cancellationToken);

        var lookup = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var tz in timeZones)
        {
            if (!string.IsNullOrEmpty(tz.Name))
            {
                lookup.TryAdd(tz.Name, tz.Id);
            }

            if (!string.IsNullOrEmpty(tz.Code))
            {
                lookup.TryAdd(tz.Code, tz.Id);
            }
        }

        return lookup;
    }

    private async Task<IReadOnlyList<AirportAddressInfoDto>> GetAirportAddressInfosAsync(
        IReadOnlyCollection<int> airportIds) =>
        await Context.TblAirports
            .Where(a => a.Active && airportIds.Contains(a.AirportId))
            .Select(a => new AirportAddressInfoDto
            {
                AirportId = a.AirportId,
                AddressLine1 = a.AddressLine1,
                AddressLine2 = a.AddressLine2,
                AddressLine3 = a.AddressLine3,
                AddressLine4 = a.AddressLine4,
                AddressLine5 = a.AddressLine5,
                AddressLine6 = a.AddressLine6,
                AddressLine7 = a.AddressLine7,
                AddressLine8 = a.AddressLine8,
                Latitude = a.Latitude,
                Longitude = a.Longitude
            })
            .ToListAsync();

    private async Task<NationwideJobDetail> GetJobDetailsAsync(int jobId)
    {
        // Single query to get all job details including airport IDs
        var jobDetail = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new NationwideJobDetail
            {
                AirPortId = j.FromAirportId ?? j.ToAirportId,
                VehicleSizeId = j.UcjbSize,
                ClientId = j.UcjbClientId,
                FromZipCode = j.PickupAddressLine7,
                ToZipCode = j.DeliveryAddressLine7,
                TotalMiles = 20,
                TotalWeight = (decimal)j.UcjbWeight,
                BookTime = new DateTime(
                    j.UcjbDate.Year,
                    j.UcjbDate.Month,
                    j.UcjbDate.Day,
                    j.UcjbTime != null ? j.UcjbTime.Value.Hour : 0,
                    j.UcjbTime != null ? j.UcjbTime.Value.Minute : 0,
                    j.UcjbTime != null ? j.UcjbTime.Value.Second : 0
                ),
                DangerousGoods = j.Dgdocument,
                DryIceWeight = j.DryIceWeight,
                Quantity = j.UcjbQty,
                FromState = j.PickupAddressLine5,
                ToState = j.DeliveryAddressLine5,
                TotalPallets = null,
                ExtraStopOffs = true,
                PickupWaitTime = j.WaitedPickUp ?? 0,
                DeliveryWaitTime = j.WaitedDelivery ?? 0,
                Cubic = null
            })
            .FirstOrDefaultAsync();

        if (jobDetail == null)
        {
            return null;
        }

        // If airport already assigned, return immediately
        if (jobDetail.AirPortId != null)
        {
            return jobDetail;
        }

        // Otherwise try to find nearest airport
        var nearbyAirports = await GetNearbyAirportsAsync(jobId);
        if (nearbyAirports.Count == 0)
        {
            return jobDetail;
        }

        var nearestAirportId = nearbyAirports[0].Id;
        Log.Information("Using nearest airport {AirportId} for job {JobId}", nearestAirportId, jobId);

        // AirPortId is init-only, so create a new instance with the airport set
        return new NationwideJobDetail
        {
            AirPortId = nearestAirportId,
            VehicleSizeId = jobDetail.VehicleSizeId,
            ClientId = jobDetail.ClientId,
            FromZipCode = jobDetail.FromZipCode,
            ToZipCode = jobDetail.ToZipCode,
            TotalMiles = jobDetail.TotalMiles,
            TotalWeight = jobDetail.TotalWeight,
            BookTime = jobDetail.BookTime,
            DangerousGoods = jobDetail.DangerousGoods,
            DryIceWeight = jobDetail.DryIceWeight,
            Quantity = jobDetail.Quantity,
            FromState = jobDetail.FromState,
            ToState = jobDetail.ToState,
            TotalPallets = jobDetail.TotalPallets,
            ExtraStopOffs = jobDetail.ExtraStopOffs,
            PickupWaitTime = jobDetail.PickupWaitTime,
            DeliveryWaitTime = jobDetail.DeliveryWaitTime,
            Cubic = jobDetail.Cubic
        };
    }

    private async Task<IReadOnlyList<AgentDto>> GetEligibleAgentsAsync(int? airportId, int? vehicleSizeId) =>
        await Context.AgentVehicles
            .Where(av => av.AirportId == airportId && av.VehicleSizeId == vehicleSizeId)
            .Select(a => new AgentDto
            {
                AgentId = a.AgentId.Value,
                AgentName = a.Agent.UcagName,
                AgentRanking = a.Agent.Ranking.AgentRankingName,
                AgentVehicleId = a.AgentVehicleId
            })
            .ToListAsync();

    private async Task<IReadOnlyList<AgentViewModel>> ProcessAgentsInParallelAsync(NationwideJobDetail nationwideJob,
        IReadOnlyList<AgentDto> agents)
    {
        const int batchSize = 100;
        var agentResults = new ConcurrentBag<AgentViewModel>();

        await Parallel.ForEachAsync(
            agents.Chunk(batchSize),
            new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount },
            async (batch, ct) =>
            {
                // Each parallel batch gets its own DbContext to avoid concurrency issues
                await using var batchContext = CreateNewContext();
                foreach (var agent in batch)
                {
                    var agentRate = await GetAgentRateAsync(batchContext, nationwideJob, agent, ct);
                    var viewModel = new AgentViewModel
                    {
                        AgentId = agent.AgentId,
                        AgentName = agent.AgentName,
                        AgentRanking = agent.AgentRanking,
                        AgentRate = agentRate ?? 0,
                        AgentNotes = agent.AgentNotes
                    };

                    agentResults.Add(viewModel);
                }
            });

        return [.. agentResults];
    }

    private static async Task<decimal?> GetAgentRateAsync(DespatchContext context,
        NationwideJobDetail nationwideJob, AgentDto agent, CancellationToken ct)
    {
        var rates = await context.Procedures.DD_stpGetAgentDistanceRateAsync(
            nationwideJob.ClientId,
            int.Parse(nationwideJob.FromZipCode),
            nationwideJob.FromState,
            int.Parse(nationwideJob.ToZipCode),
            nationwideJob.ToState,
            nationwideJob.TotalMiles,
            nationwideJob.TotalWeight,
            nationwideJob.Quantity,
            nationwideJob.Cubic,
            nationwideJob.TotalPallets,
            nationwideJob.ExtraStopOffs ? 1 : 0,
            nationwideJob.BookTime,
            nationwideJob.VehicleSizeId,
            nationwideJob.DangerousGoods,
            nationwideJob.DryIceWeight,
            nationwideJob.PickupWaitTime,
            nationwideJob.DeliveryWaitTime,
            agent.AgentVehicleId,
            cancellationToken: ct
        );

        return rates
            .Select(r => r.Rate)
            .FirstOrDefault();
    }

    private async Task<int> GetAirportProcessingTimeAsync(int airportId) =>
        await Context.TblAirports
            .Where(a => a.AirportId == airportId)
            .Select(a => a.ProcessingTime)
            .FirstOrDefaultAsync() ?? 60;

    public async Task<int?> GetFlightCarrierIdByCodeAsync(string carrierCode) =>
        await Context.FlightCarriers
            .Where(fc => fc.CarrierCode == carrierCode)
            .Select(fc => fc.FlightCarrierId)
            .FirstOrDefaultAsync();

    private static void UpdateJobAddressWithAirportInfo(IReadOnlyList<AirportAddressInfoDto> airports, TucJob job,
        int airportId,
        int? timeZoneId,
        bool isDeliveryAddress)
    {
        var airport = airports.FirstOrDefault(a => a.AirportId == airportId);

        ArgumentNullException.ThrowIfNull(airport);

        if (isDeliveryAddress)
        {
            job.DeliveryAddressLine1 = airport.AddressLine1;
            job.DeliveryAddressLine2 = airport.AddressLine2;
            job.DeliveryAddressLine3 = airport.AddressLine3;
            job.DeliveryAddressLine4 = airport.AddressLine4;
            job.DeliveryAddressLine5 = airport.AddressLine5;
            job.DeliveryAddressLine6 = airport.AddressLine6;
            job.DeliveryAddressLine7 = airport.AddressLine7;
            job.DeliveryAddressLine8 = airport.AddressLine8;
            job.DeliveryLatitude = airport.Latitude;
            job.DeliveryLongitude = airport.Longitude;
            job.DeliverByTimeZoneId ??= timeZoneId;
        }
        else
        {
            job.PickupAddressLine1 = airport.AddressLine1;
            job.PickupAddressLine2 = airport.AddressLine2;
            job.PickupAddressLine3 = airport.AddressLine3;
            job.PickupAddressLine4 = airport.AddressLine4;
            job.PickupAddressLine5 = airport.AddressLine5;
            job.PickupAddressLine6 = airport.AddressLine6;
            job.PickupAddressLine7 = airport.AddressLine7;
            job.PickupAddressLine8 = airport.AddressLine8;
            job.PickUpLatitude = airport.Latitude;
            job.PickUpLongitude = airport.Longitude;
            job.PickupTimeZoneId ??= timeZoneId;
        }
    }
}