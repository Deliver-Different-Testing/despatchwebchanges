using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models.Accessorial;

namespace DespatchWeb.Interfaces;

public interface IAccessorialChargeService
{
    Task<List<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId);
    Task<List<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId);
    Task AddChargesAsync(int jobId, List<JobAccessorialChargeCreateRequest> charges);
    Task<JobAccessorialChargeDto> UpdateChargeAsync(int jobAccessorialChargeId, JobAccessorialChargeUpdateRequest request);
    Task DeleteChargeAsync(int jobAccessorialChargeId);
    Task<decimal> GetJobAmountAsync(int jobId);
}
