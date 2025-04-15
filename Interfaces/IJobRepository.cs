using System;
using System.Collections.Generic;
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

    Task<Tuple<int, List<JobViewModel>>> PodSearch(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    );

    Task UpdateManualPriceAsync(List<JobManualPriceModel> data);

    Task<List<JobDownloadModel>> PodSearchDownloadAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId
    );

    Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    );

    Task<List<PrebookListViewModel>> PreBookJobListAsync();
    Task<List<DispatchJobViewModel>> CurrentJobList(int courierId, bool done);

    Task<List<DispatchJobViewModel>> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        ClearListEnvelopeViewModel clearListEnvelope = null);

    Task<TucEvent> GetSupportEventAsync(int eventId);
    Task<int> UpdateSupportEventAsync(TucEvent supportEvent);
    Task CloseSupportEvent(int supportId, int staffId);
    Task DispatchSelectedJobs(int courierId, int dispId, List<int> jobIds);
    Task SwapPod(string job1, string job2);
    Task ReDispatchSelectedJobs(int courierId, int dispId, List<int> jobIds);
    Task ReSendSelectedJobs(string jobIds);
    Task<List<BulkScanDetail>> ScanList(DateTime? runDate, string scan);
    Task ReAssignSelectedJobs(string jobIds);
    Task SetFirstJob(int jobId, int courierId);
    Task TransferJob(int jobId, int courierId, int dispId);

    Task UpdatePodDetails(int jobId, int jobStatus, string podName, DateTime podTime);

    Task ReSendAllJobs(int courierId);
    Task<int> MaxAutoLatePickupAlert();
    Task<int> MaxAutoLateDeliveryAlert();
    Task<decimal> PpdExclusiveAmount(int clientId, decimal amount);
    Task<decimal> PpdInclusiveAmount(int clientId, decimal amount);

    Task<decimal> FuelSurchargeInclusiveAmount(
        int clientId,
        decimal amount,
        int from,
        int to,
        DateTime booked,
        int size
    );

    Task ResetLateEvent(int jobId, int lateEventType);

    Task LatePickup(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        int staffId,
        bool calculationRequired
    );

    Task LateDelivery(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        int staffId,
        bool calculationRequired
    );

    Task RestoreSplitJobs(List<int> jobIds);
    Task RestoreJobs(List<int> jobIds);
    Task MessageCourier(int courierId, int dispId, string despatcher, string message);
    Task VoidJob(int jobId);
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
    Task<List<Suggestion>> ContactsAsync(int clientId);
    Task<List<ClientContactDetailViewModel>> ContactDetailList(int clientId);
    Task<List<Lookup>> LeaveParcelLocationsAsync();
    Task<List<UndeliverableLocation>> UndeliverableLocationsAsync();
    Task<List<InternalStatus>> GetInternalStatusListAsync();
    Task<List<Suggestion>> GetStatusListAsync();
    Task<List<Suggestion>> EventTypeListAsync();

    Task<decimal> RateTruckJob(
        int clientId,
        int fromId,
        int toId,
        double weight,
        int size,
        int speed,
        int qty,
        DateTime bookedDate,
        int pickUp,
        int dropOff,
        bool privateRes,
        int oversizeItems,
        int overWeightItems,
        int dGClass,
        DateTime truckStartTime,
        double truckHours
    );

    Task<string> RateTruckJobDescription(
        int clientId,
        int fromId,
        int toId,
        double weight,
        int size,
        int speed,
        int qty,
        DateTime bookedDate,
        int pickUp,
        int dropOff,
        bool privateRes,
        int oversizeItems,
        int overWeightItems,
        int dGClass,
        DateTime truckStartTime,
        double truckHours
    );

    Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId);

    Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel, int staffId);
    Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel, int staffId);
    Task DeleteJobPriceBreakdownAsync(int chargeId, int staffId);

    Task<string> RateJobDescription(
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
        bool direct,
        int acceptedJobTypeId,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked
    );

    Task<DirectToASAPViewModel> DirectToAsap(int jobId);
    Task<UpdateFirstAvailableSpeedResult> UpdateFirstAvailableSpeed(int jobId);
    Task AddPalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task EditPalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task DeletePalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task SendPrebookJobAsync(int jobId);
    Task VoidPrebookJobAsync(int jobId, string despatcher, int staffId);
    Task<TruckItemsSummary> TruckJobItemsAsync(int jobId, int truckWeightLimit);
    Task UpdateDeliveryAddressNzAsync(UpdateAddressRequestNz request);
    Task UpdateDeliveryAddressUsAsync(UpdateAddressRequestUs request);

    Task UpdateBulkDeliveryAddressAsync(
        int bulkJobId,
        string toSuburb,
        int toPostCode,
        string address,
        decimal deliveryLat,
        decimal deliveryLng,
        string despatcher
    );

    Task UpdatePickupAddressNzAsync(UpdateAddressRequestNz request);
    Task UpdatePickupAddressUsAsync(UpdateAddressRequestUs request);
    Task UpdateJobTypeAsync(int jobId, int jobType, string despatcher);

    Task UpdateBulkPickupAddressAsync(
        int bulkJobId,
        string fromSuburb,
        int fromPostCode,
        string address,
        decimal pickupLat,
        decimal pickupLng,
        string despatcher
    );

    Task UpdateBookingDeliveryAddressAsync(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng,
        bool cbd,
        decimal rate,
        string despatcher
    );

    Task UpdateBookingPickupAddressAsync(
        int jobId,
        int fromSuburbId,
        string address,
        decimal pickupLat,
        decimal pickupLng,
        bool cbd,
        decimal rate,
        string despatcher
    );

    Task ReleaseBulkJobAsync(string jobNumber, DateTime bookDate);

    Task UpdateJobAsync(
        int jobId,
        string field,
        string value,
        decimal? rate,
        string userName,
        int staffId
    );

    Task UpdateBulkJobAsync(
        int bulkJobId,
        string field,
        string value,
        decimal? rate,
        string despatcher,
        int staffId
    );

    Task UpdateJobBookingAsync(
        int jobId,
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

    Task<IList<OpenJobResponse>> GetOpenJobsAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string regions = null,
        string speeds = null
    );

    Task<DriverStats> GetDriverStatsAsync(int courierId);
    void Dispose();

    Task<T> Add<T>(T entity)
        where T : class;

    Task<JobViewModel> GetJobByIdAsync(int jobId);
    Task UpdateJobNoteAsync(int jobId, string note);
    Task UpdateJobConnoteAsync(int jobId, string conNote);
    Task<OverviewStatsViewModel> GetOverviewStatsAsync();

    Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
        int page,
        int limit,
        bool isUsCustomer = true,
        string search = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        string orderBy = "jobName",
        string orderDirection = "asc",
        string regions = null,
        string speeds = null
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
        bool direct,
        int acceptedJobTypeId,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked
    );

    Task<decimal> RateJobUsAsync(
        int jobId,
        int clientId,
        int speed,
        string fromZip,
        string toZip,
        decimal totalMiles,
        decimal fromMiles,
        decimal toMiles,
        int weight,
        DateTime booked,
        int size,
        bool dangerousGoods,
        int totalPallets,
        int extraStopOffs,
        int dryIceWeight,
        int waitTime,
        int? fromAgentId,
        int? fromAirportId,
        int? toAgentId,
        int? toAirportId
    );

    Task<TucJobType> GetJobTypeById(int speedId);
    Task<TucJobTypeGrouping> GetJobTypeGrouping(int groupingId);

    Task<List<AddressWithAgent>> GetClosestAirports(decimal latitude, decimal longitude);

    Task<List<MegaMapResponse>> GetJobsForMegaMapAsync();
    Task UpdatePackagesForJobAsync(int jobId, List<ParcelDimensions> parcels);

    Task<List<T>> GetAllAsync<T>()
        where T : class;

    Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds);

    Task<int> SaveNoteAsync(TucNoteViewModel viewModel);
    Task<int> SaveNoteAsync(int jobId, string noteText, bool isImportant = false, bool isRecurringJob = false);
    Task<TucNoteViewModel> GetNoteByIdAsync(int noteId);
    Task DeleteNoteAsync(int noteId);
    Task<List<Suggestion>> GetNoteTypesAsync();
    Task<List<TucNoteViewModel>> GetNotesByJobId(int jobId);
    Task<bool> IsJobParentAsync(int jobId);
    Task<JobLateCallDto> GetJobForLateCallAsync(int jobId);
    Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead);
}
