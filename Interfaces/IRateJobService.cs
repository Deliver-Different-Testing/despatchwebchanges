using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IRateJobService
{
    Task<JobRateResult> CalculateJobRateUs(JobRateRequest request);

    Task<decimal> RateJob(JobRatingDetailsDto jobDetails);
    Task RateJobUs(JobRatingDetailsDto jobDetails);
}
