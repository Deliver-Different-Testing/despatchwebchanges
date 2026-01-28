using System;
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
    ITenantInfoService tenantInfoService) : ISplitJobService
{
    private const string ParentSystemName = "SplitParent";
    private const string ChildSystemName = "SplitChild";
    private const int HandOffLeaveType = 23;
    private const int PrivateResidenceDeliverTo = 1;
    private const int AcknowledgedStatus = 12;

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

            // Get relationship type IDs
            var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context);

            // Get parent job courier ID from settings
            var parentJobCourierId = await GetParentJobCourierIdAsync(context);

            // Load the job with related data
            var job = await context.TucJobs
                          .AsSplitQuery()
                          .Include(j => j.UcjbSpeedNavigation)
                          .FirstOrDefaultAsync(j => j.UcjbId == jobId)
                      ?? throw new InvalidOperationException($"Job {jobId} not found");

            // Validate the job can be split
            if (job.ParentId.HasValue && job.ParentId != job.UcjbId)
                throw new InvalidOperationException($"Job {jobId} is already a child job and cannot be split");

            // Check if job has children (already been split)
            var hasChildren = await context.TucJobs
                .AnyAsync(j => j.ParentId == jobId && j.UcjbId != jobId);
            if (hasChildren)
                throw new InvalidOperationException($"Job {jobId} has child jobs and cannot be split");

            // Validate and get a valid speed ID
            var validSpeedId = await GetValidSpeedIdAsync(context, job.UcjbSpeed);

            // Generate child job numbers
            var pickupJobNumber = GenerateChildJobNumber(job.UcjbNumber, 1);
            var deliveryJobNumber = GenerateChildJobNumber(job.UcjbNumber, 2);

            // Capture original courier ID before modifying parent
            var originalCourierId = job.UcjbCourierId;

            // Update parent job
            job.JobRelationshipTypeId = parentRelTypeId;
            job.UcjbCourierId = parentJobCourierId;
            job.ParentId = jobId;
            job.RootParentId = jobId;
            job.InformationParentId = jobId;

            // Create pickup job (leg 1: From → Meeting Point)
            var pickupJob = CreatePickupJob(job, pickupJobNumber, validSpeedId, childRelTypeId,
                meetingPointAddress);
            pickupJob.UcjbCourierId = originalCourierId; // Pickup job keeps original courier
            context.TucJobs.Add(pickupJob);

            // Create delivery job (leg 2: Meeting Point → Final Destination)
            var deliveryJob = CreateDeliveryJob(job, deliveryJobNumber, validSpeedId, childRelTypeId,
                meetingPointAddress);
            context.TucJobs.Add(deliveryJob);

            await context.SaveChangesAsync();

            // Update child job relationships after we have their IDs
            pickupJob.ParentId = jobId;
            pickupJob.RootParentId = jobId;
            pickupJob.InformationParentId = jobId;
            pickupJob.Sequence = 1;

            deliveryJob.ParentId = jobId;
            deliveryJob.RootParentId = jobId;
            deliveryJob.InformationParentId = jobId;
            deliveryJob.Sequence = 2;

            // Set status for pickup job based on whether courier is assigned
            pickupJob.UcjbStatus = pickupJob.UcjbCourierId.HasValue ? AcknowledgedStatus : job.UcjbStatus;

            pickupJob.UcjbVan = job.UcjbVan;
            pickupJob.UcjbAttention = job.UcjbAttention;
            deliveryJob.UcjbVan = job.UcjbVan;

            await context.SaveChangesAsync();

            // Create notes for the split jobs
            var staffId = tenantInfoService.GetStaffId();
            await CreateSplitJobNotesAsync(context, currentTenantTime, pickupJob.UcjbId, deliveryJob.UcjbId,
                job.UcjbNotes, staffId);

            // Re-rate the split jobs
            await ReRateSplitJobsAsync(context, jobId);

            // Consolidate MARS information
            await ConsolidateMarsInformationAsync(context, jobId, userName);

            // Update display in dispatch
            await UpdateJobDisplayInDespatchAsync(context, jobId);

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

    /// <inheritdoc />
    public async Task<(int PickupBookingId, int DeliveryBookingId)> SplitJobBookingAsync(
        int jobBookingId,
        string userName,
        AddressViewModel meetingPointAddress)
    {
        var currentTenantTime = tenantInfoService.GetCurrentTenantTime();

        await using var context = await contextFactory.CreateDbContextAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            Log.Information("Splitting job booking {JobBookingId} by user {UserName} with meeting point address",
                jobBookingId, userName);

            // Get relationship type IDs
            var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context);

            // Load the job booking
            var jobBooking = await context.TucJobBookings
                                 .Include(j => j.UcbkSpeedNavigation)
                                 .FirstOrDefaultAsync(j => j.UcbkId == jobBookingId)
                             ?? throw new InvalidOperationException($"Job booking {jobBookingId} not found");

            // Validate the job can be split
            if (jobBooking.ParentId.HasValue && jobBooking.ParentId != jobBooking.UcbkId)
                throw new InvalidOperationException(
                    $"Job booking {jobBookingId} is already a child job and cannot be split");

            // Check if job booking has children (already been split)
            var hasChildren = await context.TucJobBookings
                .AnyAsync(j => j.ParentId == jobBookingId && j.UcbkId != jobBookingId);
            if (hasChildren)
                throw new InvalidOperationException($"Job booking {jobBookingId} has child jobs and cannot be split");

            // Validate and get a valid speed ID
            var validSpeedId = await GetValidSpeedIdAsync(context, jobBooking.UcbkSpeed);

            // Generate child job numbers
            var pickupJobNumber = GenerateChildJobNumber(jobBooking.UcbkJobNumber, 1);
            var deliveryJobNumber = GenerateChildJobNumber(jobBooking.UcbkJobNumber, 2);

            // Update parent job booking
            jobBooking.JobRelationshipTypeId = parentRelTypeId;
            jobBooking.ParentId = jobBookingId;
            jobBooking.BookingRootParentId = jobBookingId;
            jobBooking.BookingInformationParentId = jobBookingId;

            // Create pickup job booking
            var pickupJobBooking = CreatePickupJobBooking(jobBooking, pickupJobNumber, validSpeedId, childRelTypeId,
                meetingPointAddress);
            context.TucJobBookings.Add(pickupJobBooking);

            // Create delivery job booking
            var deliveryJobBooking = CreateDeliveryJobBooking(jobBooking, deliveryJobNumber, validSpeedId, childRelTypeId,
                meetingPointAddress);
            context.TucJobBookings.Add(deliveryJobBooking);

            await context.SaveChangesAsync();

            // Update child job relationships
            pickupJobBooking.ParentId = jobBookingId;
            pickupJobBooking.BookingRootParentId = jobBookingId;
            pickupJobBooking.BookingInformationParentId = jobBookingId;

            deliveryJobBooking.ParentId = jobBookingId;
            deliveryJobBooking.BookingRootParentId = jobBookingId;
            deliveryJobBooking.BookingInformationParentId = jobBookingId;

            await context.SaveChangesAsync();

            // Create notes for the split job bookings
            var staffId = tenantInfoService.GetStaffId();
            await CreateSplitJobBookingNotesAsync(context, currentTenantTime, pickupJobBooking.UcbkId,
                deliveryJobBooking.UcbkId, jobBooking.UcbkNotes, staffId);

            await transaction.CommitAsync();

            Log.Information(
                "Successfully split job booking {JobBookingId} into pickup {PickupId} and delivery {DeliveryId}",
                jobBookingId, pickupJobBooking.UcbkId, deliveryJobBooking.UcbkId);

            return (pickupJobBooking.UcbkId, deliveryJobBooking.UcbkId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Log.Error(ex, "Error splitting job booking {JobBookingId}", jobBookingId);
            throw;
        }
    }

    private static async Task<(int ParentRelTypeId, int ChildRelTypeId)> GetRelationshipTypeIdsAsync(
        DespatchContext context)
    {
        var relTypes = await context.TblJobRelationshipTypes
            .AsNoTracking()
            .Where(r => r.SystemName == ParentSystemName || r.SystemName == ChildSystemName)
            .Select(r => new { r.SystemName, r.JobRelationshipTypeId })
            .ToListAsync();

        var parentRelType = relTypes.FirstOrDefault(r => r.SystemName == ParentSystemName)
                            ?? throw new InvalidOperationException(
                                $"Job relationship type '{ParentSystemName}' not found");

        var childRelType = relTypes.FirstOrDefault(r => r.SystemName == ChildSystemName)
                           ?? throw new InvalidOperationException(
                               $"Job relationship type '{ChildSystemName}' not found");

        return (parentRelType.JobRelationshipTypeId, childRelType.JobRelationshipTypeId);
    }

    private static async Task<int?> GetParentJobCourierIdAsync(DespatchContext context) =>
        await context.TblSettings
            .AsNoTracking()
            .Where(s => s.SettingId == 1)
            .Select(s => s.ParentJobCourierId)
            .FirstOrDefaultAsync();

    private static async Task<int?> GetValidSpeedIdAsync(DespatchContext context, int? speedId)
    {
        if (!speedId.HasValue) return null;

        var speedExists = await context.TucJobTypes
            .AsNoTracking()
            .AnyAsync(jt => jt.UcjtId == speedId.Value);

        if (speedExists) return speedId;

        Log.Warning("Speed ID {SpeedId} does not exist in tucJobType table. Finding fallback speed.", speedId);

        var fallbackSpeed = await context.TucJobTypes
            .AsNoTracking()
            .OrderBy(jt => jt.UcjtId)
            .Select(jt => jt.UcjtId)
            .FirstOrDefaultAsync();

        if (fallbackSpeed == 0)
            throw new InvalidOperationException("No valid job types found in the system. Cannot create split jobs.");

        Log.Warning("Using fallback speed ID {FallbackSpeedId} instead of invalid speed {OriginalSpeedId}",
            fallbackSpeed, speedId);

        return fallbackSpeed;
    }

    private static string GenerateChildJobNumber(string parentJobNumber, int childIndex) =>
        $"{parentJobNumber}-{childIndex}";

    private static TucJob CreatePickupJob(
        TucJob parentJob,
        string jobNumber,
        int? speedId,
        int childRelTypeId,
        AddressViewModel meetingPointAddress)
    {
        return new TucJob
        {
            UcjbNumber = jobNumber,
            UcjbDate = parentJob.UcjbDate,
            UcjbTime = parentJob.UcjbTime,
            UcjbType = parentJob.UcjbType,
            UcjbClientId = parentJob.UcjbClientId,
            UcjbContact = parentJob.UcjbContact,
            UcjbChargeType = parentJob.UcjbChargeType,
            UcjbAmount = parentJob.UcjbAmount,
            UcjbSpeed = speedId,
            UcjbFrom = parentJob.UcjbFrom,
            UcjbFromAddr = parentJob.UcjbFromAddr,
            UcjbTo = null,
            UcjbToAddr = meetingPointAddress.FullAddress,
            UcjbSize = parentJob.UcjbSize,
            UcjbQty = parentJob.UcjbQty,
            UcjbCbd = parentJob.UcjbCbd,
            UcjbWeight = parentJob.UcjbWeight,
            UcjbStatus = parentJob.UcjbStatus,
            UcjbCourierId = parentJob.UcjbCourierId,
            UcjbClientRefa = parentJob.UcjbClientRefa,
            UcjbClientRefb = parentJob.UcjbClientRefb,
            UcjbOurRef = parentJob.UcjbOurRef,
            UcjbOpId = parentJob.UcjbOpId,
            UcjbReturn = parentJob.UcjbReturn,
            UcjbPickUpFrom = parentJob.UcjbPickUpFrom,
            ClientNotes = parentJob.ClientNotes,
            UcjbContactPhone = parentJob.UcjbContactPhone,
            ContactId = parentJob.ContactId,
            DeliverToPrivateBusiness = PrivateResidenceDeliverTo,
            DeliverToLeaveId = HandOffLeaveType,
            ProofOfDelivery = parentJob.ProofOfDelivery,
            ProofOfDeliveryEmail = parentJob.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parentJob.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parentJob.AcceptedJobTypeId,
            DesiredJobTypeId = parentJob.DesiredJobTypeId,
            Direct = parentJob.Direct,
            JobRelationshipTypeId = childRelTypeId,
            PickupFromContact = parentJob.PickupFromContact,
            PickupFromPhone = parentJob.PickupFromPhone,
            DeliverToContact = null,
            DeliverToPhone = null,
            DisplayInDespatch = false,
            ShopId = parentJob.ShopId,
            ShopRef1 = parentJob.ShopRef1,
            ShopRef2 = parentJob.ShopRef2,
            ShopRef3 = parentJob.ShopRef3,
            ShopRef4 = parentJob.ShopRef4,
            ShopRef5 = parentJob.ShopRef5,
            CourierPercentageOverride = parentJob.CourierPercentageOverride,
            // Copy pickup address fields from parent
            PickupAddressLine1 = parentJob.PickupAddressLine1,
            PickupAddressLine2 = parentJob.PickupAddressLine2,
            PickupAddressLine3 = parentJob.PickupAddressLine3,
            PickupAddressLine4 = parentJob.PickupAddressLine4,
            PickupAddressLine5 = parentJob.PickupAddressLine5,
            PickupAddressLine6 = parentJob.PickupAddressLine6,
            PickupAddressLine7 = parentJob.PickupAddressLine7,
            PickupAddressLine8 = parentJob.PickupAddressLine8,
            PickUpLatitude = parentJob.PickUpLatitude,
            PickUpLongitude = parentJob.PickUpLongitude,
            // Delivery address is the meeting point
            DeliveryAddressLine1 = meetingPointAddress.AddressLine1,
            DeliveryAddressLine2 = meetingPointAddress.AddressLine2,
            DeliveryAddressLine3 = meetingPointAddress.AddressLine3,
            DeliveryAddressLine4 = meetingPointAddress.AddressLine4,
            DeliveryAddressLine5 = meetingPointAddress.AddressLine5,
            DeliveryAddressLine6 = meetingPointAddress.AddressLine6,
            DeliveryAddressLine7 = meetingPointAddress.AddressLine7,
            DeliveryAddressLine8 = meetingPointAddress.AddressLine8,
            DeliveryLatitude = meetingPointAddress.Latitude,
            DeliveryLongitude = meetingPointAddress.Longitude
        };
    }

    private static TucJob CreateDeliveryJob(
        TucJob parentJob,
        string jobNumber,
        int? speedId,
        int childRelTypeId,
        AddressViewModel meetingPointAddress)
    {
        return new TucJob
        {
            UcjbNumber = jobNumber,
            UcjbDate = parentJob.UcjbDate,
            UcjbTime = parentJob.UcjbTime,
            UcjbType = parentJob.UcjbType,
            UcjbClientId = parentJob.UcjbClientId,
            UcjbContact = parentJob.UcjbContact,
            UcjbChargeType = parentJob.UcjbChargeType,
            UcjbAmount = parentJob.UcjbAmount,
            UcjbSpeed = speedId,
            UcjbFrom = null,
            UcjbFromAddr = meetingPointAddress.FullAddress,
            UcjbTo = parentJob.UcjbTo,
            UcjbToAddr = parentJob.UcjbToAddr,
            UcjbSize = parentJob.UcjbSize,
            UcjbQty = parentJob.UcjbQty,
            UcjbCbd = parentJob.UcjbCbd,
            UcjbWeight = parentJob.UcjbWeight,
            UcjbStatus = parentJob.UcjbStatus,
            UcjbCourierId = null,
            UcjbClientRefa = parentJob.UcjbClientRefa,
            UcjbClientRefb = parentJob.UcjbClientRefb,
            UcjbOurRef = parentJob.UcjbOurRef,
            UcjbOpId = parentJob.UcjbOpId,
            UcjbReturn = parentJob.UcjbReturn,
            UcjbPickUpFrom = parentJob.UcjbPickUpFrom,
            ClientNotes = parentJob.ClientNotes,
            UcjbContactPhone = parentJob.UcjbContactPhone,
            ContactId = parentJob.ContactId,
            DeliverToPrivateBusiness = parentJob.DeliverToPrivateBusiness,
            DeliverToLeaveId = parentJob.DeliverToLeaveId,
            ProofOfDelivery = parentJob.ProofOfDelivery,
            ProofOfDeliveryEmail = parentJob.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parentJob.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parentJob.AcceptedJobTypeId,
            DesiredJobTypeId = parentJob.DesiredJobTypeId,
            Direct = parentJob.Direct,
            JobRelationshipTypeId = childRelTypeId,
            PickupFromContact = null,
            PickupFromPhone = null,
            DeliverToContact = parentJob.DeliverToContact,
            DeliverToPhone = parentJob.DeliverToPhone,
            DisplayInDespatch = false,
            ShopId = parentJob.ShopId,
            ShopRef1 = parentJob.ShopRef1,
            ShopRef2 = parentJob.ShopRef2,
            ShopRef3 = parentJob.ShopRef3,
            ShopRef4 = parentJob.ShopRef4,
            ShopRef5 = parentJob.ShopRef5,
            CourierPercentageOverride = parentJob.CourierPercentageOverride,
            // Pickup address is the meeting point
            PickupAddressLine1 = meetingPointAddress.AddressLine1,
            PickupAddressLine2 = meetingPointAddress.AddressLine2,
            PickupAddressLine3 = meetingPointAddress.AddressLine3,
            PickupAddressLine4 = meetingPointAddress.AddressLine4,
            PickupAddressLine5 = meetingPointAddress.AddressLine5,
            PickupAddressLine6 = meetingPointAddress.AddressLine6,
            PickupAddressLine7 = meetingPointAddress.AddressLine7,
            PickupAddressLine8 = meetingPointAddress.AddressLine8,
            PickUpLatitude = meetingPointAddress.Latitude,
            PickUpLongitude = meetingPointAddress.Longitude,
            // Copy delivery address fields from parent
            DeliveryAddressLine1 = parentJob.DeliveryAddressLine1,
            DeliveryAddressLine2 = parentJob.DeliveryAddressLine2,
            DeliveryAddressLine3 = parentJob.DeliveryAddressLine3,
            DeliveryAddressLine4 = parentJob.DeliveryAddressLine4,
            DeliveryAddressLine5 = parentJob.DeliveryAddressLine5,
            DeliveryAddressLine6 = parentJob.DeliveryAddressLine6,
            DeliveryAddressLine7 = parentJob.DeliveryAddressLine7,
            DeliveryAddressLine8 = parentJob.DeliveryAddressLine8,
            DeliveryLatitude = parentJob.DeliveryLatitude,
            DeliveryLongitude = parentJob.DeliveryLongitude
        };
    }

    private static TucJobBooking CreatePickupJobBooking(
        TucJobBooking parentJob,
        string jobNumber,
        int? speedId,
        int childRelTypeId,
        AddressViewModel meetingPointAddress)
    {
        return new TucJobBooking
        {
            UcbkJobNumber = jobNumber,
            UcbkDate = parentJob.UcbkDate,
            UcbkTime = parentJob.UcbkTime,
            UcbkType = parentJob.UcbkType,
            UcbkClientId = parentJob.UcbkClientId,
            UcbkContact = parentJob.UcbkContact,
            UcbkChargeType = parentJob.UcbkChargeType,
            UcbkAmount = parentJob.UcbkAmount,
            UcbkSpeed = speedId,
            UcbkFrom = parentJob.UcbkFrom,
            UcbkFromAddr = parentJob.UcbkFromAddr,
            UcbkTo = 0, // No suburb ID for meeting point - using address lines instead
            UcbkToAddr = meetingPointAddress.FullAddress,
            UcbkSize = parentJob.UcbkSize,
            Quantity = parentJob.Quantity,
            UcbkWeight = parentJob.UcbkWeight,
            UcbkClientRefa = parentJob.UcbkClientRefa,
            UcbkClientRefb = parentJob.UcbkClientRefb,
            UcbkOurRef = parentJob.UcbkOurRef,
            UcbkReturn = parentJob.UcbkReturn,
            UcbkPickUpFrom = parentJob.UcbkPickUpFrom,
            ContactId = parentJob.ContactId,
            DeliverToPrivateBusiness = PrivateResidenceDeliverTo,
            DeliverToLeaveId = HandOffLeaveType,
            ProofOfDelivery = parentJob.ProofOfDelivery,
            ProofOfDeliveryEmail = parentJob.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parentJob.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parentJob.AcceptedJobTypeId,
            DesiredJobTypeId = parentJob.DesiredJobTypeId,
            Direct = parentJob.Direct,
            JobRelationshipTypeId = childRelTypeId,
            PickupFromContact = parentJob.PickupFromContact,
            PickupFromPhone = parentJob.PickupFromPhone,
            ShopId = parentJob.ShopId,
            ShopRef1 = parentJob.ShopRef1,
            ShopRef2 = parentJob.ShopRef2,
            ShopRef3 = parentJob.ShopRef3,
            ShopRef4 = parentJob.ShopRef4,
            ShopRef5 = parentJob.ShopRef5,
            CourierPercentageOverride = parentJob.CourierPercentageOverride,
            // Copy pickup address fields from parent
            PickupAddressLine1 = parentJob.PickupAddressLine1,
            PickupAddressLine2 = parentJob.PickupAddressLine2,
            PickupAddressLine3 = parentJob.PickupAddressLine3,
            PickupAddressLine4 = parentJob.PickupAddressLine4,
            PickupAddressLine5 = parentJob.PickupAddressLine5,
            PickupAddressLine6 = parentJob.PickupAddressLine6,
            PickupAddressLine7 = parentJob.PickupAddressLine7,
            PickupAddressLine8 = parentJob.PickupAddressLine8,
            // Delivery address is the meeting point
            DeliveryAddressLine1 = meetingPointAddress.AddressLine1,
            DeliveryAddressLine2 = meetingPointAddress.AddressLine2,
            DeliveryAddressLine3 = meetingPointAddress.AddressLine3,
            DeliveryAddressLine4 = meetingPointAddress.AddressLine4,
            DeliveryAddressLine5 = meetingPointAddress.AddressLine5,
            DeliveryAddressLine6 = meetingPointAddress.AddressLine6,
            DeliveryAddressLine7 = meetingPointAddress.AddressLine7,
            DeliveryAddressLine8 = meetingPointAddress.AddressLine8
        };
    }

    private static TucJobBooking CreateDeliveryJobBooking(
        TucJobBooking parentJob,
        string jobNumber,
        int? speedId,
        int childRelTypeId,
        AddressViewModel meetingPointAddress)
    {
        return new TucJobBooking
        {
            UcbkJobNumber = jobNumber,
            UcbkDate = parentJob.UcbkDate,
            UcbkTime = parentJob.UcbkTime,
            UcbkType = parentJob.UcbkType,
            UcbkClientId = parentJob.UcbkClientId,
            UcbkContact = parentJob.UcbkContact,
            UcbkChargeType = parentJob.UcbkChargeType,
            UcbkAmount = parentJob.UcbkAmount,
            UcbkSpeed = speedId,
            UcbkFrom = 0, // No suburb ID for meeting point - using address lines instead
            UcbkFromAddr = meetingPointAddress.FullAddress,
            UcbkTo = parentJob.UcbkTo,
            UcbkToAddr = parentJob.UcbkToAddr,
            UcbkSize = parentJob.UcbkSize,
            Quantity = parentJob.Quantity,
            UcbkWeight = parentJob.UcbkWeight,
            UcbkClientRefa = parentJob.UcbkClientRefa,
            UcbkClientRefb = parentJob.UcbkClientRefb,
            UcbkOurRef = parentJob.UcbkOurRef,
            UcbkReturn = parentJob.UcbkReturn,
            UcbkPickUpFrom = parentJob.UcbkPickUpFrom,
            ContactId = parentJob.ContactId,
            DeliverToPrivateBusiness = parentJob.DeliverToPrivateBusiness,
            DeliverToLeaveId = parentJob.DeliverToLeaveId,
            ProofOfDelivery = parentJob.ProofOfDelivery,
            ProofOfDeliveryEmail = parentJob.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parentJob.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parentJob.AcceptedJobTypeId,
            DesiredJobTypeId = parentJob.DesiredJobTypeId,
            Direct = parentJob.Direct,
            JobRelationshipTypeId = childRelTypeId,
            DeliverToContact = parentJob.DeliverToContact,
            DeliverToPhone = parentJob.DeliverToPhone,
            ShopId = parentJob.ShopId,
            ShopRef1 = parentJob.ShopRef1,
            ShopRef2 = parentJob.ShopRef2,
            ShopRef3 = parentJob.ShopRef3,
            ShopRef4 = parentJob.ShopRef4,
            ShopRef5 = parentJob.ShopRef5,
            CourierPercentageOverride = parentJob.CourierPercentageOverride,
            // Pickup address is the meeting point
            PickupAddressLine1 = meetingPointAddress.AddressLine1,
            PickupAddressLine2 = meetingPointAddress.AddressLine2,
            PickupAddressLine3 = meetingPointAddress.AddressLine3,
            PickupAddressLine4 = meetingPointAddress.AddressLine4,
            PickupAddressLine5 = meetingPointAddress.AddressLine5,
            PickupAddressLine6 = meetingPointAddress.AddressLine6,
            PickupAddressLine7 = meetingPointAddress.AddressLine7,
            PickupAddressLine8 = meetingPointAddress.AddressLine8,
            // Copy delivery address fields from parent
            DeliveryAddressLine1 = parentJob.DeliveryAddressLine1,
            DeliveryAddressLine2 = parentJob.DeliveryAddressLine2,
            DeliveryAddressLine3 = parentJob.DeliveryAddressLine3,
            DeliveryAddressLine4 = parentJob.DeliveryAddressLine4,
            DeliveryAddressLine5 = parentJob.DeliveryAddressLine5,
            DeliveryAddressLine6 = parentJob.DeliveryAddressLine6,
            DeliveryAddressLine7 = parentJob.DeliveryAddressLine7,
            DeliveryAddressLine8 = parentJob.DeliveryAddressLine8
        };
    }

    private static async Task ReRateSplitJobsAsync(DespatchContext context, int parentJobId)
    {
        try
        {
            await context.Procedures.DES_stpJob_SplitJob_ReRateAsync(parentJobId, false);
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

    private static async Task UpdateJobDisplayInDespatchAsync(DespatchContext context, int jobId)
    {
        await context.TucJobs
            .Where(j => j.RootParentId == jobId)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.DisplayInDespatch, true));
    }

    private static async Task CreateSplitJobNotesAsync(
        DespatchContext context,
        DateTime currentTenantTime,
        int pickupJobId,
        int deliveryJobId,
        string parentNotes,
        int? staffId)
    {
        var parentNotesText = string.IsNullOrWhiteSpace(parentNotes) ? string.Empty : $"  {parentNotes}";

        var pickupNote = new TucNote
        {
            JobId = pickupJobId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 1 of 2{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        var deliveryNote = new TucNote
        {
            JobId = deliveryJobId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 2 of 2{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        await context.TucNotes.AddRangeAsync(pickupNote, deliveryNote);
        await context.SaveChangesAsync();
    }

    private static async Task CreateSplitJobBookingNotesAsync(
        DespatchContext context,
        DateTime currentTenantTime,
        int pickupJobBookingId,
        int deliveryJobBookingId,
        string parentNotes,
        int? staffId)
    {
        var parentNotesText = string.IsNullOrWhiteSpace(parentNotes) ? string.Empty : $"  {parentNotes}";

        var pickupNote = new TucNote
        {
            JobBookingId = pickupJobBookingId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 1 of 2{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        var deliveryNote = new TucNote
        {
            JobBookingId = deliveryJobBookingId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 2 of 2{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        await context.TucNotes.AddRangeAsync(pickupNote, deliveryNote);
        await context.SaveChangesAsync();
    }
}
