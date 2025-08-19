using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IJobRepository
{
    Task<List<Suggestion>> RelatedJobs(int parentId, int clientId);
    Task<JobViewModel> BulkJobDetail(int bulkJobId);

    Task<Tuple<int, List<JobViewModel>>> BulkSearchAsync(
        int? courierId,
        string job,
        string wild,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    );

    Task<Tuple<int, List<JobViewModel>>> PodSearch(PodSearchRequest data);

    Task UpdateManualPriceAsync(List<JobManualPriceModel> data);

    Task<List<JobDownloadModel>> PodSearchDownloadAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId
    );

    Task<List<DispatchJobViewModel>> CurrentJobList(int courierId, bool done);

    Task<List<DispatchJobViewModel>> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        ClearListEnvelopeViewModel clearListEnvelope = null);

    Task DispatchSelectedJobs(int courierId, int dispId, List<int> jobIds);
    Task SwapPod(string job1, string job2);
    Task ReDispatchSelectedJobs(int courierId, int dispId, List<int> jobIds);
    Task ReSendSelectedJobs(string jobIds);
    Task ReAssignSelectedJobs(string jobIds);
    Task SetFirstJob(int jobId, int courierId);

    Task UpdatePodDetails(UpdatePodDetailsRequest data);

    Task ReSendAllJobs(int courierId);
    Task<int> MaxAutoLatePickupAlert();
    Task<int> MaxAutoLateDeliveryAlert();
    Task<decimal> PpdExclusiveAmount(int clientId, decimal amount);

    Task ResetLateEvent(int jobId, int lateEventType);

    Task LatePickup(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    );

    Task LateDelivery(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    );

    Task RestoreSplitJobs(List<int> jobIds);
    Task RestoreJobs(List<int> jobIds);
    Task VoidJob(int jobId, string voidReason, bool voidSingleJobOnly = false);
    Task SplitJob(int jobId, string user);
    Task<string> UnSplitJob(int jobId);

    Task UpdateSplitJobAddress(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng
    );

    Task ReRateSplitJob(int jobId);
    Task FinishSplitJobProcess(int jobId, string despatcher);
    Task<List<SuburbLookup>> SuburbsAsync();
    Task<List<Suggestion>> SpeedsAsync();
    Task<List<Suggestion>> GetContactsByClientIdAsync(int clientId);
    Task<List<Lookup>> LeaveParcelLocationsAsync();
    Task<List<UndeliverableLocation>> UndeliverableLocationsAsync();
    Task<List<InternalStatus>> GetInternalStatusListAsync();
    Task<List<Suggestion>> GetStatusListAsync();
    Task<List<Suggestion>> EventTypeListAsync();

    Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId, bool isPrebook);

    Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel);
    Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel);
    Task DeleteJobPriceBreakdownAsync(int chargeId);

    Task AddPalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task EditPalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task DeletePalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task SendPrebookJobAsync(int jobId);
    Task VoidPrebookJobAsync(int jobId, string despatcher, int staffId);
    Task UpdateDeliveryAddressNzAsync(UpdateAddressRequestNz request);
    Task UpdateDeliveryAddressUsAsync(UpdateAddressRequestUs request);
    Task UpdateBookingDeliveryAddressNzAsync(UpdateAddressRequestNz request);
    Task UpdateBookingDeliveryAddressUsAsync(UpdateAddressRequestUs request);

    Task UpdatePickupAddressNzAsync(UpdateAddressRequestNz request);
    Task UpdatePickupAddressUsAsync(UpdateAddressRequestUs request);
    Task UpdateBookingPickupAddressNzAsync(UpdateAddressRequestNz request);
    Task UpdateBookingPickupAddressUsAsync(UpdateAddressRequestUs request);

    Task UpdateJobAsync(
        int jobId,
        JobProperty field,
        string value
    );

    Task UpdateBulkJobAsync(
        int bulkJobId,
        string field,
        string value,
        decimal? rate,
        string despatcher,
        int staffId
    );

    Task<int> QuickAddJobAsync(JobCreateViewModel request, int staffId);
    Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel);
    Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId);

    Task<PaginatedResponse<ClientItemsViewModel>> GetClientItemsBySpeedAsync(
        int clientId,
        int speedId,
        int jobId
    );

    Task AddClientsItemToJobAsync(int jobId, List<int> clientItemIds, decimal totalCost);

    Task<IList<OpenJobResponse>> GetOpenJobsAsync(OpenJobsRequest parameters);

    Task AddEntityAsync<T>(T entity) where T : class;

    Task<JobViewModel> GetJobByIdAsync(int jobId);
    Task UpdateJobNoteAsync(int jobId, string note);
    Task<OverviewStatsViewModel> GetOverviewStatsAsync();

    Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
        OverviewJobsRequest parameters
    );

    Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId);

    Task<decimal> RateJobAsync(
        int clientId,
        int fromId,
        int toId,
        int speed,
        bool pedal,
        bool van,
        bool returnJob,
        int weight,
        int size,
        bool includeFuelSurcharge,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked
    );

    Task RateJobUsAsync(RateJobUsDto dto);

    Task<TucJobType> GetJobTypeById(int speedId);
    Task<TucJobTypeGrouping> GetJobTypeGrouping(int groupingId);

    Task<List<AddressWithAgent>> GetClosestAirports(decimal latitude, decimal longitude);

    Task<List<MegaMapResponse>> GetJobsForMegaMapAsync();
    Task UpdatePackagesForJobAsync(int jobId, List<ParcelDimensions> parcels);

    Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(List<int> selectedViewIds);

    Task<int> SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default);

    Task SaveNoteAsync(int jobId, string noteText, bool isImportant = false,
        bool isRecurringJob = false, NoteType noteType = NoteType.InternalNote);
    
    Task<TucNoteViewModel> GetNoteByIdAsync(int noteId);
    Task DeleteNoteAsync(int noteId, CancellationToken cancellationToken = default);
    Task<List<NoteTypeViewModel>> GetNoteTypesAsync();
    Task<List<TucNoteViewModel>> GetNotesByJobId(int jobId);
    Task<bool> IsJobParentAsync(int jobId);
    Task<JobLateCallDto> GetJobForLateCallAsync(int jobId);
    Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead);
    Task AddNewTucNoteType(NoteTypeViewModel noteType);
    Task<JobRatingDetailsDto> GetJobDetailsForRating(int jobId);
    Task UpdateJobRateAsync(int jobId, decimal rate, string noteText);
    Task<List<TimeZoneSuggestion>> GetTimeZoneOptions();
    Task<JobRatingDetailsDto> GetJobBookingDetailsForRating(int jobId);

    Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId);
    Task<bool> JobNumberExistsAsync(string jobNumber);

    Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId, int? fromSuburbId,
        int? toSuburbId, int? speed, int? size, float? weight, int? quantity, int? type);

    Task<T> GetByIdAsync<T>(int id)
        where T : class;

    Task SaveChangesAsync();
    Task<List<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId);
}