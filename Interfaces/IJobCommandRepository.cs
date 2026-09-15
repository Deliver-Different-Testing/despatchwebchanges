#nullable enable annotations
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IJobCommandRepository
{
    /// <summary>
    /// Updates pricing for the given jobs and returns the set of job IDs that were actually
    /// updated. Jobs that could not be found/updated (e.g. locked or invoiced) are omitted from
    /// the returned set so callers can surface them rather than report a false success.
    /// </summary>
    Task<IReadOnlySet<int>> UpdateManualPriceAsync(IReadOnlyList<JobManualPriceModel> data);
    Task UpdateJobVoidStatusAsync(IReadOnlyList<int> jobIds);

    Task SwapPodAsync(string job1, string job2);
    Task ReDispatchSelectedJobsAsync(IReadOnlyList<int> jobIds);
    Task ReSendSelectedJobsAsync(IReadOnlyList<int> jobIds);
    Task ReAssignSelectedJobsAsync(IReadOnlyList<int> jobIds);
    Task SetFirstJobAsync(int jobId, int courierId);

    Task UpdatePodDetailsAsync(UpdatePodDetailsRequest data);

    Task ReSendAllJobsAsync(int courierId);

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

    Task RestoreSplitJobsAsync(IReadOnlyList<int> jobIds);
    Task RestoreJobsAsync(IReadOnlyList<int> jobIds);
    Task VoidJobAsync(VoidJobRequest data);
    Task VoidArchivedJobAsync(VoidJobRequest data);

    /// <summary>
    /// Reassigns the paid courier on an archived job, leaving payment amounts untouched.
    /// Throws <see cref="Exceptions.ArchivedCourierChangeException"/> when the job is missing,
    /// already invoiced, already settled, or the courier is unknown/inactive.
    /// </summary>
    Task ChangeArchivedJobCourierAsync(int jobId, int newCourierId);
    Task VoidBulkJobAsync(VoidBulkJobRequest data);
    Task<string> UnSplitJobAsync(int jobId);

    Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel, bool isArchived = false);
    Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel, bool isArchived = false);
    Task DeleteJobPriceBreakdownAsync(int chargeId, bool isArchived = false);

    Task UpdateJobWeightAsync(int jobId, decimal weight);

    Task UpdateDeliveryAddressAsync(UpdateAddressRequest request);
    Task UpdatePickupAddressAsync(UpdateAddressRequest request);

    Task UpdateJobAsync(
        int jobId,
        JobProperty field,
        string value
    );

    /// <summary>
    /// Derives the waiting minutes implied by a dispatcher arrival-field edit and stores them
    /// on the live job: <see cref="JobProperty.PickupArrivalTime" /> writes
    /// <c>WaitedPickUp</c> from PickupArrivalTime to PickUpTime, and
    /// <see cref="JobProperty.DeliveryArrivalTime" /> writes <c>WaitedDelivery</c> from
    /// DeliveryArrivalTime to UcjbComplTime. Both are equivalent to
    /// <c>DATEDIFF(MINUTE, start, end)</c>, clamped at zero.
    /// </summary>
    /// <returns>
    /// The minutes written, or <c>null</c> when the property is not an arrival field or the
    /// job has no waiting basis yet (missing leg-end timestamp), in which case nothing is written.
    /// </returns>
    Task<int?> UpdateWaitedMinutesFromArrivalAsync(int jobId, JobProperty property);

    Task UpdateBulkJobAsync(
        int bulkJobId,
        JobProperty property,
        string value);

    Task<IReadOnlyList<string>> ReleaseBulkJobByIdAsync(int bulkJobId);

    Task<QuickAddJobResult> QuickAddJobAsync(JobCreateViewModel request);
    Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel);

    Task AddClientsItemToJobAsync(int jobId, IReadOnlyList<int> clientItemIds, decimal totalCost);

    Task AddEntityAsync<T>(T entity) where T : class;

    Task UpdateJobNoteAsync(int jobId, string note);

    Task RateJobUsAsync(RateJobUsDto dto);

    Task UpdatePackagesForJobAsync(int jobId, IReadOnlyList<ParcelDimensions> parcels, bool? calculateDimsOncePerJob = null);
    Task UpdatePackagesForBulkJobAsync(int bulkJobId, IReadOnlyList<ParcelDimensions> parcels, bool? calculateDimsOncePerJob = null);
    Task<bool> ApplyWebQtyUpdateAsync(int jobId);

    Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead);

    Task SaveChangesAsync();
    Task BulkUpdateReadStatusAsync(BulkReadUpdateRequestModel data);
    Task AddPackagesToJobAsync(int effectiveJobId, List<TucJobItem> items);
    Task UpdateUrgentJobRateAsync(int jobId, decimal rate, JobType jobType, string? pricingBreakdown = null);

    /// <summary>
    /// Explicitly sets/clears the RatedManually flag for a job (active, prebook, or archived),
    /// bypassing the auto-rate guard. Used by deliberate re-rate actions (e.g. the Recalculate
    /// button, bulk recalculate upload) that need to override or restamp manual-pricing status.
    /// </summary>
    Task SetJobRatedManuallyAsync(int jobId, bool isBooking, bool ratedManually);
    Task SimpleRepriceJobManualAsync(SimpleRepriceJobModel data);
    Task<decimal> RepriceJobWithBaseAmountAsync(RepriceJobWithBaseAmountModel data);
    Task AssignCourierToJobAsync(IReadOnlyList<int> jobIds, int courierId);
    Task AssignCourierToChildJobsAsync(IReadOnlyList<int> jobIds, InternalJobStatus internalStatus);
    Task<CreateMinimalTucJobResponse> CreateMinimalTucJobAsync(CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default);
}
