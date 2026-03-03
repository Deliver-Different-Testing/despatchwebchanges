using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models.Accessorial;

namespace DespatchWeb.Interfaces;

public interface IAccessorialChargeRepository
{
    Task<List<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId);
    Task<List<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId);
    Task AddChargeAsync(int jobId, JobAccessorialChargeCreateRequest request, string userName);
    Task<JobAccessorialChargeDto> GetAppliedChargeWithDetailsAsync(int jobAccessorialChargeId);
    Task UpdateChargeAsync(int jobAccessorialChargeId, decimal calculatedAmount, decimal? overrideAmount, decimal? inputValue, int itemCount, string notes, string userName);
    Task DeleteChargeAsync(int jobAccessorialChargeId);
    Task<decimal> GetJobAmountAsync(int jobId);
}
