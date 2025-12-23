using System;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for creating recovery agent jobs as child jobs linked to parent deliveries.
/// </summary>
public class AddAgentRecoveryJobService(
    IJobRepository repository,
    INationwideJobRepository nationwideJobRepository,
    ITenantInfoService infoService) : IAddAgentRecoveryJobService
{
    /// <summary>
    /// Creates a new recovery agent job as a child of an existing job.
    /// Copies relevant data from the parent job, assigns a recovery agent, and creates associated notes and records.
    /// </summary>
    /// <param name="request">The request containing the job ID, agent ID, airport ID, and primary agent flag.</param>
    /// <returns>The ID of the newly created recovery job.</returns>
    public async Task<int> AddRecoveryAgentJobAsync(AddAgentRecoveryRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            var job = await repository.GetByIdAsync<TucJob>(request.JobId);
            ArgumentNullException.ThrowIfNull(job);

            var newStopJobNumber = await GenerateNewStopJobNumberAsync(job.UcjbNumber);
            var parentId = job.ParentId ?? job.UcjbId;
            var agentName = await nationwideJobRepository.GetAgentNameAsync(request.AgentId);

            var newStopJob = new TucJob
            {
                UcjbNumber = newStopJobNumber,
                UcjbDate = job.UcjbDate,
                UcjbTime = job.UcjbTime,
                UcjbType = job.UcjbType,
                UcjbClientId = job.UcjbClientId,
                UcjbContact = job.UcjbContact,
                UcjbChargeType = job.UcjbChargeType,
                UcjbAmount = job.UcjbAmount,
                CourierPayment = job.CourierPayment,
                UcjbSpeed = job.UcjbSpeed,
                UcjbFrom = job.UcjbFrom,
                UcjbFromAddr = job.UcjbFromAddr,
                UcjbTo = job.UcjbTo,
                UcjbToSpecial = null,
                UcjbToAddr = job.UcjbFromAddr,
                UcjbSize = job.UcjbSize,
                UcjbQty = job.UcjbQty,
                UcjbCbd = false,
                UcjbKm = 0,
                UcjbFlightDetails = null,
                UcjbWeight = job.UcjbWeight,
                UcjbStatus = job.UcjbStatus,
                UcjbCourierId = null,
                UcjbJobDone = false,
                UcjbClientRefa = job.UcjbClientRefa,
                UcjbClientRefb = job.UcjbClientRefb,
                UcjbOurRef = job.UcjbNumber,
                UcjbOpId = job.UcjbOpId,
                UcjbDispId = null,
                UcjbVan = job.UcjbVan,
                UcjbReturn = job.UcjbReturn,
                UcjbVoid = false,
                UcjbAttention = true,
                UcjbPickUpFrom = job.UcjbPickUpFrom,
                UcjbPaged = false,
                UcjbClientCode = job.UcjbClientCode,
                UcjbRefJobId = job.UcjbId,
                UcjbDispDate = null,
                UcjbDispTime = null,
                SaturdayDelivery = false,
                ClientNotes = job.ClientNotes,
                UcjbContactPhone = job.UcjbContactPhone,
                ContactId = job.ContactId,
                DeliverToPrivateBusiness = null,
                DeliverToLeaveId = null,
                ProofOfDelivery = null,
                ProofOfDeliveryEmail = null,
                ParentId = parentId,
                JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild,
                PickupFromContact = job.PickupFromContact,
                PickupFromPhone = job.PickupFromPhone,
                DeliverToContact = job.DeliverToContact,
                DeliverToPhone = job.DeliverToPhone,
                Dgclass = job.Dgclass,
                Dgdocument = job.Dgdocument,
                RawAmount = job.RawAmount,
                PickUpLatitude = job.PickUpLatitude,
                PickUpLongitude = job.PickUpLongitude,
                DeliveryLatitude = job.DeliveryLatitude,
                DeliveryLongitude = job.DeliveryLongitude,
                FuelSurchargeAmount = 0,
                CourierFuel = job.CourierFuel,
                ShopId = job.ShopId,
                ShopRef1 = CleanShopRef(job.ShopRef1),
                ShopRef2 = CleanShopRef(job.ShopRef2),
                ShopRef3 = CleanShopRef(job.ShopRef3),
                ShopRef4 = CleanShopRef(job.ShopRef4),
                ShopRef5 = CleanShopRef(job.ShopRef5),
                CourierPercentageOverride = job.CourierPercentageOverride,
                DryIceWeight = job.DryIceWeight,
                PickupAddressLine1 = job.PickupAddressLine1,
                PickupAddressLine2 = job.PickupAddressLine2,
                PickupAddressLine3 = job.PickupAddressLine3,
                PickupAddressLine4 = job.PickupAddressLine4,
                PickupAddressLine5 = job.PickupAddressLine5,
                PickupAddressLine6 = job.PickupAddressLine6,
                PickupAddressLine7 = job.PickupAddressLine7,
                PickupAddressLine8 = job.PickupAddressLine8,
                DeliveryAddressLine1 = job.DeliveryAddressLine1,
                DeliveryAddressLine2 = job.DeliveryAddressLine2,
                DeliveryAddressLine3 = job.DeliveryAddressLine3,
                DeliveryAddressLine4 = job.DeliveryAddressLine4,
                DeliveryAddressLine5 = job.DeliveryAddressLine5,
                DeliveryAddressLine6 = job.DeliveryAddressLine6,
                DeliveryAddressLine7 = job.DeliveryAddressLine7,
                FromAirportId = job.FromAirportId,
                ToAirportId = job.ToAirportId,
                DeliverByTime = job.DeliverByTime,
                InternalStatus = job.InternalStatus,
                PickupTimeZoneId = job.PickupTimeZoneId,
                DeliverByTimeZoneId = job.DeliverByTimeZoneId,
                TotalDistance = null,
                RatedManually = true,
                DisplayInDespatch = false
            };

            // Insert the new job stop
            await repository.AddEntityAsync(newStopJob);
            await repository.SaveChangesAsync();

            Log.Debug("New Stop Job with ID: {JobId} has been created", newStopJob.UcjbId);

            var staffId = infoService.GetStaffId();
            var currentDate = infoService.GetCurrentTenantTime();

            // Add Note
            var note = CreateNote(job.UcjbId, agentName, staffId, currentDate);
            await repository.AddEntityAsync(note);

            // Add Recovery Agent Record
            var recoveryAgentRecord = CreateJobRecoveryAgent(newStopJob.UcjbId, request.AgentId, request.AirportId, staffId,
                request.IsPrimaryRecoveryAgent);
            await repository.AddEntityAsync(recoveryAgentRecord);

            // Save changes to a database
            await repository.SaveChangesAsync();

            return newStopJob.UcjbId;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error adding recovery agent job for jobId: {JobId} with AgentId : {AgentId}", request.JobId,
                request.AgentId);
            throw;
        }
    }

    /// <summary>
    /// Generates a unique job number for a recovery job by appending R1, R2, etc. to the base job number.
    /// </summary>
    /// <param name="baseJobNumber">The parent job number to use as a base.</param>
    /// <returns>A unique job number with recovery suffix.</returns>
    private async Task<string> GenerateNewStopJobNumberAsync(string baseJobNumber)
    {
        var number = 1;

        while (number <= 999) // Reasonable upper limit, adjust as needed
        {
            var newJobNumber = $"{baseJobNumber}R{number}";
            if (!await repository.JobNumberExistsAsync(newJobNumber)) return newJobNumber;
            number++;
        }

        throw new InvalidOperationException("Unable to generate unique job number - all suffixes exhausted");
    }

    /// <summary>
    /// Cleans a shop reference string by trimming whitespace or returning null if empty.
    /// </summary>
    private static string CleanShopRef(string shopRef) => string.IsNullOrWhiteSpace(shopRef) ? null : shopRef.Trim();

    /// <summary>
    /// Creates a note entity recording the addition of a recovery agent to a job.
    /// </summary>
    private static TucNote CreateNote(int jobId, string newAgent, int staffId, DateTime currentDate)
    {
        return new TucNote
        {
            JobId = jobId,
            NoteText = $"Recovery agent {newAgent} has been added.",
            CreatedBy = staffId,
            CreatedDate = currentDate,
            NoteTypeId = (int)NoteType.AgentUpdate,
            UpdatedBy = staffId,
            UpdatedDate = currentDate
        };
    }

    /// <summary>
    /// Creates a JobRecoveryAgent entity linking a recovery agent to a job at a specific airport.
    /// </summary>
    private static JobRecoveryAgent CreateJobRecoveryAgent(int jobId, int agentId, int airportId, int staffId,
        bool isPrimaryRecoveryAgent)
    {
        return new JobRecoveryAgent
        {
            JobId = jobId,
            AgentId = agentId,
            AirportId = airportId,
            CreatedBy = staffId,
            UpdatedBy = staffId,
            IsPrimary = isPrimaryRecoveryAgent
        };
    }
}