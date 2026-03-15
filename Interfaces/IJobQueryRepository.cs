using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IJobQueryRepository
{
    Task<JobGroupViewModel> GetBulkJobDetailAsync(int bulkJobId);
    Task<DispatchJobViewModel> GetBulkDispatchJobDetailAsync(int bulkJobId);

    Task<JobSearchResult> BulkSearchAsync(PodSearchRequest data, CancellationToken cancellationToken = default);
    Task<JobSearchResult> PodSearchAsync(PodSearchRequest data, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<JobDownloadModel>> PodSearchDownloadAsync(
        IReadOnlyList<int> courierIds,
        IReadOnlyList<int> speedIds,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        IReadOnlyList<int> clientIds,
        int? jobId = null
    );

    Task<IReadOnlyList<PerformanceSpendReportModel>> GetClientJobsReportDataAsync(ClientJobsReportRequest request);

    Task<JobSearchResult> CurrentJobListAsync(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate);

    Task<JobSearchResult> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        IReadOnlyList<int> selectedViewIds,
        int? selectedClearListId = null,
        CancellationToken cancellationToken = default);

    Task<int> MaxAutoLatePickupAlertAsync();
    Task<int> MaxAutoLateDeliveryAlertAsync();
    Task<decimal> PpdExclusiveAmountAsync(int clientId, decimal amount);

    Task<IReadOnlyList<Suggestion>> GetSpeedsAsync();
    Task<IReadOnlyList<Suggestion>> GetSpeedsBySearchTermAsync(string searchTerm);
    Task<IReadOnlyList<Suggestion>> GetContactsByClientIdAsync(int clientId);
    Task<IReadOnlyList<Lookup>> LeaveParcelLocationsAsync();
    Task<IReadOnlyList<UndeliverableLocation>> UndeliverableLocationsAsync();
    Task<IReadOnlyList<InternalStatus>> GetInternalStatusListAsync();
    Task<IReadOnlyList<Suggestion>> GetStatusListAsync();
    Task<IReadOnlyList<Suggestion>> EventTypeListAsync();

    Task<IReadOnlyList<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId, bool isPrebook, bool isArchived = false);

    Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId);

    Task<PaginatedResponse<ClientItemsViewModel>> GetClientItemsBySpeedAsync(
        int clientId,
        int speedId,
        int jobId
    );

    Task<IList<OpenJobResponse>> GetOpenJobsAsync(OpenJobsRequest parameters);

    Task<JobGroupViewModel> GetJobByIdAsync(int jobId, CancellationToken cancellationToken = default);
    Task<JobViewModel> GetSingleJobById(int jobId);
    Task<OverviewStatsViewModel> GetOverviewStatsAsync();

    Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
        OverviewJobsRequest parameters,
        CancellationToken cancellationToken = default
    );

    Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId);

    Task<TucJobType> GetJobTypeByIdAsync(int speedId);

    Task<IReadOnlyList<AddressWithAgent>> GetClosestAirportsAsync(decimal latitude, decimal longitude);

    Task<IReadOnlyList<MegaMapResponse>> GetJobsForMegaMapAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<JobCoordinateModel>> GetJobCoordinatesAsync(IReadOnlyList<int> selectedViewIds, CancellationToken cancellationToken = default);

    Task<bool> IsJobParentAsync(int jobId);
    Task<bool> IsBulkJobParent(int bulkJobId);
    Task<JobLateCallDto> GetJobForLateCallAsync(int jobId);
    Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(int jobId);
    Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(int jobId, bool isArchived);
    Task<JobRatingDetailsDtoNz> GetJobBookingDetailsForRatingNzAsync(int jobId);
    Task<IReadOnlyList<TimeZoneSuggestion>> GetTimeZoneOptions();
    Task<JobRatingDetailsDto> GetJobBookingDetailsForRatingAsync(int jobId);
    Task<bool> IsJobArchived(int jobId);
    Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId);
    Task<bool> JobNumberExistsAsync(string jobNumber);

    Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId, int? fromSuburbId,
        int? toSuburbId, int? speed, int? size, float? weight, int? quantity, int? type);

    Task<T> GetByIdAsync<T>(int id)
        where T : class;

    Task<IReadOnlyList<ScanDetailResult>> ScanList(DateTimeOffset? runDate, string scan);
    Task<bool> ValidatePodSwapAsync(string jobNumber);
    Task<string?> GetStaffNameAsync(int staffId);
    Task<decimal> GetTotalAmountFromBaseAsync(int jobId, decimal baseAmount);
    Task<decimal> GetJobRateUsAsync(RateJobUsDto dto);
    Task<IReadOnlyList<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived, bool isBulkJob = false);
    Task<int?> GetJobParentIdAsync(int jobId);
    Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(IReadOnlyList<int> jobIds);
}
