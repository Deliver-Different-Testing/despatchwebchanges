using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for splitting jobs into pickup and delivery child jobs.
/// Replaces the stored procedure DES_stpJob_SplitJob with C# implementation.
/// </summary>
public class SplitJobService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService tenantInfoService,
    IRateJobService rateJobService,
    IJobRepository jobRepository) : ISplitJobService
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
        var currentTenantTime = tenantInfoService.GetCurrentTenantTime();

        await using var context = await contextFactory.CreateDbContextAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            Log.Information("Splitting job {JobId} by user {UserName} with meeting point address",
                jobId, userName);

            // 1A: Combine initial lookups into a single projected query (saves 2 roundtrips).
            // Extract IQueryable references to avoid capturing the disposable context in the lambda.
            var couriers = context.TucCouriers;
            var relTypes = context.TblJobRelationshipTypes;
            var nationwides = context.TucJobNationwides;

            var lookups = await context.TblSettings.AsNoTracking()
                .Where(s => s.SettingId == 1)
                .Select(s => new
                {
                    ParentJobCourierId = s.ParentJobCourierId != null
                        && couriers.Any(c => c.UccrId == s.ParentJobCourierId)
                        ? s.ParentJobCourierId : null,
                    SplitParentRelTypeId = relTypes
                        .Where(r => r.SystemName == "SplitParent")
                        .Select(r => (int?)r.JobRelationshipTypeId).FirstOrDefault(),
                    SplitChildRelTypeId = relTypes
                        .Where(r => r.SystemName == "SplitChild")
                        .Select(r => (int?)r.JobRelationshipTypeId).FirstOrDefault(),
                    HasFlightAssigned = nationwides.Any(n => n.UcnwJobId == jobId)
                }).FirstOrDefaultAsync();

            var parentRelTypeId = lookups?.SplitParentRelTypeId
                                  ?? throw new InvalidOperationException(
                                      $"Job relationship type '{ParentSystemName}' not found");

            var childRelTypeId = lookups.SplitChildRelTypeId
                                 ?? throw new InvalidOperationException(
                                     $"Job relationship type '{ChildSystemName}' not found");

            var parentJobCourierId = lookups.ParentJobCourierId;

            if (lookups.HasFlightAssigned)
                throw new InvalidOperationException($"Job {jobId} has flights assigned and cannot be split");

            // Load the job with related data
            var job = await context.TucJobs
                          .AsSplitQuery()
                          .Include(j => j.UcjbSpeedNavigation)
                          .FirstOrDefaultAsync(j => j.UcjbId == jobId)
                      ?? throw new InvalidOperationException($"Job {jobId} not found");

            // 1B: Use already-loaded speed navigation property (saves 1 roundtrip)
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
            job.UcjbCourierId = parentJobCourierId;
            if (!job.ParentId.HasValue || job.ParentId == job.UcjbId) job.ParentId = jobId;
            job.RootParentId ??= jobId;
            job.InformationParentId ??= job.RootParentId;

            // Create pickup job via stored procedure (leg 1: From → Meeting Point)
            var pickupInput = BuildPickupInputModel(job, pickupJobNumber, validSpeed, meetingPointAddress, userName, currentTenantTime);
            var pickupResult = await jobRepository.CreateMinimalTucJobAsync(pickupInput);
            if (!pickupResult.Success)
                throw new InvalidOperationException($"Failed to create pickup job: {pickupResult.Message}");

            // Create delivery job via stored procedure (leg 2: Meeting Point → Final Destination)
            var deliveryInput = BuildDeliveryInputModel(job, deliveryJobNumber, validSpeed, meetingPointAddress, userName, currentTenantTime);
            var deliveryResult = await jobRepository.CreateMinimalTucJobAsync(deliveryInput);
            if (!deliveryResult.Success)
                throw new InvalidOperationException($"Failed to create delivery job: {deliveryResult.Message}");

            // 1D: Load both created child jobs in one query (saves 1 roundtrip)
            var createdJobIds = new[] { pickupResult.JobId!.Value, deliveryResult.JobId!.Value };
            var createdJobs = await context.TucJobs
                .Where(j => createdJobIds.AsEnumerable().Contains(j.UcjbId)).ToListAsync();
            var pickupJob = createdJobs.FirstOrDefault(j => j.UcjbId == pickupResult.JobId)
                ?? throw new InvalidOperationException($"Failed to load created pickup job {pickupResult.JobId}");
            var deliveryJob = createdJobs.FirstOrDefault(j => j.UcjbId == deliveryResult.JobId)
                ?? throw new InvalidOperationException($"Failed to load created delivery job {deliveryResult.JobId}");

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
            pickupJob.DisplayInDespatch = false;
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
            deliveryJob.DisplayInDespatch = false;
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

            // 1E: Add notes to context before SaveChanges so everything persists in one batch (saves 1 roundtrip)
            var staffId = tenantInfoService.GetStaffId();
            AddSplitJobNotes(context, currentTenantTime, pickupJob.UcjbId, deliveryJob.UcjbId,
                job.UcjbNotes, staffId);

            await context.SaveChangesAsync();

            // 1F: Pass already-known values to avoid re-querying the parent job (saves 1 roundtrip)
            await ReRateSplitJobsAsync(context, jobId, job.UcjbAmount ?? 0m, rootParentId);

            // Consolidate MARS information
            await ConsolidateMarsInformationAsync(context, jobId, userName);

            // Update display in dispatch
            await UpdateJobDisplayInDespatchAsync(context, rootParentId);

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
                .AsNoTracking()
                .CountAsync(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId);
        }
        else
        {
            var data = await context.TucJobs.AsNoTracking()
                .Where(j => j.UcjbId == rootParentId)
                .Select(j => new
                {
                    MainJobNumber = j.UcjbNumber,
                    ExistingChildCount = context.TucJobs.Count(c => c.RootParentId == rootParentId && c.UcjbId != rootParentId)
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
        DateTime currentTenantTime) =>
        new()
        {
            JobNumber = jobNumber,
            ClientId = parentJob.UcjbClientId ?? 0,
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

            // Get all non-void child jobs under RootParentID, ordered by Sequence
            var jobIdsToRate = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId && !j.UcjbVoid)
                .OrderBy(j => j.Sequence)
                .Select(j => j.UcjbId)
                .ToListAsync();

            if (jobIdsToRate.Count == 0)
            {
                Log.Warning("No non-void jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
                return;
            }

            // Rate each job independently
            var isUs = tenantInfoService.IsUsTenant();
            var jobRates = new List<(int JobId, decimal Rate)>();

            foreach (var id in jobIdsToRate)
            {
                var rate = 0m;
                try
                {
                    if (isUs)
                    {
                        var details = await jobRepository.GetJobDetailsForRatingAsync(id);
                        rate = await rateJobService.GetJobRateUsAsync(details);
                    }
                    else
                    {
                        var details = await jobRepository.GetJobDetailsForRatingNzAsync(id, false);
                        rate = await rateJobService.GetJobRateNzAsync(details);
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to rate job {JobId}. Using rate 0.", id);
                }

                jobRates.Add((id, rate));
            }

            // Sum all rates
            var totalRate = jobRates.Sum(c => c.Rate);

            // Distribute parent amount proportionally based on calculated rates
            var runningTotal = 0m;
            for (var i = 0; i < jobRates.Count; i++)
            {
                decimal jobAmount;
                if (i == jobRates.Count - 1)
                {
                    // Last job absorbs rounding difference to ensure exact balance
                    jobAmount = parentAmount - runningTotal;
                }
                else if (totalRate == 0m)
                {
                    // All rates are 0: distribute evenly
                    jobAmount = Math.Round(parentAmount / jobRates.Count, 2);
                }
                else
                {
                    var percentage = jobRates[i].Rate / totalRate;
                    jobAmount = Math.Round(percentage * parentAmount, 2);
                }

                runningTotal += jobAmount;

                var id = jobRates[i].JobId;
                await context.TucJobs
                    .Where(j => j.UcjbId == id)
                    .ExecuteUpdateAsync(j => j
                        .SetProperty(x => x.UcjbAmount, jobAmount)
                        .SetProperty(x => x.RatedManually, false));
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

    private static async Task UpdateJobDisplayInDespatchAsync(DespatchContext context, int jobId) =>
        await context.TucJobs
            .Where(j => j.RootParentId == jobId)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.DisplayInDespatch, true));

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
