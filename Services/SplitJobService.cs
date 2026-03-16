using System.Collections.Concurrent;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for splitting jobs into pickup and delivery child jobs.
/// Replaces the stored procedure DES_stpJob_SplitJob with C# implementation.
/// </summary>
public sealed class SplitJobService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService tenantInfoService,
    ITenantClock clock,
    ICreateJobService createJobService,
    IServiceScopeFactory serviceScopeFactory) : ISplitJobService
{
    private const string ParentSystemName = "SplitParent";
    private const string ChildSystemName = "SplitChild";
    private const int HandOffLeaveType = 23;
    private const int PrivateResidenceDeliverTo = 1;

    /// <inheritdoc />
    public async Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress)
    {
        var currentTenantTime = clock.TenantNow;

        await using var context = await contextFactory.CreateDbContextAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            Log.Information("Splitting job {JobId} by user {UserName} with meeting point address",
                jobId, userName);

            var couriers = context.TucCouriers;
            var relTypes = context.TblJobRelationshipTypes;
            var nationWide = context.TucJobNationwides;

            var lookups = await context.TblSettings
                .Where(s => s.SettingId == 1)
                .Select(s => new
                {
                    ParentJobCourierId = s.ParentJobCourierId != null
                                         && couriers.Any(c => c.UccrId == s.ParentJobCourierId)
                        ? s.ParentJobCourierId
                        : null,
                    SplitParentRelTypeId = relTypes
                        .Where(r => r.SystemName == "SplitParent")
                        .Select(r => (int?)r.JobRelationshipTypeId).FirstOrDefault(),
                    SplitChildRelTypeId = relTypes
                        .Where(r => r.SystemName == "SplitChild")
                        .Select(r => (int?)r.JobRelationshipTypeId).FirstOrDefault(),
                    HasFlightAssigned = nationWide.Any(n => n.UcnwJobId == jobId)
                }).FirstOrDefaultAsync();

            var parentRelTypeId = lookups?.SplitParentRelTypeId
                                  ?? throw new InvalidOperationException(
                                      $"Job relationship type '{ParentSystemName}' not found");

            var childRelTypeId = lookups.SplitChildRelTypeId
                                 ?? throw new InvalidOperationException(
                                     $"Job relationship type '{ChildSystemName}' not found");

            if (lookups.HasFlightAssigned)
                throw new InvalidOperationException($"Job {jobId} has flights assigned and cannot be split");

            // Load the job with related data
            var job = await context.TucJobs
                          .AsTracking()
                          .Include(j => j.UcjbSpeedNavigation)
                          .FirstOrDefaultAsync(j => j.UcjbId == jobId)
                      ?? throw new InvalidOperationException($"Job {jobId} not found");

            // 1B: Use already-loaded speed navigation property 
            var validSpeed = job.UcjbSpeedNavigation != null
                ? new Suggestion { Id = job.UcjbSpeedNavigation.UcjtId, Text = job.UcjbSpeedNavigation.UcjtName }
                : null;
            ArgumentNullException.ThrowIfNull(validSpeed);

            // Generate child job numbers using letter suffixes
            var (pickupJobNumber, deliveryJobNumber) = await GenerateChildJobNumbersAsync(context, job);

            // Capture original courier ID before modifying parent
            var originalCourierId = job.UcjbCourierId;

            // Determine root parent ID - preserve existing if job is already a child
            var rootParentId = job.RootParentId ?? job.UcjbId;

            // Update parent job (only set parent IDs if not already set)
            job.JobRelationshipTypeId = parentRelTypeId;
            job.UcjbCourierId = null;
            if (!job.ParentId.HasValue || job.ParentId == job.UcjbId) job.ParentId = jobId;
            job.RootParentId ??= jobId;
            job.InformationParentId ??= job.RootParentId;

            // Create both child jobs in parallel — each CreateJobAsync uses its own DbContext
            var pickupInput = BuildPickupInputModel(job, pickupJobNumber, validSpeed, meetingPointAddress, userName,
                currentTenantTime, originalCourierId);
            var deliveryInput = BuildDeliveryInputModel(job, deliveryJobNumber, validSpeed, meetingPointAddress,
                userName, currentTenantTime);

            var pickupTask = createJobService.CreateJobAsync(pickupInput);
            var deliveryTask = createJobService.CreateJobAsync(deliveryInput);
            await Task.WhenAll(pickupTask, deliveryTask);

            var pickupResult = pickupTask.Result;
            if (!pickupResult.Success)
                throw new InvalidOperationException($"Failed to create pickup job: {pickupResult.Message}");

            var deliveryResult = deliveryTask.Result;
            if (!deliveryResult.Success)
                throw new InvalidOperationException($"Failed to create delivery job: {deliveryResult.Message}");

            // 1D: Load both created child jobs in one query
            var createdJobs = await context.TucJobs
                .Where(j => j.UcjbId == pickupResult.JobId || j.UcjbId == deliveryResult.JobId)
                .ToListAsync();
            
            var pickupJob = createdJobs.FirstOrDefault(j => j.UcjbId == pickupResult.JobId)
                            ?? throw new InvalidOperationException(
                                $"Failed to load created pickup job {pickupResult.JobId}");
            var deliveryJob = createdJobs.FirstOrDefault(j => j.UcjbId == deliveryResult.JobId)
                              ?? throw new InvalidOperationException(
                                  $"Failed to load created delivery job {deliveryResult.JobId}");
            
            // Hide parent from dispatch
            job.DisplayInDespatch = false;

            // Update pickup job fields not handled by the stored procedure
            pickupJob.UcjbDate = job.UcjbDate;
            pickupJob.UcjbTime = job.UcjbTime;
            pickupJob.UcjbType = job.UcjbType;
            pickupJob.UcjbContact = job.UcjbContact;
            pickupJob.UcjbChargeType = job.UcjbChargeType;
            pickupJob.UcjbFrom = job.UcjbFrom;
            pickupJob.UcjbFromAddr = job.UcjbFromAddr;
            pickupJob.UcjbTo = null;
            pickupJob.UcjbToAddr = meetingPointAddress.FullAddress;
            pickupJob.UcjbSize = job.UcjbSize;
            pickupJob.UcjbQty = job.UcjbQty;
            pickupJob.UcjbCbd = job.UcjbCbd;
            pickupJob.UcjbWeight = job.UcjbWeight;
            pickupJob.UcjbCourierId = originalCourierId;
            pickupJob.UcjbStatus = originalCourierId.HasValue ? (int)JobStatus.Acknowledge : job.UcjbStatus;
            pickupJob.UcjbOpId = job.UcjbOpId;
            pickupJob.UcjbReturn = job.UcjbReturn;
            pickupJob.UcjbPickUpFrom = job.UcjbPickUpFrom;
            pickupJob.ClientNotes = job.ClientNotes;
            pickupJob.UcjbContactPhone = job.UcjbContactPhone;
            pickupJob.ContactId = job.ContactId;
            pickupJob.DeliverToPrivateBusiness = PrivateResidenceDeliverTo;
            pickupJob.DeliverToLeaveId = HandOffLeaveType;
            pickupJob.ProofOfDelivery = job.ProofOfDelivery;
            pickupJob.ProofOfDeliveryEmail = job.ProofOfDeliveryEmail;
            pickupJob.ProofOfDeliveryMobile = job.ProofOfDeliveryMobile;
            pickupJob.AcceptedJobTypeId = job.AcceptedJobTypeId;
            pickupJob.DesiredJobTypeId = job.DesiredJobTypeId;
            pickupJob.Direct = job.Direct;
            pickupJob.JobRelationshipTypeId = childRelTypeId;
            pickupJob.DisplayInDespatch = true;
            pickupJob.ShopId = job.ShopId;
            pickupJob.ShopRef1 = job.ShopRef1;
            pickupJob.ShopRef2 = job.ShopRef2;
            pickupJob.ShopRef3 = job.ShopRef3;
            pickupJob.ShopRef4 = job.ShopRef4;
            pickupJob.ShopRef5 = job.ShopRef5;
            pickupJob.CourierPercentageOverride = job.CourierPercentageOverride;
            pickupJob.UcjbClientCode = job.UcjbClientCode;
            pickupJob.UcjbVoid = false;
            pickupJob.UcjbJobDone = false;
            pickupJob.UcjbPaged = false;
            pickupJob.SaturdayDelivery = job.SaturdayDelivery;
            pickupJob.Dgdocument = job.Dgdocument;
            pickupJob.InternalStatus = job.InternalStatus;
            pickupJob.PickupTimeZoneId = job.PickupTimeZoneId;
            pickupJob.DeliverByTimeZoneId = job.DeliverByTimeZoneId;
            pickupJob.DeliverByTime = job.DeliverByTime;
            pickupJob.FromAirportId = job.FromAirportId;
            pickupJob.ToAirportId = null;
            pickupJob.FuelSurchargeAmount = 0;
            pickupJob.CourierFuel = 0;
            pickupJob.TotalDistance = null;
            pickupJob.ParentId = jobId;
            pickupJob.RootParentId = rootParentId;
            pickupJob.InformationParentId = rootParentId;
            pickupJob.Sequence = 1;
            pickupJob.UcjbVan = job.UcjbVan;
            pickupJob.UcjbAttention = job.UcjbAttention;
            pickupJob.PickupAddressLine1 = job.PickupAddressLine1;
            pickupJob.PickupAddressLine2 = job.PickupAddressLine2;
            pickupJob.PickupAddressLine3 = job.PickupAddressLine3;
            pickupJob.PickupAddressLine4 = job.PickupAddressLine4;
            pickupJob.PickupAddressLine5 = job.PickupAddressLine5;
            pickupJob.PickupAddressLine6 = job.PickupAddressLine6;
            pickupJob.PickupAddressLine7 = job.PickupAddressLine7;
            pickupJob.PickupAddressLine8 = job.PickupAddressLine8;
            pickupJob.PickUpLatitude = job.PickUpLatitude;
            pickupJob.PickUpLongitude = job.PickUpLongitude;
            pickupJob.DeliveryAddressLine1 = meetingPointAddress.AddressLine1;
            pickupJob.DeliveryAddressLine2 = meetingPointAddress.AddressLine2;
            pickupJob.DeliveryAddressLine3 = meetingPointAddress.AddressLine3;
            pickupJob.DeliveryAddressLine4 = meetingPointAddress.AddressLine4;
            pickupJob.DeliveryAddressLine5 = meetingPointAddress.AddressLine5;
            pickupJob.DeliveryAddressLine6 = meetingPointAddress.AddressLine6;
            pickupJob.DeliveryAddressLine7 = meetingPointAddress.AddressLine7;
            pickupJob.DeliveryAddressLine8 = meetingPointAddress.AddressLine8;
            pickupJob.DeliveryLatitude = meetingPointAddress.Latitude;
            pickupJob.DeliveryLongitude = meetingPointAddress.Longitude;

            // Update delivery job fields not handled by the stored procedure
            deliveryJob.UcjbDate = job.UcjbDate;
            deliveryJob.UcjbTime = job.UcjbTime;
            deliveryJob.UcjbType = job.UcjbType;
            deliveryJob.UcjbContact = job.UcjbContact;
            deliveryJob.UcjbChargeType = job.UcjbChargeType;
            deliveryJob.UcjbFrom = null;
            deliveryJob.UcjbFromAddr = meetingPointAddress.FullAddress;
            deliveryJob.UcjbTo = job.UcjbTo;
            deliveryJob.UcjbToAddr = job.UcjbToAddr;
            deliveryJob.UcjbSize = job.UcjbSize;
            deliveryJob.UcjbQty = job.UcjbQty;
            deliveryJob.UcjbCbd = job.UcjbCbd;
            deliveryJob.UcjbWeight = job.UcjbWeight;
            deliveryJob.UcjbCourierId = null;
            deliveryJob.UcjbStatus = job.UcjbStatus;
            deliveryJob.UcjbOpId = job.UcjbOpId;
            deliveryJob.UcjbReturn = job.UcjbReturn;
            deliveryJob.UcjbPickUpFrom = job.UcjbPickUpFrom;
            deliveryJob.ClientNotes = job.ClientNotes;
            deliveryJob.UcjbContactPhone = job.UcjbContactPhone;
            deliveryJob.ContactId = job.ContactId;
            deliveryJob.DeliverToPrivateBusiness = job.DeliverToPrivateBusiness;
            deliveryJob.DeliverToLeaveId = job.DeliverToLeaveId;
            deliveryJob.ProofOfDelivery = job.ProofOfDelivery;
            deliveryJob.ProofOfDeliveryEmail = job.ProofOfDeliveryEmail;
            deliveryJob.ProofOfDeliveryMobile = job.ProofOfDeliveryMobile;
            deliveryJob.AcceptedJobTypeId = job.AcceptedJobTypeId;
            deliveryJob.DesiredJobTypeId = job.DesiredJobTypeId;
            deliveryJob.Direct = job.Direct;
            deliveryJob.JobRelationshipTypeId = childRelTypeId;
            deliveryJob.DisplayInDespatch = true;
            deliveryJob.ShopId = job.ShopId;
            deliveryJob.ShopRef1 = job.ShopRef1;
            deliveryJob.ShopRef2 = job.ShopRef2;
            deliveryJob.ShopRef3 = job.ShopRef3;
            deliveryJob.ShopRef4 = job.ShopRef4;
            deliveryJob.ShopRef5 = job.ShopRef5;
            deliveryJob.CourierPercentageOverride = job.CourierPercentageOverride;
            deliveryJob.UcjbClientCode = job.UcjbClientCode;
            deliveryJob.UcjbVoid = false;
            deliveryJob.UcjbJobDone = false;
            deliveryJob.UcjbPaged = false;
            deliveryJob.SaturdayDelivery = job.SaturdayDelivery;
            deliveryJob.Dgdocument = job.Dgdocument;
            deliveryJob.InternalStatus = job.InternalStatus;
            deliveryJob.PickupTimeZoneId = job.PickupTimeZoneId;
            deliveryJob.DeliverByTimeZoneId = job.DeliverByTimeZoneId;
            deliveryJob.DeliverByTime = job.DeliverByTime;
            deliveryJob.FromAirportId = null;
            deliveryJob.ToAirportId = job.ToAirportId;
            deliveryJob.FuelSurchargeAmount = 0;
            deliveryJob.CourierFuel = 0;
            deliveryJob.TotalDistance = null;
            deliveryJob.ParentId = jobId;
            deliveryJob.RootParentId = rootParentId;
            deliveryJob.InformationParentId = rootParentId;
            deliveryJob.Sequence = 2;
            deliveryJob.UcjbVan = job.UcjbVan;
            deliveryJob.PickupAddressLine1 = meetingPointAddress.AddressLine1;
            deliveryJob.PickupAddressLine2 = meetingPointAddress.AddressLine2;
            deliveryJob.PickupAddressLine3 = meetingPointAddress.AddressLine3;
            deliveryJob.PickupAddressLine4 = meetingPointAddress.AddressLine4;
            deliveryJob.PickupAddressLine5 = meetingPointAddress.AddressLine5;
            deliveryJob.PickupAddressLine6 = meetingPointAddress.AddressLine6;
            deliveryJob.PickupAddressLine7 = meetingPointAddress.AddressLine7;
            deliveryJob.PickupAddressLine8 = meetingPointAddress.AddressLine8;
            deliveryJob.PickUpLatitude = meetingPointAddress.Latitude;
            deliveryJob.PickUpLongitude = meetingPointAddress.Longitude;
            deliveryJob.DeliveryAddressLine1 = job.DeliveryAddressLine1;
            deliveryJob.DeliveryAddressLine2 = job.DeliveryAddressLine2;
            deliveryJob.DeliveryAddressLine3 = job.DeliveryAddressLine3;
            deliveryJob.DeliveryAddressLine4 = job.DeliveryAddressLine4;
            deliveryJob.DeliveryAddressLine5 = job.DeliveryAddressLine5;
            deliveryJob.DeliveryAddressLine6 = job.DeliveryAddressLine6;
            deliveryJob.DeliveryAddressLine7 = job.DeliveryAddressLine7;
            deliveryJob.DeliveryAddressLine8 = job.DeliveryAddressLine8;
            deliveryJob.DeliveryLatitude = job.DeliveryLatitude;
            deliveryJob.DeliveryLongitude = job.DeliveryLongitude;

            // 1E: Add notes to context before SaveChanges so everything persists in one batch
            var staffId = tenantInfoService.GetStaffId();
            AddSplitJobNotes(context, currentTenantTime, pickupJob.UcjbId, deliveryJob.UcjbId,
                job.UcjbNotes, staffId);

            await context.SaveChangesAsync();

            // 1F: Pass already-known values to avoid re-querying the parent job 
            await ReRateSplitJobsAsync(context, jobId, job.UcjbAmount ?? 0m, rootParentId);

            // Consolidate MARS information
            await ConsolidateMarsInformationAsync(context, jobId, userName);

            await transaction.CommitAsync();

            Log.Information("Successfully split job {JobId} into pickup {PickupId} and delivery {DeliveryId}",
                jobId, pickupJob.UcjbId, deliveryJob.UcjbId);

            return (pickupJob.UcjbId, deliveryJob.UcjbId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Log.Error(ex, "Error splitting job {JobId}", jobId);
            throw;
        }
    }

    /// <summary>
    /// Converts a 0-based index to Excel-style letter suffix (0=A, 25=Z, 26=AA, 27=AB, etc.)
    /// </summary>
    private static string GetLetterSuffix(int index)
    {
        var result = string.Empty;
        var n = index;

        do
        {
            result = (char)('A' + n % 26) + result;
            n = n / 26 - 1;
        } while (n >= 0);

        return result;
    }

    /// <summary>
    /// Generates child job numbers using letter suffixes based on total split count from root job.
    /// </summary>
    private static async Task<(string PickupJobNumber, string DeliveryJobNumber)> GenerateChildJobNumbersAsync(
        DespatchContext context,
        TucJob job)
    {
        // Find root parent ID - use existing RootParentId if present, otherwise this job is the root
        var rootParentId = job.RootParentId ?? job.UcjbId;

        // 1C: Combine root parent number + child count into a single projected query
        string mainJobNumber;
        int existingChildCount;
        if (rootParentId == job.UcjbId)
        {
            mainJobNumber = job.UcjbNumber;
            existingChildCount = await context.TucJobs
                .CountAsync(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId);
        }
        else
        {
            var data = await context.TucJobs
                .Where(j => j.UcjbId == rootParentId)
                .Select(j => new
                {
                    MainJobNumber = j.UcjbNumber,
                    ExistingChildCount =
                        context.TucJobs.Count(c => c.RootParentId == rootParentId && c.UcjbId != rootParentId)
                }).FirstOrDefaultAsync();

            mainJobNumber = data?.MainJobNumber ?? job.UcjbNumber;
            existingChildCount = data?.ExistingChildCount ?? 0;
        }

        // Generate letter suffixes for the two new jobs
        var pickupSuffix = GetLetterSuffix(existingChildCount);
        var deliverySuffix = GetLetterSuffix(existingChildCount + 1);

        return ($"{mainJobNumber}{pickupSuffix}", $"{mainJobNumber}{deliverySuffix}");
    }

    private CreateMinimalTucJobInputModel BuildPickupInputModel(
        TucJob parentJob,
        string jobNumber,
        Suggestion validSpeed,
        AddressViewModel meetingPointAddress,
        string userName,
        DateTime currentTenantTime,
        int? originalCourierId) =>
        new()
        {
            JobNumber = jobNumber,
            ClientId = parentJob.UcjbClientId ?? 0,
            AgentCourierId = originalCourierId,
            SpeedId = validSpeed.Id,
            Speed = validSpeed.Text,
            Amount = parentJob.UcjbAmount ?? 0m,
            FromAddress = new AddressViewModel
            {
                AddressLine1 = parentJob.PickupAddressLine1,
                AddressLine2 = parentJob.PickupAddressLine2,
                AddressLine3 = parentJob.PickupAddressLine3,
                AddressLine4 = parentJob.PickupAddressLine4,
                AddressLine5 = parentJob.PickupAddressLine5,
                AddressLine6 = parentJob.PickupAddressLine6,
                AddressLine7 = parentJob.PickupAddressLine7,
                AddressLine8 = parentJob.PickupAddressLine8,
                Latitude = parentJob.PickUpLatitude,
                Longitude = parentJob.PickUpLongitude
            },
            ToAddress = meetingPointAddress,
            Reference = parentJob.UcjbClientRefa,
            ReferenceB = parentJob.UcjbClientRefb,
            OurRef = parentJob.UcjbOurRef,
            FromContactName = parentJob.PickupFromContact,
            FromPhoneNumber = parentJob.PickupFromPhone,
            PickUpLatitude = parentJob.PickUpLatitude,
            PickUpLongitude = parentJob.PickUpLongitude,
            DeliveryLatitude = meetingPointAddress.Latitude,
            DeliveryLongitude = meetingPointAddress.Longitude,
            DgClass = parentJob.Dgclass,
            DryIceWeight = parentJob.DryIceWeight,
            FuelSurchargeAmount = 0,
            BookedBy = userName,
            LoggedInContactId = tenantInfoService.GetContactId(),
            TenantCurrentTime = currentTenantTime
        };

    private CreateMinimalTucJobInputModel BuildDeliveryInputModel(
        TucJob parentJob,
        string jobNumber,
        Suggestion validSpeed,
        AddressViewModel meetingPointAddress,
        string userName,
        DateTime currentTenantTime) =>
        new()
        {
            JobNumber = jobNumber,
            ClientId = parentJob.UcjbClientId ?? 0,
            SpeedId = validSpeed.Id,
            Speed = validSpeed.Text,
            Amount = parentJob.UcjbAmount ?? 0m,
            FromAddress = meetingPointAddress,
            ToAddress = new AddressViewModel
            {
                AddressLine1 = parentJob.DeliveryAddressLine1,
                AddressLine2 = parentJob.DeliveryAddressLine2,
                AddressLine3 = parentJob.DeliveryAddressLine3,
                AddressLine4 = parentJob.DeliveryAddressLine4,
                AddressLine5 = parentJob.DeliveryAddressLine5,
                AddressLine6 = parentJob.DeliveryAddressLine6,
                AddressLine7 = parentJob.DeliveryAddressLine7,
                AddressLine8 = parentJob.DeliveryAddressLine8,
                Latitude = parentJob.DeliveryLatitude,
                Longitude = parentJob.DeliveryLongitude
            },
            Reference = parentJob.UcjbClientRefa,
            ReferenceB = parentJob.UcjbClientRefb,
            OurRef = parentJob.UcjbOurRef,
            ToContactName = parentJob.DeliverToContact,
            ToPhoneNumber = parentJob.DeliverToPhone,
            PickUpLatitude = meetingPointAddress.Latitude,
            PickUpLongitude = meetingPointAddress.Longitude,
            DeliveryLatitude = parentJob.DeliveryLatitude,
            DeliveryLongitude = parentJob.DeliveryLongitude,
            DgClass = parentJob.Dgclass,
            DryIceWeight = parentJob.DryIceWeight,
            FuelSurchargeAmount = 0,
            BookedBy = userName,
            LoggedInContactId = tenantInfoService.GetContactId(),
            TenantCurrentTime = currentTenantTime
        };

    private async Task ReRateSplitJobsAsync(DespatchContext context, int parentJobId,
        decimal parentAmount, int rootParentId)
    {
        try
        {
            if (parentAmount == 0m)
            {
                Log.Information("Parent job {ParentJobId} has zero amount. Skipping re-rate.", parentJobId);
                return;
            }

            // Load all child entities with rating-related navigations in a single query
            var childJobs = await context.TucJobs
                .Include(j => j.UcjbClient)
                .Include(j => j.FromAirport)
                .Include(j => j.ToAirport)
                .Include(j => j.TucJobItemJobs)
                .Where(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId && !j.UcjbVoid)
                .OrderBy(j => j.Sequence)
                .AsSplitQuery()
                .ToListAsync();

            if (childJobs.Count == 0)
            {
                Log.Warning("No non-void jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
                return;
            }

            // Pre-compute airport address matches once for all child addresses
            var isUs = tenantInfoService.IsUsTenant();
            HashSet<string> airportAddresses = null;
            if (isUs)
            {
                var childPickupAddresses = childJobs
                    .Select(j => j.PickupAddressLine2).Where(a => !string.IsNullOrEmpty(a));
                var childDeliveryAddresses = childJobs
                    .Select(j => j.DeliveryAddressLine2).Where(a => !string.IsNullOrEmpty(a));
                var allAddresses = childPickupAddresses.Concat(childDeliveryAddresses).Distinct().ToList();

                if (allAddresses.Count > 0)
                {
                    var matchingAddresses = await context.TblAirports
                        .Where(a => allAddresses.Contains(a.AddressLine2))
                        .Select(a => a.AddressLine2)
                        .ToListAsync();
                    airportAddresses = new HashSet<string>(matchingAddresses, StringComparer.OrdinalIgnoreCase);
                }
                else
                {
                    airportAddresses = [];
                }
            }

            // Pre-compute flight speed flag once for all children (they all share the same speed)
            bool? isFlightSpeed = null;
            if (isUs && childJobs.Count > 0)
            {
                var speedId = childJobs[0].UcjbSpeed;
                if (speedId.HasValue)
                {
                    var speed = await context.TucJobTypes
                        .Include(s => s.Grouping)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(s => s.UcjtId == speedId.Value);
                    isFlightSpeed = speed?.Grouping?.GroupingId == (int)SpeedGrouping.Flight;
                }
            }

            // Rate child jobs in parallel with bounded concurrency
            var jobRates = new ConcurrentBag<(int JobId, decimal Rate)>();
            await Parallel.ForEachAsync(childJobs, new ParallelOptions { MaxDegreeOfParallelism = 4 }, async (child, _) =>
            {
                var rate = 0m;
                try
                {
                    using var scope = serviceScopeFactory.CreateScope();
                    var scopedRateService = scope.ServiceProvider.GetRequiredService<IRateJobService>();

                    if (isUs)
                    {
                        var details = BuildRatingDtoUs(child, airportAddresses, isFlightSpeed);
                        rate = await scopedRateService.GetJobRateUsAsync(details);
                    }
                    else
                    {
                        var details = BuildRatingDtoNz(child);
                        rate = await scopedRateService.GetJobRateNzAsync(details);
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to rate job {JobId}. Using rate 0.", child.UcjbId);
                }

                jobRates.Add((child.UcjbId, rate));
            });

            // Materialize to list for indexed access in distribution logic
            var jobRatesList = jobRates.ToList();

            // Sum all rates
            var totalRate = jobRatesList.Sum(c => c.Rate);

            // Distribute parent amount proportionally based on calculated rates
            var amounts = new Dictionary<int, decimal>();
            var runningTotal = 0m;
            for (var i = 0; i < jobRatesList.Count; i++)
            {
                decimal jobAmount;
                if (i == jobRatesList.Count - 1)
                {
                    // Last job absorbs rounding difference to ensure exact balance
                    jobAmount = parentAmount - runningTotal;
                }
                else if (totalRate == 0m)
                {
                    // All rates are 0: distribute evenly
                    jobAmount = Math.Round(parentAmount / jobRatesList.Count, 2);
                }
                else
                {
                    var percentage = jobRatesList[i].Rate / totalRate;
                    jobAmount = Math.Round(percentage * parentAmount, 2);
                }

                runningTotal += jobAmount;
                amounts[jobRatesList[i].JobId] = jobAmount;
            }

            // Update each child's amount and rated flag in a single statement per child
            foreach (var (id, amount) in amounts)
            {
                await context.TucJobs
                    .Where(j => j.UcjbId == id)
                    .ExecuteUpdateAsync(j => j
                        .SetProperty(x => x.RatedManually, false)
                        .SetProperty(x => x.UcjbAmount, amount));
            }

            Log.Information(
                "Successfully re-rated {Count} split jobs for parent {ParentJobId}. Parent amount: {ParentAmount}",
                jobRates.Count, parentJobId, parentAmount);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to re-rate split jobs for parent {ParentJobId}. Jobs created but not rated.",
                parentJobId);
        }
    }

    /// <summary>
    /// Builds a US rating DTO directly from a TucJob entity loaded in memory,
    /// avoiding a separate GetJobDetailsForRatingAsync DB roundtrip.
    /// </summary>
    private static JobRatingDetailsDto BuildRatingDtoUs(TucJob child, HashSet<string> airportAddresses,
        bool? isFlightSpeed = null) =>
        new()
        {
            JobId = child.UcjbId,
            ClientId = child.UcjbClientId,
            FromId = child.UcjbFrom,
            ToId = child.UcjbTo,
            SpeedId = child.UcjbSpeed,
            IsPedal = child.UcjbCbd,
            IsVan = child.UcjbVan,
            IsReturnJob = child.UcjbReturn,
            Weight = child.UcjbWeight,
            SizeId = child.UcjbSize,
            IncludeFuelSurcharge = false,
            IsDirect = child.Direct,
            AcceptedJobTypeId = child.AcceptedJobTypeId,
            OurRef = child.UcjbOurRef,
            RefA = child.UcjbClientRefa,
            RefB = child.UcjbClientRefb,
            Quantity = child.UcjbQty ?? 1,
            BookedDate = child.UcjbDate,
            PickupLat = child.PickUpLatitude ?? 0,
            PickupLong = child.PickUpLongitude ?? 0,
            DeliveryLat = child.DeliveryLatitude ?? 0,
            DeliveryLong = child.DeliveryLongitude ?? 0,
            FromZip = child.PickupAddressLine7,
            ToZip = child.DeliveryAddressLine7,
            DangerousGoods = child.Dgdocument ?? false,
            TotalPallets = child.TucJobItemJobs?.Count ?? 0,
            ExtraStopOffs = 0,
            DryIceWeight = child.DryIceWeight ?? 0,
            WaitTime = 0,
            FromAirportId = child.FromAirportId,
            ToAirportId = child.ToAirportId,
            FromAgentId = child.FromAirport?.AgentId,
            ToAgentId = child.ToAirport?.AgentId,
            ClientDiscount = child.UcjbClient?.Discount ?? 0,
            Cubic = child.TucJobItemJobs?.Sum(i => i.Cubic),
            IsManuallyRated = child.RatedManually,
            IsFlightSpeed = isFlightSpeed,
            // Pre-computed airport matches — passed through to RateJobUsDto to skip DB queries
            PrecomputedIsFromAddressAirport = !string.IsNullOrEmpty(child.PickupAddressLine2)
                && airportAddresses.Contains(child.PickupAddressLine2),
            PrecomputedIsToAddressAirport = !string.IsNullOrEmpty(child.DeliveryAddressLine2)
                && airportAddresses.Contains(child.DeliveryAddressLine2)
        };

    /// <summary>
    /// Builds an NZ rating DTO directly from a TucJob entity loaded in memory,
    /// avoiding a separate GetJobDetailsForRatingNzAsync DB roundtrip.
    /// </summary>
    private static JobRatingDetailsDtoNz BuildRatingDtoNz(TucJob child) =>
        new()
        {
            JobId = child.UcjbId,
            ClientId = child.UcjbClientId,
            FromId = child.UcjbFrom,
            ToId = child.UcjbTo,
            SpeedId = child.UcjbSpeed,
            IsPedal = child.UcjbCbd,
            IsVan = child.UcjbVan,
            IsReturnJob = child.UcjbReturn,
            Weight = child.UcjbWeight,
            SizeId = child.UcjbSize,
            IncludeFuelSurcharge = false,
            IsDirect = child.Direct,
            AcceptedJobTypeId = child.AcceptedJobTypeId,
            OurRef = child.UcjbOurRef,
            RefA = child.UcjbClientRefa,
            RefB = child.UcjbClientRefb,
            Quantity = child.UcjbQty ?? 1,
            BookedDate = child.UcjbDate,
            PickupLat = child.PickUpLatitude ?? 0,
            PickupLong = child.PickUpLongitude ?? 0,
            DeliveryLat = child.DeliveryLatitude ?? 0,
            DeliveryLong = child.DeliveryLongitude ?? 0,
            DangerousGoods = child.Dgdocument ?? false,
            DryIceWeight = child.DryIceWeight ?? 0,
            WaitTime = child.WaitedPickUp ?? 0,
            FromAirportId = child.FromAirportId,
            ToAirportId = child.ToAirportId,
            FromAgentId = child.FromAirport?.AgentId,
            ToAgentId = child.ToAirport?.AgentId,
            ClientDiscount = child.UcjbClient?.Discount ?? 0,
            Cubic = child.TucJobItemJobs?.Sum(i => i.Cubic),
            IsManuallyRated = child.RatedManually,
            FromCompanyName = child.PickupAddressLine1,
            FromBuildingName = child.PickupAddressLine2,
            FromStreetAddress = (child.PickupAddressLine3 + " " + child.PickupAddressLine4).Trim(),
            FromSuburb = child.PickupAddressLine5,
            FromCity = child.PickupAddressLine6,
            FromPostCode = child.PickupAddressLine7,
            FromCountryCode = child.PickupAddressLine8,
            ToCompanyName = child.DeliveryAddressLine1,
            ToBuildingName = child.DeliveryAddressLine2,
            ToStreetAddress = (child.DeliveryAddressLine3 + " " + child.DeliveryAddressLine4).Trim(),
            ToSuburb = child.DeliveryAddressLine5,
            ToCity = child.DeliveryAddressLine6,
            ToPostCode = child.DeliveryAddressLine7,
            ToCountryCode = child.DeliveryAddressLine8,
            JobType = JobType.Active,
            IsTruck = child.Truck ?? false,
            TruckStartTime = child.TruckStartTime?.ToString("HH:mm"),
            TruckHours = child.TruckHours.HasValue ? (int)child.TruckHours : null
        };

    private static async Task ConsolidateMarsInformationAsync(DespatchContext context, int jobId, string despatcher)
    {
        try
        {
            await context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(jobId, false, despatcher, null);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to consolidate MARS information for job {JobId}.", jobId);
        }
    }

    private static void AddSplitJobNotes(
        DespatchContext context,
        DateTime currentTenantTime,
        int pickupJobId,
        int deliveryJobId,
        string parentNotes,
        int? staffId)
    {
        var parentNotesText = string.IsNullOrWhiteSpace(parentNotes) ? string.Empty : $"  {parentNotes}";

        context.TucNotes.AddRange(
            new TucNote
            {
                JobId = pickupJobId,
                NoteTypeId = (int)NoteType.InternalNote,
                NoteText = $"SPLIT Part 1 of 2. {parentNotesText}",
                CreatedBy = staffId,
                CreatedDate = currentTenantTime
            },
            new TucNote
            {
                JobId = deliveryJobId,
                NoteTypeId = (int)NoteType.InternalNote,
                NoteText = $"SPLIT Part 2 of 2. {parentNotesText}",
                CreatedBy = staffId,
                CreatedDate = currentTenantTime
            });
    }
}