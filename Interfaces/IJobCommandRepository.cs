using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IJobCommandRepository
{
    Task UpdateManualPriceAsync(IReadOnlyList<JobManualPriceModel> data);
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
    Task VoidBulkJobAsync(VoidBulkJobRequest data);
    Task<string> UnSplitJobAsync(int jobId);

    Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel, bool isArchived = false);
    Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel, bool isArchived = false);
    Task DeleteJobPriceBreakdownAsync(int chargeId, bool isArchived = false);

    Task VoidPrebookJobAsync(int jobId);

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

    Task AddClientsItemToJobAsync(int jobId, IReadOnlyList<int> clientItemIds, decimal totalCost);

    Task AddEntityAsync<T>(T entity) where T : class;

    Task UpdateJobNoteAsync(int jobId, string note);

    Task RateJobUsAsync(RateJobUsDto dto);

    Task UpdatePackagesForJobAsync(int jobId, IReadOnlyList<ParcelDimensions> parcels);
    Task UpdatePackagesForBulkJobAsync(int bulkJobId, IReadOnlyList<ParcelDimensions> parcels);
    Task<bool> ApplyWebQtyUpdateAsync(int jobId);

    Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead);

    Task SaveChangesAsync();
    Task BulkUpdateReadStatusAsync(BulkReadUpdateRequestModel data);
    Task AddPackagesToJobAsync(int effectiveJobId, List<TucJobItem> items);
    Task UpdateUrgentJobRateAsync(int jobId, decimal rate, JobType jobType);
    Task SimpleRepriceJobManualAsync(SimpleRepriceJobModel data);
    Task<decimal> RepriceJobWithBaseAmountAsync(RepriceJobWithBaseAmountModel data);
    Task AssignCourierToJobAsync(IReadOnlyList<int> jobIds, int courierId);
    Task AssignCourierToChildJobsAsync(IReadOnlyList<int> jobIds, InternalJobStatus internalStatus);
    Task<CreateMinimalTucJobResponse> CreateMinimalTucJobAsync(CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default);
}
