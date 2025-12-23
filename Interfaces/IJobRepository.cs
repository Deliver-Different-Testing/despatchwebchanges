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
    Task<JobGroupViewModel> GetBulkJobDetailAsync(int bulkJobId);
    Task<DispatchJobViewModel> GetBulkDispatchJobDetailAsync(int bulkJobId);

    Task<JobSearchResult> BulkSearchAsync(PodSearchRequest data);
    Task<JobSearchResult> PodSearchAsync(PodSearchRequest data);

    Task UpdateManualPriceAsync(List<JobManualPriceModel> data);

    Task<List<JobDownloadModel>> PodSearchDownloadAsync(
        List<int> courierIds,
        List<int> speedIds,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        List<int> clientIds
    );

    Task<List<PerformanceSpendReportModel>> GetClientJobsReportDataAsync(ClientJobsReportRequest request);

    Task<JobSearchResult> CurrentJobListAsync(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate);

    Task<JobSearchResult> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        int? selectedClearListId = null);

    Task SwapPodAsync(string job1, string job2);
    Task ReDispatchSelectedJobsAsync(List<int> jobIds);
    Task ReSendSelectedJobsAsync(string jobIds);
    Task ReAssignSelectedJobsAsync(string jobIds);
    Task SetFirstJobAsync(int jobId, int courierId);

    Task UpdatePodDetailsAsync(UpdatePodDetailsRequest data);

    Task ReSendAllJobsAsync(int courierId);
    Task<int> MaxAutoLatePickupAlertAsync();
    Task<int> MaxAutoLateDeliveryAlertAsync();
    Task<decimal> PpdExclusiveAmountAsync(int clientId, decimal amount);

    Task ResetLateEventAsync(int jobId, int lateEventType);

    Task LatePickupAsync(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    );

    Task LateDeliveryAsync(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    );

    Task RestoreSplitJobsAsync(List<int> jobIds);
    Task RestoreJobsAsync(List<int> jobIds);
    Task VoidJobAsync(VoidJobRequest data);
    Task VoidBulkJobAsync(VoidBulkJobRequest data);
    Task SplitJobAsync(int jobId, string user);
    Task<string> UnSplitJobAsync(int jobId);

    Task UpdateSplitJobAddressAsync(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng
    );

    Task ReRateSplitJobAsync(int jobId);
    Task FinishSplitJobProcessAsync(int jobId, string despatcher);
    Task<List<Suggestion>> GetSpeedsAsync();
    Task<List<Suggestion>> GetSpeedsBySearchTermAsync(string searchTerm);
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

    Task VoidPrebookJobAsync(int jobId);

    /* Address Updates */
    Task UpdateDeliveryAddressAsync(UpdateAddressRequest request);
    Task UpdatePickupAddressAsync(UpdateAddressRequest request);

    Task UpdateJobAsync(
        int jobId,
        JobProperty field,
        string value
    );

    Task UpdateBulkJobAsync(
        int bulkJobId,
        JobProperty property,
        string value);

    Task ReleaseBulkJobByIdAsync(int bulkJobId);

    Task<int> QuickAddJobAsync(JobCreateViewModel request);
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

    Task<JobGroupViewModel> GetJobByIdAsync(int jobId);
    Task<JobViewModel> GetSingleJobById(int jobId);
    Task UpdateJobNoteAsync(int jobId, string note);
    Task<OverviewStatsViewModel> GetOverviewStatsAsync();

    Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
        OverviewJobsRequest parameters
    );

    Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId);

    Task RateJobUsAsync(RateJobUsDto dto);

    Task<TucJobType> GetJobTypeByIdAsync(int speedId);

    Task<List<AddressWithAgent>> GetClosestAirportsAsync(decimal latitude, decimal longitude);

    Task<List<MegaMapResponse>> GetJobsForMegaMapAsync();
    Task UpdatePackagesForJobAsync(int jobId, List<ParcelDimensions> parcels);
    Task UpdatePackagesForBulkJobAsync(int bulkJobId, List<ParcelDimensions> parcels);

    Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(List<int> selectedViewIds);

    Task SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default);
    Task SaveBulkNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default);

    Task<TucNoteViewModel> GetNoteByIdAsync(int noteId);
    Task DeleteNoteAsync(int noteId, CancellationToken cancellationToken = default);
    Task<List<NoteTypeViewModel>> GetNoteTypesAsync();
    Task<List<TucNoteViewModel>> GetBulkJobNotesByBulkJobIdAsync(int bulkJobId);
    Task<List<TucNoteViewModel>> GetNotesByJobIdAsync(int jobId);
    Task<bool> IsJobParentAsync(int jobId);
    Task<bool> IsBulkJobParent(int bulkJobId);
    Task<JobLateCallDto> GetJobForLateCallAsync(int jobId);
    Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead);
    Task AddNewTucNoteTypeAsync(NoteTypeViewModel noteType);
    Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(int jobId);
    Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(int jobId, bool isArchived);
    Task<JobRatingDetailsDtoNz> GetJobBookingDetailsForRatingNzAsync(int jobId);
    Task<List<TimeZoneSuggestion>> GetTimeZoneOptions();
    Task<JobRatingDetailsDto> GetJobBookingDetailsForRatingAsync(int jobId);
    Task<bool> IsJobArchived(int jobId);
    Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId);
    Task<bool> JobNumberExistsAsync(string jobNumber);

    Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId, int? fromSuburbId,
        int? toSuburbId, int? speed, int? size, float? weight, int? quantity, int? type);

    Task<T> GetByIdAsync<T>(int id)
        where T : class;

    Task SaveChangesAsync();
    Task BulkUpdateReadStatusAsync(BulkReadUpdateRequestModel data);
    Task AddPackagesToJobAsync(int effectiveJobId, List<TucJobItem> items);
    Task<List<ScanDetailResult>> ScanList(DateTimeOffset? runDate, string scan);
    Task<bool> ValidatePodSwapAsync(string jobNumber);
    Task<string> GetStaffNameAsync(int staffId);
    Task UpdateUrgentJobRateAsync(int jobId, decimal rate, JobType jobType);
    Task SimpleRepriceJobManualAsync(SimpleRepriceJobModel data);
    Task<decimal> RepriceJobWithBaseAmountAsync(RepriceJobWithBaseAmountModel data);
    Task<decimal> GetJobRateUsAsync(RateJobUsDto dto);
    Task AssignCourierToJobAsync(List<int> jobIds, int courierId);
    Task AssignCourierToChildJobsAsync(List<int> jobIds, InternalJobStatus internalStatus);
    Task<List<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived);
    Task<int?> GetJobParentIdAsync(int jobId);
    Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(List<int> jobIds);
}