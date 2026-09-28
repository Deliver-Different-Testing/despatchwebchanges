using DespatchWeb.Models.Accessorial;

namespace DespatchWeb.Interfaces;

public interface IAccessorialChargeRepository
{
    Task<IReadOnlyList<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId);
    Task<IReadOnlyList<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId);
    Task AddChargeAsync(int jobId, JobAccessorialChargeCreateRequest request, string userName);
    Task<JobAccessorialChargeDto> GetAppliedChargeWithDetailsAsync(int jobAccessorialChargeId);
    Task UpdateChargeAsync(int jobAccessorialChargeId, decimal calculatedAmount, decimal? overrideAmount, decimal? inputValue, int itemCount, string notes, string userName);
    Task DeleteChargeAsync(int jobAccessorialChargeId);
    Task<decimal> GetJobAmountAsync(int jobId);
    Task<IReadOnlyList<PortionJobInfoDto>> GetPortionJobsAsync(int parentJobId);
    Task<decimal> GetTotalAppliedChargesAsync(int jobId);
}
