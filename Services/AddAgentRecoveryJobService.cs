using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for creating recovery agent jobs as child jobs linked to parent deliveries.
/// </summary>
public sealed class AddAgentRecoveryJobService(
    IJobQueryRepository queryRepository,
    IJobCommandRepository commandRepository,
    INationwideJobRepository nationwideJobRepository,
    ITenantInfoService infoService,
    ITenantClock clock) : IAddAgentRecoveryJobService
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

            var job = await queryRepository.GetByIdAsync<TucJob>(request.JobId);
            ArgumentNullException.ThrowIfNull(job);

            var newStopJobNumber = await GenerateNewStopJobNumberAsync(job.UcjbNumber);
            var parentId = job.ParentId ?? job.UcjbId;
            var agentName = await nationwideJobRepository.GetAgentNameAsync(request.AgentId);

            var input = BuildRecoveryJobInputModel(job, newStopJobNumber);
            var createResult = await commandRepository.CreateMinimalTucJobAsync(input);
            if (!createResult.Success || !createResult.JobId.HasValue)
            {
                throw new InvalidOperationException($"Failed to create recovery agent job: {createResult.Message}");
            }

            // Load the created job and overwrite the fields the stored procedure doesn't handle.
            var newStopJob = await queryRepository.GetByIdAsync<TucJob>(createResult.JobId.Value);
            ArgumentNullException.ThrowIfNull(newStopJob);

            ApplyRecoveryLegFields(newStopJob, job, parentId);
            await commandRepository.SaveChangesAsync();

            Log.Debug("New Stop Job with ID: {JobId} has been created", newStopJob.UcjbId);

            var staffId = infoService.GetStaffId();
            var currentDate = clock.TenantNow;

            // Add Note
            var note = CreateNote(job.UcjbId, agentName, staffId, currentDate);
            await commandRepository.AddEntityAsync(note);

            // Add Recovery Agent Record
            var recoveryAgentRecord = CreateJobRecoveryAgent(newStopJob.UcjbId, request.AgentId, request.AirportId,
                staffId, request.IsPrimaryRecoveryAgent);
            await commandRepository.AddEntityAsync(recoveryAgentRecord);

            await commandRepository.SaveChangesAsync();

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
    /// Builds the minimal create-job input for the recovery leg. The leg starts as an ordinary job
    /// (a non-zero placeholder charge, no parent/relationship); <see cref="ApplyRecoveryLegFields"/>
    /// turns it into the hidden, zero-charge SplitChild afterward.
    /// </summary>
    private CreateMinimalTucJobInputModel BuildRecoveryJobInputModel(TucJob job, string newStopJobNumber) =>
        new()
        {
            JobNumber = newStopJobNumber,
            ClientId = job.UcjbClientId ?? 0,
            SpeedId = job.UcjbSpeed ?? 0,
            Amount = job.UcjbAmount ?? 0m,
            FromAddress = BuildAddress(job.PickupAddressLine1, job.PickupAddressLine2, job.PickupAddressLine3,
                job.PickupAddressLine4, job.PickupAddressLine5, job.PickupAddressLine6, job.PickupAddressLine7,
                job.PickupAddressLine8, job.UcjbFromAddr ?? job.UcjbNumber, job.PickUpLatitude, job.PickUpLongitude),
            ToAddress = BuildAddress(job.DeliveryAddressLine1, job.DeliveryAddressLine2, job.DeliveryAddressLine3,
                job.DeliveryAddressLine4, job.DeliveryAddressLine5, job.DeliveryAddressLine6, job.DeliveryAddressLine7,
                null, job.UcjbFromAddr ?? job.UcjbNumber, job.DeliveryLatitude, job.DeliveryLongitude),
            Reference = job.UcjbClientRefa,
            ReferenceB = job.UcjbClientRefb,
            OurRef = job.UcjbNumber,
            BookedBy = string.IsNullOrWhiteSpace(job.UcjbContact) ? job.UcjbNumber : job.UcjbContact,
            FromContactName = job.PickupFromContact,
            FromPhoneNumber = job.PickupFromPhone,
            ToContactName = job.DeliverToContact,
            ToPhoneNumber = job.DeliverToPhone,
            PickUpLatitude = job.PickUpLatitude,
            PickUpLongitude = job.PickUpLongitude,
            DeliveryLatitude = job.DeliveryLatitude,
            DeliveryLongitude = job.DeliveryLongitude,
            DgClass = job.Dgclass,
            DryIceWeight = job.DryIceWeight,
            FuelSurchargeAmount = 0,
            LoggedInContactId = infoService.GetContactId(),
            TenantCurrentTime = clock.TenantNow
        };

    /// <summary>
    /// Overwrites the freshly created job with the recovery leg's data: copies the parent's details,
    /// links it as a hidden SplitChild, and zeroes the client charge so the parent keeps it.
    /// </summary>
    private static void ApplyRecoveryLegFields(TucJob newStopJob, TucJob job, int parentId)
    {
        newStopJob.UcjbDate = job.UcjbDate;
        newStopJob.UcjbTime = job.UcjbTime;
        newStopJob.UcjbType = job.UcjbType;
        newStopJob.UcjbClientId = job.UcjbClientId;
        newStopJob.UcjbContact = job.UcjbContact;
        newStopJob.UcjbChargeType = job.UcjbChargeType;
        newStopJob.UcjbAmount = 0m;
        newStopJob.CourierPayment = job.CourierPayment;
        newStopJob.UcjbSpeed = job.UcjbSpeed;
        newStopJob.UcjbFrom = job.UcjbFrom;
        newStopJob.UcjbFromAddr = job.UcjbFromAddr;
        newStopJob.UcjbTo = job.UcjbTo;
        newStopJob.UcjbToSpecial = null;
        newStopJob.UcjbToAddr = job.UcjbFromAddr;
        newStopJob.UcjbSize = job.UcjbSize;
        newStopJob.UcjbQty = job.UcjbQty;
        newStopJob.UcjbCbd = false;
        newStopJob.UcjbKm = 0;
        newStopJob.UcjbFlightDetails = null;
        newStopJob.UcjbWeight = job.UcjbWeight;
        newStopJob.UcjbStatus = job.UcjbStatus;
        newStopJob.UcjbCourierId = null;
        newStopJob.UcjbJobDone = false;
        newStopJob.UcjbClientRefa = job.UcjbClientRefa;
        newStopJob.UcjbClientRefb = job.UcjbClientRefb;
        newStopJob.UcjbOurRef = job.UcjbNumber;
        newStopJob.UcjbOpId = job.UcjbOpId;
        newStopJob.UcjbDispId = null;
        newStopJob.UcjbVan = job.UcjbVan;
        newStopJob.UcjbReturn = job.UcjbReturn;
        newStopJob.UcjbVoid = false;
        newStopJob.UcjbAttention = true;
        newStopJob.UcjbPickUpFrom = job.UcjbPickUpFrom;
        newStopJob.UcjbPaged = false;
        newStopJob.UcjbClientCode = job.UcjbClientCode;
        newStopJob.UcjbRefJobId = job.UcjbId;
        newStopJob.UcjbDispDate = null;
        newStopJob.UcjbDispTime = null;
        newStopJob.SaturdayDelivery = false;
        newStopJob.ClientNotes = job.ClientNotes;
        newStopJob.UcjbContactPhone = job.UcjbContactPhone;
        newStopJob.ContactId = job.ContactId;
        newStopJob.DeliverToPrivateBusiness = null;
        newStopJob.DeliverToLeaveId = null;
        newStopJob.ProofOfDelivery = null;
        newStopJob.ProofOfDeliveryEmail = null;
        newStopJob.ParentId = parentId;
        newStopJob.JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild;
        newStopJob.PickupFromContact = job.PickupFromContact;
        newStopJob.PickupFromPhone = job.PickupFromPhone;
        newStopJob.DeliverToContact = job.DeliverToContact;
        newStopJob.DeliverToPhone = job.DeliverToPhone;
        newStopJob.Dgclass = job.Dgclass;
        newStopJob.Dgdocument = job.Dgdocument;
        newStopJob.RawAmount = job.RawAmount;
        newStopJob.PickUpLatitude = job.PickUpLatitude;
        newStopJob.PickUpLongitude = job.PickUpLongitude;
        newStopJob.DeliveryLatitude = job.DeliveryLatitude;
        newStopJob.DeliveryLongitude = job.DeliveryLongitude;
        newStopJob.FuelSurchargeAmount = 0;
        newStopJob.CourierFuel = job.CourierFuel;
        newStopJob.ShopId = job.ShopId;
        newStopJob.ShopRef1 = CleanShopRef(job.ShopRef1);
        newStopJob.ShopRef2 = CleanShopRef(job.ShopRef2);
        newStopJob.ShopRef3 = CleanShopRef(job.ShopRef3);
        newStopJob.ShopRef4 = CleanShopRef(job.ShopRef4);
        newStopJob.ShopRef5 = CleanShopRef(job.ShopRef5);
        newStopJob.CourierPercentageOverride = job.CourierPercentageOverride;
        newStopJob.DryIceWeight = job.DryIceWeight;
        newStopJob.PickupAddressLine1 = job.PickupAddressLine1;
        newStopJob.PickupAddressLine2 = job.PickupAddressLine2;
        newStopJob.PickupAddressLine3 = job.PickupAddressLine3;
        newStopJob.PickupAddressLine4 = job.PickupAddressLine4;
        newStopJob.PickupAddressLine5 = job.PickupAddressLine5;
        newStopJob.PickupAddressLine6 = job.PickupAddressLine6;
        newStopJob.PickupAddressLine7 = job.PickupAddressLine7;
        newStopJob.PickupAddressLine8 = job.PickupAddressLine8;
        newStopJob.DeliveryAddressLine1 = job.DeliveryAddressLine1;
        newStopJob.DeliveryAddressLine2 = job.DeliveryAddressLine2;
        newStopJob.DeliveryAddressLine3 = job.DeliveryAddressLine3;
        newStopJob.DeliveryAddressLine4 = job.DeliveryAddressLine4;
        newStopJob.DeliveryAddressLine5 = job.DeliveryAddressLine5;
        newStopJob.DeliveryAddressLine6 = job.DeliveryAddressLine6;
        newStopJob.DeliveryAddressLine7 = job.DeliveryAddressLine7;
        newStopJob.FromAirportId = job.FromAirportId;
        newStopJob.ToAirportId = job.ToAirportId;
        newStopJob.DeliverByTime = job.DeliverByTime;
        newStopJob.InternalStatus = job.InternalStatus;
        newStopJob.PickupTimeZoneId = job.PickupTimeZoneId;
        newStopJob.DeliverByTimeZoneId = job.DeliverByTimeZoneId;
        newStopJob.TotalDistance = null;
        newStopJob.RatedManually = true;
        newStopJob.DisplayInDespatch = false;
    }

    /// <summary>
    /// Builds an address view model from the parent's structured lines, falling back to a single line
    /// so <see cref="AddressViewModel.FullAddress"/> is never empty (the create-job validation rejects
    /// blank addresses). The leg's real addresses are set in <see cref="ApplyRecoveryLegFields"/>.
    /// </summary>
    private static AddressViewModel BuildAddress(string line1, string line2, string line3, string line4, string line5,
        string line6, string line7, string line8, string fallback, decimal? latitude, decimal? longitude)
    {
        var address = new AddressViewModel
        {
            AddressLine1 = line1,
            AddressLine2 = line2,
            AddressLine3 = line3,
            AddressLine4 = line4,
            AddressLine5 = line5,
            AddressLine6 = line6,
            AddressLine7 = line7,
            AddressLine8 = line8,
            Latitude = latitude,
            Longitude = longitude
        };

        if (!string.IsNullOrWhiteSpace(address.FullAddress))
        {
            return address;
        }

        return new AddressViewModel
        {
            AddressLine1 = fallback,
            Latitude = latitude,
            Longitude = longitude
        };
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
            if (!await queryRepository.JobNumberExistsAsync(newJobNumber))
            {
                return newJobNumber;
            }

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
    private static TucNote CreateNote(int jobId, string newAgent, int staffId, DateTime currentDate) =>
        new()
        {
            JobId = jobId,
            NoteText = $"Recovery agent {newAgent} has been added.",
            CreatedBy = staffId,
            CreatedDate = currentDate,
            NoteTypeId = (int)NoteType.AgentUpdate,
            UpdatedBy = staffId,
            UpdatedDate = currentDate
        };

    /// <summary>
    /// Creates a JobRecoveryAgent entity linking a recovery agent to a job at a specific airport.
    /// </summary>
    private static JobRecoveryAgent CreateJobRecoveryAgent(int jobId, int agentId, int airportId, int staffId,
        bool isPrimaryRecoveryAgent) =>
        new()
        {
            JobId = jobId,
            AgentId = agentId,
            AirportId = airportId,
            CreatedBy = staffId,
            UpdatedBy = staffId,
            IsPrimary = isPrimaryRecoveryAgent
        };
}