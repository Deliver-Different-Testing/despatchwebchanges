using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IJobRepository
{
    Task<JobViewModel> PreBookDetailAsync(int prebookId);
    Task<JobViewModel> GetJobByIdAsync(int jobId);
    Task<List<Size>> RelatedJobs(int parentId, int clientId);
    Task<JobViewModel> BulkJobDetail(int bulkJobId);

    Task<Tuple<int, List<JobViewModel>>> BulkSearchAsync(int? courierId, string job, string wild,
        DateTime fromDate,
        DateTime toDate, int? clientId, int pageIndex, int pageSize);

    Task<Tuple<int, List<JobViewModel>>> PodSearch(int? courierId, string wild, string job, DateTime fromDate,
        DateTime toDate, int? clientId, int pageIndex, int pageSize);

    Task<List<JobDownloadModel>> PodSearchDownloadAsync(int? courierId, string wild, string job, DateTime fromDate,
        DateTime toDate, int? clientId);

    Task UpdateManualPriceAsync(List<JobManualPriceModel> data);

    Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(int? courierId, string wild, string job,
        DateTime fromDate, DateTime toDate, int? clientId, int pageIndex, int pageSize);

    Task<List<PrebookListViewModel>> PreBookJobListAsync();
    Task<List<JobViewModel>> CurrentJobList(int courierId, bool done);

    Task<List<JobViewModel>> JobListAsync(string order,
        string ascending, bool isInternal, string clientIds, List<int> selectedViewIds,
        ClearListEnvelopeViewModel clearListEnvelope = null, DispatchStatus status = DispatchStatus.Nda);

    Task<List<SupportViewModel>> SupportEvents(string channel);
    Task<TucEvent> GetSupportEventAsync(int eventId);
    Task<int> UpdateSupportEventAsync(TucEvent supportEvent);
    Task CloseSupportEvent(int supportId, int staffId);
    Task DispatchSelectedJobs(int courierId, int dispId, string jobIds);
    Task SwapPod(string job1, string job2);
    Task ReDispatchSelectedJobs(int courierId, int dispId, string jobIds);
    Task ReSendSelectedJobs(string jobIds);
    Task<List<BulkScanDetail>> ScanList(DateTime? runDate, string scan);
    Task ReAssignSelectedJobs(string jobIds);
    Task SetFirstJob(int jobId, int courierId);
    Task TransferJob(int jobId, int courierId, int dispId);
    Task UpdatePodDetails(string jobNumber, int jobStatus, string podName, DateTime podTime);
    Task ReSendAllJobs(int courierId);
    Task<int> MaxAutoLatePickupAlert();
    Task<int> MaxAutoLateDeliveryAlert();
    Task<decimal> PpdExclusiveAmount(int clientId, decimal amount);
    Task<decimal> PpdInclusiveAmount(int clientId, decimal amount);

    Task<decimal> FuelSurchargeInclusiveAmount(int clientId, decimal amount, int from, int to,
        DateTime booked, int size);

    Task ResetLateEvent(int jobId, int eventType);

    Task LatePickup(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher,
        bool calculationRequired);

    Task LateDelivery(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher,
        bool calculationRequired);

    Task RestoreSplitJobs(string jobIds);
    Task RestoreJobs(string jobIds);
    Task MessageCourier(int courierId, int dispId, string despatcher, string message);
    Task VoidJob(int jobId);
    Task SplitJob(int jobId, string user);
    Task<string> UnSplitJob(int jobId);

    Task UpdateSplitJobAddress(int jobId, int toSuburbId, string address, decimal deliveryLat,
        decimal deliveryLng);

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

    Task<decimal> RateTruckJob(int clientId, int fromId, int toId, double weight, int size, int speed,
        int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours);

    Task<string> RateTruckJobDescription(int clientId, int fromId, int toId, double weight, int size,
        int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours);

    Task<decimal> RateJobAsync(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked);

    Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId);

    Task<string> RateJobDescription(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked);

    Task<DirectToASAPViewModel> DirectToAsap(int jobId);
    Task<UpdateFirstAvailableSpeedResult> UpdateFirstAvailableSpeed(int jobId);
    Task<SettingsViewModel> SettingsAsync();
    Task AddPalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task EditPalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task DeletePalletInfoAsync(PalletInfo p, bool preBook, string despatcher);
    Task SendPrebookJobAsync(int jobId);
    Task VoidPrebookJobAsync(int jobId, string despatcher, int staffId);
    Task<TruckItemsSummary> TruckJobItemsAsync(int jobId, int truckWeightLimit);

    Task UpdateDeliveryAddressNzAsync(UpdateAddressRequestNz request);

    Task UpdateDeliveryAddressUsAsync(UpdateAddressRequestUs request);

    Task UpdateBulkDeliveryAddressAsync(int bulkJobId, string toSuburb, int toPostCode, string address,
        decimal deliveryLat, decimal deliveryLng, string despatcher);

    Task UpdatePickupAddressNzAsync(UpdateAddressRequestNz request);

    Task UpdatePickupAddressUsAsync(UpdateAddressRequestUs request);

    Task UpdateJobTypeAsync(int jobId, int jobType, string despatcher);

    Task UpdateBulkPickupAddressAsync(int bulkJobId, string fromSuburb, int fromPostCode, string address,
        decimal pickupLat, decimal pickupLng, string despatcher);

    Task UpdateBookingDeliveryAddressAsync(int jobId, int toSuburbId, string address, decimal deliveryLat,
        decimal deliveryLng, bool cbd, decimal rate, string despatcher);

    Task UpdateBookingPickupAddressAsync(int jobId, int fromSuburbId, string address, decimal pickupLat,
        decimal pickupLng, bool cbd, decimal rate, string despatcher);

    Task ReleaseBulkJobAsync(string jobNumber, DateTime bookDate);
    Task UpdateJobAsync(int jobId, string field, string value, decimal? rate, string userName, int staffId);

    Task UpdateBulkJobAsync(int bulkJobId, string field, string value, decimal? rate, string despatcher,
        int staffId);

    Task UpdateJobBookingAsync(int jobId, string field, string value, decimal? rate, string despatcher,
        int staffId);

    Task AddNoteAsync(int jobId, string note, string despatcher);
    Task AddBulkJobNoteAsync(int bulkJobId, string note, string despatcher);
    Task AddJobBookingNoteAsync(int jobId, string note, string despatcher);
    Task<int> QuickAddJobAsync(JobCreateViewModel request, int staffId);
    Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel);
    Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId);

    Task<PagedList<ClientItemsViewModel>> GetClientItemsBySpeedAsync(int clientId, int speedId, int jobId);

    Task AddClientsItemToJobAsync(int jobId, List<int> clientItemIds, decimal totalCost);

    Task UpdateJobConnoteAsync(int jobId, string conNote);
    Task UpdateJobNoteAsync(int jobId, string note);

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
        string speeds = null);

    Task<OverviewStatsViewModel> GetOverviewStatsAsync();

    Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId);
    Task<List<MegaMapResponse>> GetJobsForMegaMapAsync();
}