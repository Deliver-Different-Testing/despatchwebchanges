#nullable enable

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

    Task<PriceDetailReportRaw> GetPriceDetailReportAsync(
        PriceDetailReportRequest request,
        CancellationToken ct = default);

    Task<IReadOnlyList<PerformanceSpendReportModel>> GetClientJobsReportDataAsync(ClientJobsReportRequest request);

    Task<JobSearchResult> CurrentJobListAsync(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate);

    Task<JobSearchResult> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string? clientIds,
        IReadOnlyList<int> selectedViewIds,
        int? selectedClearListId = null,
        CancellationToken cancellationToken = default);

    Task<int> MaxAutoLatePickupAlertAsync();
    Task<int> MaxAutoLateDeliveryAlertAsync();
    Task<decimal> PpdExclusiveAmountAsync(int clientId, decimal amount);
    Task<decimal> GetJobAmountAsync(int jobId, bool isBooking);

    Task<IReadOnlyList<Suggestion>> GetSpeedsAsync();
    Task<IReadOnlyList<Suggestion>> GetSpeedsBySearchTermAsync(string searchTerm);
    Task<IReadOnlyList<Suggestion>> GetActiveRoutesAsync();
    Task<IReadOnlyList<Suggestion>> GetContactsByClientIdAsync(int clientId);
    Task<IReadOnlyList<Lookup>> LeaveParcelLocationsAsync();
    Task<IReadOnlyList<UndeliverableLocation>> UndeliverableLocationsAsync();
    Task<IReadOnlyList<InternalStatus>> GetInternalStatusListAsync();
    Task<IReadOnlyList<Suggestion>> GetStatusListAsync();
    Task<IReadOnlyList<Suggestion>> EventTypeListAsync();

    Task<IReadOnlyList<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId, bool isPrebook, bool isArchived = false);

    Task<SuggestedFuelChargeViewModel> GetSuggestedFuelChargeAsync(int jobId, decimal chargeAmount, bool isPrebook, bool isArchived = false);

    Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId);

    Task<PaginatedResponse<ClientItemsViewModel>> GetClientItemsBySpeedAsync(
        int clientId,
        int speedId,
        int jobId
    );

    Task<IList<OpenJobResponse>> GetOpenJobsAsync(OpenJobsRequest parameters);

    Task<JobGroupViewModel> GetJobByIdAsync(int jobId);
    Task<JobViewModel?> GetSingleJobById(int jobId);

    /// <summary>
    /// Every job whose id may key this job's POD media in S3 — itself, plus its non-void legs when
    /// it is the family root.
    /// </summary>
    Task<IReadOnlyList<PodMediaLeg>> GetPodMediaLegsAsync(int jobId);

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
    Task<JobLateCallDto?> GetJobForLateCallAsync(int jobId);
    Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(int jobId);
    Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(int jobId, bool isArchived);

    /// <summary>
    /// Reads US rating details on the supplied <paramref name="context"/> (rather than the
    /// repository's own connection) so the read can participate in an open transaction — used
    /// by the split re-rate, which must read the still-uncommitted child rows without
    /// self-blocking on the transaction's locks. Also precomputes the airport-match flags on
    /// the same connection so the downstream rating path performs no further child-row reads.
    /// </summary>
    Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(DespatchContext context, int jobId);

    /// <summary>
    /// NZ counterpart of <see cref="GetJobDetailsForRatingAsync(DespatchContext, int)"/> — reads
    /// rating details on the supplied <paramref name="context"/> so the read joins an open transaction.
    /// </summary>
    Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(DespatchContext context, int jobId, bool isArchived);
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

    Task<IReadOnlyList<ScanDetailResult>> ScanList(DateTimeOffset? runDate, int jobId, bool isBulkJob);
    Task<bool> ValidatePodSwapAsync(string jobNumber);
    Task<int?> GetJobIdByNumberAsync(string jobNumber);
    Task<string?> GetStaffNameAsync(int staffId);
    Task<decimal> GetTotalAmountFromBaseAsync(int jobId, decimal baseAmount);
    Task<decimal> GetJobRateUsAsync(RateJobUsDto dto);
    Task<IReadOnlyList<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived, bool isBulkJob = false);
    Task<int?> GetJobParentIdAsync(int jobId);
    Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(IReadOnlyList<int> jobIds);

    /// <summary>
    /// Returns each job's completion time (<c>UcjbComplTime</c>) keyed by job id. Used to capture the
    /// completion month before a restore clears it, so the job's S3 photos can still be located.
    /// </summary>
    Task<Dictionary<int, DateTime?>> GetJobCompletionTimesAsync(IReadOnlyList<int> jobIds);

    /// <summary>
    /// Returns the POD name and completion time of each live job. Used to tell the operator what
    /// proof of delivery a restore would destroy before it happens.
    /// </summary>
    Task<IReadOnlyList<RestorePodDetail>> GetRestorePodDetailsAsync(IReadOnlyList<int> jobIds);

    Task<List<Suggestion>> GetActivePartnerOptionsAsync();
    Task<bool> IsPartnerJobAsync(int jobId);
    Task<bool> IsOutboundPartnerJobAsync(int jobId, string? localTenantId);
    Task<List<JobItemTypeDto>> GetJobItemTypesAsync(int? jobId, int? bulkJobId);
}
